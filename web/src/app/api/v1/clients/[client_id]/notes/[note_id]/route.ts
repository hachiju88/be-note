import type { SupabaseClient } from "@supabase/supabase-js";
import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { assertUuid } from "@/lib/api/validate";
import { assertClientAccess } from "@/lib/api/ownership";
import { toNoteTypeCode, type NoteTypeCode } from "@/lib/api/note-type";
import { fetchStaffNames, staffRef } from "@/lib/api/staff";

type Params = { client_id: string; note_id: string };

// ビフォー/アフター写真を保存する Supabase Storage バケット名。
const PHOTO_BUCKET = "be-note-photos";
const SIGNED_URL_TTL_SEC = 60 * 10;

/**
 * GET /api/v1/clients/{client_id}/notes/{note_id} — Be:note 詳細（staff / admin / customer 自分のみ）。
 * note_type ごとにレスポンスが異なる。customer には管理用フィールド（施術時間 start_time/end_time、
 * actual_start/end 等）をサーバ側で除外する（クライアント非表示に依存しない）。
 */
export const GET = apiRoute<Params>(
  async ({ auth, svc, params }) => {
    assertUuid(params.client_id, "client_id");
    assertUuid(params.note_id, "note_id");
    assertClientAccess(auth, params.client_id);

    const { data: note, error } = await svc
      .from("t_be_note")
      .select(
        "note_id, p_note_id, note_type, responsible, creation_datetime, future_flg, is_client, text, read_flg",
      )
      .eq("note_id", params.note_id)
      .eq("client_id", params.client_id)
      .eq("delete_flg", false)
      .maybeSingle();
    if (error) throw new ApiError("INTERNAL_ERROR", "Be:note の取得に失敗しました。");
    if (!note) throw new ApiError("NOT_FOUND", "Be:note が見つかりません。");

    const isCustomer = auth.role === "customer";
    const typeCode = toNoteTypeCode(note.note_type);
    const responsibleNames = await fetchStaffNames(svc, [note.responsible]);

    const base: Record<string, unknown> = {
      note_id: note.note_id,
      p_note_id: note.p_note_id,
      note_type: typeCode,
      responsible: staffRef(note.responsible, responsibleNames),
      creation_datetime: note.creation_datetime,
      future_flg: note.future_flg,
    };

    const detail = await buildDetail(svc, note, typeCode, isCustomer);
    return ok({ ...base, ...detail });
  },
  { roles: ["staff", "admin", "customer"] },
);

/** note_type 別の詳細フィールドを組み立てる。 */
async function buildDetail(
  svc: SupabaseClient,
  note: Record<string, unknown>,
  typeCode: NoteTypeCode,
  isCustomer: boolean,
): Promise<Record<string, unknown>> {
  const noteId = note.note_id as string;

  switch (typeCode) {
    case "reservation": {
      const { data: r } = await svc
        .from("t_reservation")
        .select(
          "reservation_start, reservation_end, actual_start, actual_end, main_menu, status, total, payment_method, current_task_id",
        )
        .eq("note_id", noteId)
        .maybeSingle();
      const { data: menus } = await svc
        .from("t_menu")
        .select(
          "menu_id, menu_master_id, menu_name, kinds, staff_id, memo, price, start_time, end_time",
        )
        .eq("note_id", noteId);
      const menuRows = menus ?? [];
      const names = await fetchStaffNames(
        svc,
        menuRows.map((m) => m.staff_id),
      );
      const menuList = menuRows.map((m) => {
        const item: Record<string, unknown> = {
          menu_id: m.menu_id,
          menu_master_id: m.menu_master_id,
          menu_name: m.menu_name,
          kinds: m.kinds,
          staff: staffRef(m.staff_id, names),
          memo: m.memo,
          price: m.price,
        };
        if (!isCustomer) {
          item.start_time = m.start_time;
          item.end_time = m.end_time;
        }
        return item;
      });
      const result: Record<string, unknown> = {
        reservation_start: r?.reservation_start ?? null,
        reservation_end: r?.reservation_end ?? null,
        main_menu: r?.main_menu ?? null,
        status: r?.status ?? null,
        total: r?.total ?? null,
        payment_method: r?.payment_method ?? null,
        current_task_id: r?.current_task_id ?? null,
        menu_list: menuList,
      };
      if (!isCustomer) {
        result.actual_start = r?.actual_start ?? null;
        result.actual_end = r?.actual_end ?? null;
      }
      return result;
    }

    case "item": {
      const { data: items } = await svc
        .from("t_sold_item")
        .select("item_id, staff_id, item_name, kinds, memo, price")
        .eq("note_id", noteId);
      const rows = items ?? [];
      const names = await fetchStaffNames(
        svc,
        rows.map((i) => i.staff_id),
      );
      return {
        item_list: rows.map((i) => ({
          item_id: i.item_id,
          staff: staffRef(i.staff_id, names),
          item_name: i.item_name,
          kinds: i.kinds,
          memo: i.memo,
          price: i.price,
        })),
      };
    }

    case "discount": {
      const { data: discounts } = await svc
        .from("t_discount")
        .select("discount_id, staff_id, discount_name, kinds, memo, price")
        .eq("note_id", noteId);
      const rows = discounts ?? [];
      const names = await fetchStaffNames(
        svc,
        rows.map((d) => d.staff_id),
      );
      return {
        discount_list: rows.map((d) => ({
          discount_id: d.discount_id,
          staff: staffRef(d.staff_id, names),
          discount_name: d.discount_name,
          kinds: d.kinds,
          memo: d.memo,
          price: d.price,
        })),
      };
    }

    case "photo": {
      const { data: photos } = await svc
        .from("t_photo")
        .select("photo_id, staff_id, storage_path, memo")
        .eq("note_id", noteId);
      const rows = photos ?? [];
      const names = await fetchStaffNames(
        svc,
        rows.map((p) => p.staff_id),
      );
      const urls = await signPhotoUrls(
        svc,
        rows.map((p) => p.storage_path),
      );
      return {
        photo_list: rows.map((p) => ({
          photo_id: p.photo_id,
          staff: staffRef(p.staff_id, names),
          memo: p.memo,
          url: urls.get(p.storage_path) ?? null,
        })),
      };
    }

    case "text": {
      return {
        is_client: note.is_client,
        text: note.text,
        read_flg: note.read_flg,
      };
    }

    default:
      // head はヘッダ情報のみ（詳細フィールドなし）。
      return {};
  }
}

/** storage_path → 署名付き URL のマップ。 */
async function signPhotoUrls(
  svc: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await svc.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SEC);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}
