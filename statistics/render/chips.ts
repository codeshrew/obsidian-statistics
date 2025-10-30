import { getEntryValue, basePid, prettyProp } from '../inference';

export type TopCount = { label: string; count: number };

export function computePerGroupTopCounts(
  entries: any[],
  pid: string,
  topN: number,
  opts?: { ignoreNulls?: boolean }
): { tops: TopCount[]; others: TopCount[] } {
  const ignoreNulls = !!opts?.ignoreNulls;
  const freq = new Map<string, number>();
  for (const e of entries || []) {
    const v = getEntryValue(e, pid);
    if (ignoreNulls && (v === undefined || v === null || String(v).trim() === '' || /^(null|nan|undefined)$/i.test(String(v).trim()))) {
      continue;
    }
    const sval = v == null ? '' : String(v);
    const label = sval === '' ? '(empty)' : sval;
    freq.set(label, (freq.get(label) ?? 0) + 1);
  }
  const all = Array.from(freq.entries()).map(([label, count]) => ({ label, count }));
  all.sort((a,b) => b.count - a.count || a.label.localeCompare(b.label));
  const tops = all.slice(0, Math.max(0, Math.floor(topN)));
  const others = all.slice(tops.length);
  return { tops, others };
}
