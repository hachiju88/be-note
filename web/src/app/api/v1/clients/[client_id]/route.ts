import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { calcAge } from "@/lib/api/age";
import {
  optionalString,
  parseJsonObject,
  requireSex,
} from "@/lib/api/validate";

type Params = { client_id: string };

/**
 * GET /api/v1/clients/{client_id} — 顧客情報取得（staff / admin）。
 * 本体 + age(算出) + salon_info(リクエスト元サロン) + family_list(同一 family_id)。
 */
export const GET = apiRoute<Params>(
  async ({ auth, svc, params }) => {
    const { data: client, error } = await svc
      .from("t_client")
      .select(
        "client_id, family_id, client_name, client_kana, sex, birthday, postcode, address, phone_number, hair_type, allergy, occupation",
      )
      .eq("client_id", params.client_id)
      .eq("delete_flg", false)
      .maybeSingle();
    if (error) throw new ApiError("INTERNAL_ERROR", "顧客の取得に失敗しました。");
    if (!client) throw new ApiError("NOT_FOUND", "顧客が見つかりません。");

    let salonInfo: unknown = null;
    if (auth.salonId) {
      const { data: cs } = await svc
        .from("t_client_salon")
        .select("client_rank, total_visit, first_visit, memo")
        .eq("client_id", client.client_id)
        .eq("salon_id", auth.salonId)
        .eq("delete_flg", false)
        .maybeSingle();
      salonInfo = cs ?? null;
    }

    let familyList: unknown[] = [];
    if (client.family_id) {
      const { data: family } = await svc
        .from("t_client")
        .select("client_id, client_name, client_kana, sex, birthday")
        .eq("family_id", client.family_id)
        .eq("delete_flg", false)
        .neq("client_id", client.client_id);
      familyList = (family ?? []).map((f) => ({
        client_id: f.client_id,
        client_name: f.client_name,
        client_kana: f.client_kana,
        sex: f.sex,
        age: calcAge(f.birthday),
      }));
    }

    return ok({
      client_id: client.client_id,
      family_id: client.family_id,
      client_name: client.client_name,
      client_kana: client.client_kana,
      sex: client.sex,
      age: calcAge(client.birthday),
      birthday: client.birthday,
      postcode: client.postcode,
      address: client.address,
      phone_number: client.phone_number,
      hair_type: client.hair_type,
      allergy: client.allergy,
      occupation: client.occupation,
      salon_info: salonInfo,
      family_list: familyList,
    });
  },
  { roles: ["staff", "admin"] },
);

const CLIENT_TEXT_FIELDS = [
  "client_name",
  "client_kana",
  "birthday",
  "postcode",
  "address",
  "phone_number",
  "hair_type",
  "occupation",
  "allergy",
] as const;

/**
 * PUT /api/v1/clients/{client_id} — 顧客情報更新（staff / admin）。
 * 送信されたフィールドのみ更新する。memo はサロン別情報として t_client_salon を upsert。
 */
export const PUT = apiRoute<Params>(
  async ({ req, auth, svc, params }) => {
    const body = await parseJsonObject(req);

    const { data: existing, error: findError } = await svc
      .from("t_client")
      .select("client_id")
      .eq("client_id", params.client_id)
      .eq("delete_flg", false)
      .maybeSingle();
    if (findError) throw new ApiError("INTERNAL_ERROR", "顧客の取得に失敗しました。");
    if (!existing) throw new ApiError("NOT_FOUND", "顧客が見つかりません。");

    const patch: Record<string, unknown> = {};
    for (const field of CLIENT_TEXT_FIELDS) {
      if (field in body) patch[field] = optionalString(body[field], field);
    }
    if ("sex" in body) patch.sex = requireSex(body.sex);

    if (Object.keys(patch).length > 0) {
      const { error } = await svc
        .from("t_client")
        .update(patch)
        .eq("client_id", params.client_id);
      if (error) throw new ApiError("INTERNAL_ERROR", "顧客の更新に失敗しました。");
    }

    // memo はサロン別。送信時のみ t_client_salon を upsert（無ければ作成）。
    if ("memo" in body && auth.salonId) {
      const { error } = await svc
        .from("t_client_salon")
        .upsert(
          {
            client_id: params.client_id,
            salon_id: auth.salonId,
            memo: optionalString(body.memo, "memo"),
          },
          { onConflict: "client_id,salon_id" },
        );
      if (error) {
        throw new ApiError("INTERNAL_ERROR", "顧客サロン情報の更新に失敗しました。");
      }
    }

    return ok({ client_id: params.client_id });
  },
  { roles: ["staff", "admin"] },
);
