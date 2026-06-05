import { ApiError } from "./errors";

/**
 * record_material_transaction RPC のエラーを共通エラーへマップする。
 * RPC は業務エラーをトークン文字列＋ errcode='P0001' で再送出する。
 */
export function mapMaterialRpcError(error: {
  code?: string | null;
  message?: string | null;
}): never {
  const msg = error.message ?? "";
  if (msg.includes("MATERIAL_NOT_FOUND")) {
    throw new ApiError("NOT_FOUND", "対象の材料が見つかりません。");
  }
  if (msg.includes("INSUFFICIENT_STOCK")) {
    throw new ApiError(
      "INVALID_PARAMS",
      "出庫数が在庫を超えています。",
    );
  }
  if (msg.includes("INVALID_TYPE")) {
    throw new ApiError(
      "INVALID_PARAMS",
      "transaction_type は in / out / adjust のいずれかで指定してください。",
    );
  }
  // FK・チェック制約違反。
  if (error.code === "23503" || error.code === "23514") {
    throw new ApiError("INVALID_PARAMS", "入力値が不正です（参照先または制約違反）。");
  }
  // RPC が raise した業務エラー（P0001）でトークン未一致のものは 400 扱い
  // （500 に丸めない。新トークン追加時の取りこぼし防止）。
  if (error.code === "P0001") {
    throw new ApiError("INVALID_PARAMS", "入出庫の登録に失敗しました（入力値をご確認ください）。");
  }
  throw new ApiError("INTERNAL_ERROR", "入出庫の登録に失敗しました。");
}
