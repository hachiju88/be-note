/**
 * 空き時間算出の純粋関数（時刻は「対象日の 00:00 からの分」で扱う）。
 * docs/予約ロジック設計書.md「空き時間算出」のステップ 5–6 に対応。
 */

export type Interval = { start: number; end: number };

/** "HH:MM[:SS]" を 0:00 からの分に変換（秒は切り捨て）。 */
export function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/** base 区間群から busy 区間群を差し引いた空き区間群。 */
export function subtractIntervals(
  base: Interval[],
  busy: Interval[],
): Interval[] {
  let result = base.filter((iv) => iv.end > iv.start);
  for (const b of busy) {
    const next: Interval[] = [];
    for (const iv of result) {
      // 重ならない。
      if (b.end <= iv.start || b.start >= iv.end) {
        next.push(iv);
        continue;
      }
      // 前側の残り。
      if (b.start > iv.start) next.push({ start: iv.start, end: b.start });
      // 後側の残り。
      if (b.end < iv.end) next.push({ start: b.end, end: iv.end });
    }
    result = next;
  }
  return result.filter((iv) => iv.end > iv.start);
}

/** 2 区間の積集合（無ければ null）。 */
export function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

/** free 区間内で duration 分が収まる開始を step 分刻みで列挙する。 */
export function generateSlots(
  free: Interval[],
  durationMin: number,
  stepMin = 15,
): Interval[] {
  const slots: Interval[] = [];
  for (const iv of free) {
    for (let s = iv.start; s + durationMin <= iv.end; s += stepMin) {
      slots.push({ start: s, end: s + durationMin });
    }
  }
  return slots;
}
