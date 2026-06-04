import { ApiError } from "./errors";

/**
 * note_type の変換（API は文字列 note_type_code / DB は SMALLINT note_type_id）。
 * 値は t_note_type（02_master）の固定語彙に対応する。
 */
export const NOTE_TYPE_CODES = [
  "head",
  "reservation",
  "item",
  "discount",
  "photo",
  "text",
] as const;

export type NoteTypeCode = (typeof NOTE_TYPE_CODES)[number];

const ID_BY_CODE: Record<NoteTypeCode, number> = {
  head: 1,
  reservation: 2,
  item: 3,
  discount: 4,
  photo: 5,
  text: 6,
};

const CODE_BY_ID: Record<number, NoteTypeCode> = {
  1: "head",
  2: "reservation",
  3: "item",
  4: "discount",
  5: "photo",
  6: "text",
};

/** DB の note_type_id → API の note_type_code。未知値は内部エラー（DB 不整合）。 */
export function toNoteTypeCode(id: number): NoteTypeCode {
  const code = CODE_BY_ID[id];
  if (!code) {
    throw new ApiError("INTERNAL_ERROR", `未知の note_type_id: ${id}`);
  }
  return code;
}

/** API の note_type_code → DB の note_type_id。不正値は INVALID_PARAMS。 */
export function toNoteTypeId(code: unknown): number {
  if (typeof code !== "string" || !(code in ID_BY_CODE)) {
    throw new ApiError(
      "INVALID_PARAMS",
      `note_type は ${NOTE_TYPE_CODES.join(" / ")} のいずれかで指定してください。`,
    );
  }
  return ID_BY_CODE[code as NoteTypeCode];
}
