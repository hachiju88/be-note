import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import {
  optionalString,
  parseJsonObject,
  requireSex,
  requireString,
} from "@/lib/api/validate";

/**
 * POST /api/v1/clients — 顧客新規登録（staff / admin）。
 * t_client を作成し、memo はリクエスト元サロンの t_client_salon に保存する。
 */
export const POST = apiRoute(
  async ({ req, auth, svc }) => {
    const body = await parseJsonObject(req);

    const insert = {
      client_name: requireString(body.client_name, "client_name"),
      client_kana: requireString(body.client_kana, "client_kana"),
      sex: requireSex(body.sex),
      birthday: optionalString(body.birthday, "birthday"),
      postcode: optionalString(body.postcode, "postcode"),
      address: optionalString(body.address, "address"),
      phone_number: optionalString(body.phone_number, "phone_number"),
      hair_type: optionalString(body.hair_type, "hair_type"),
      allergy: optionalString(body.allergy, "allergy"),
      occupation: optionalString(body.occupation, "occupation"),
    };

    const { data: created, error } = await svc
      .from("t_client")
      .insert(insert)
      .select("client_id")
      .single();
    if (error || !created) {
      throw new ApiError("INTERNAL_ERROR", "顧客の作成に失敗しました。");
    }

    // memo はサロン別情報。リクエスト元スタッフのサロンに t_client_salon を作成する。
    const memo = optionalString(body.memo, "memo");
    if (auth.salonId) {
      const { error: csError } = await svc
        .from("t_client_salon")
        .insert({
          client_id: created.client_id,
          salon_id: auth.salonId,
          memo,
        });
      if (csError) {
        throw new ApiError("INTERNAL_ERROR", "顧客サロン情報の作成に失敗しました。");
      }
    }

    return ok({ client_id: created.client_id }, 201);
  },
  { roles: ["staff", "admin"] },
);
