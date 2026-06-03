import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import {
  optionalDateString,
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

    // DB のカラム制約（varchar 長 / date 型）に合わせて検証し、DB 起因の 500 を防ぐ。
    const insert = {
      client_name: requireString(body.client_name, "client_name", 20),
      client_kana: requireString(body.client_kana, "client_kana", 20),
      sex: requireSex(body.sex),
      birthday: optionalDateString(body.birthday, "birthday"),
      postcode: optionalString(body.postcode, "postcode", 10),
      address: optionalString(body.address, "address", 100),
      phone_number: optionalString(body.phone_number, "phone_number", 20),
      hair_type: optionalString(body.hair_type, "hair_type", 30),
      allergy: optionalString(body.allergy, "allergy", 30),
      occupation: optionalString(body.occupation, "occupation", 20),
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
    const memo = optionalString(body.memo, "memo", 300);
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
