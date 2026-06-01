/**
 * UUID v7 生成ユーティリティ。
 *
 * 方針（CLAUDE.md / DB設計書）:
 *   - 全テーブルの主キーは UUID v7 を推奨。クライアント生成可（オフライン作成／同期対応）。
 *   - 先頭 48bit が Unix ミリ秒のため、生成順とおおむね一致しインデックス局所性に優れる。
 *   - サーバ採番は PostgreSQL の gen_random_uuid()（v4）。本関数はクライアント採番用。
 *
 * 依存なし。`crypto.getRandomValues` を使うため、ブラウザ / React Native(Expo) /
 * Node 18+ で動作する。web・mobile 双方から同一仕様で利用する想定。
 */

/**
 * RFC 9562 準拠の UUID v7 文字列を生成して返す。
 *
 * レイアウト:
 *   - 48bit: Unix エポックからのミリ秒（big-endian）
 *   - 4bit : version（0b0111 = 7）
 *   - 12bit: ランダム（rand_a）
 *   - 2bit : variant（0b10）
 *   - 62bit: ランダム（rand_b）
 *
 * @param timestamp 埋め込むミリ秒。省略時は Date.now()（テスト用に注入可）。
 * @returns 8-4-4-4-12 形式の小文字 UUID（例: "0190b6c5-1e3a-7xxx-yxxx-xxxxxxxxxxxx"）
 */
export function uuidv7(timestamp: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // [0..5] 48bit ミリ秒タイムスタンプ（big-endian）
  // ビット演算は 32bit を超えるため、上位/下位に分けて算出する。
  const tsHigh = Math.floor(timestamp / 0x100000000); // 上位 16bit 分（ミリ秒 / 2^32）
  const tsLow = timestamp >>> 0; // 下位 32bit
  bytes[0] = (tsHigh >>> 8) & 0xff;
  bytes[1] = tsHigh & 0xff;
  bytes[2] = (tsLow >>> 24) & 0xff;
  bytes[3] = (tsLow >>> 16) & 0xff;
  bytes[4] = (tsLow >>> 8) & 0xff;
  bytes[5] = tsLow & 0xff;

  // [6..15] ランダム 80bit
  crypto.getRandomValues(bytes.subarray(6));

  // version（上位ニブルを 0b0111 に）と variant（上位 2bit を 0b10 に）を設定
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
