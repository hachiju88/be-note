/**
 * UUID v7 生成ユーティリティ。
 *
 * 方針（CLAUDE.md / DB設計書）:
 *   - 全テーブルの主キーは UUID v7 を推奨。クライアント生成可（オフライン作成／同期対応）。
 *   - 先頭 48bit が Unix ミリ秒のため、ミリ秒をまたぐ生成は時系列順になりインデックス局所性に優れる。
 *     ※ 同一ミリ秒内に複数生成した場合の順序は保証しない（rand_a/rand_b は乱数。
 *        厳密な生成順ソートが要る用途では別途連番列を持つこと）。
 *   - サーバ採番は PostgreSQL の gen_random_uuid()（v4）。本関数はクライアント採番用。
 *
 * 依存なし。乱数は WebCrypto（`crypto.getRandomValues`）を使う。
 *   - ブラウザ / Node 18+ : `globalThis.crypto` が標準で利用可能。
 *   - React Native(Expo) : Hermes には標準で `crypto` が無いため、アプリ起動エントリで
 *     `react-native-get-random-values`（または expo-crypto 由来のポリフィル）を import して
 *     `global.crypto` を用意しておくこと。未用意の場合は本関数が明示的に例外を投げる。
 */

const MAX_48BIT = 0xffffffffffff; // 2^48 - 1（48bit タイムスタンプの上限）

/**
 * 実行環境の WebCrypto を解決する。未提供なら原因の分かる例外を投げる
 * （RN でポリフィル忘れ時に「crypto is undefined」で黙って落ちるのを防ぐ）。
 */
function getCryptoOrThrow(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error(
      "uuidv7: WebCrypto(crypto.getRandomValues) が利用できません。" +
        "React Native では起動エントリで react-native-get-random-values を import してください。",
    );
  }
  return c;
}

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
 * @param timestamp 埋め込むミリ秒（0〜2^48-1 の整数）。省略時は Date.now()（テスト用に注入可）。
 * @returns 8-4-4-4-12 形式の小文字 UUID（例: "0190b6c5-1e3a-7xxx-yxxx-xxxxxxxxxxxx"）
 * @throws {RangeError} timestamp が 0〜2^48-1 の整数でない場合
 */
export function uuidv7(timestamp: number = Date.now()): string {
  if (!Number.isInteger(timestamp) || timestamp < 0 || timestamp > MAX_48BIT) {
    throw new RangeError(
      `uuidv7: timestamp は 0〜2^48-1 の整数である必要があります: ${timestamp}`,
    );
  }

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
  getCryptoOrThrow().getRandomValues(bytes.subarray(6));

  // version（上位ニブルを 0b0111 に）と variant（上位 2bit を 0b10 に）を設定
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
