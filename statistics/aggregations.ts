import { getEntryValue } from './inference';
import { isMissing, toNumber } from '../utils';

const labelOf = (v: any): string => {
  const sval = v == null ? '' : String(v);
  return sval === '' ? '(empty)' : sval;
};

export function sumValues(entries: any[], pid: string): number {
  let s = 0;
  for (const entry of entries) {
    const v = getEntryValue(entry, pid);
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number' && Number.isFinite(v)) { s += v; continue; }
    if (typeof v === 'string') {
      const t = v.trim();
      const re = /-?\d+(?:\.\d+)?|-?\d{1,3}(?:[,\u202F\u00A0]\d{3})+(?:\.\d+)?/g;
      const matches = t.match(re);
      if (matches && matches.length) {
        const pick = matches
          .map(tok => ({ tok, norm: tok.replace(/[\,\u202F\u00A0]/g, '') }))
          .sort((a,b) => b.norm.length - a.norm.length)[0];
        const n = parseFloat(pick.norm);
        if (!isNaN(n) && Number.isFinite(n)) { s += n; continue; }
      }
    }
    const anyVal = v as any;
    // Obsidian or plugin value wrappers
    try {
      if (typeof anyVal?.toNumber === 'function') {
        const n = Number(anyVal.toNumber());
        if (!isNaN(n) && Number.isFinite(n)) { s += n; continue; }
      }
    } catch { /* noop */ }
    try {
      const vo = anyVal?.valueOf?.();
      if (typeof vo === 'number' && Number.isFinite(vo)) { s += vo; continue; }
    } catch { /* noop */ }
    try {
      const ts = anyVal?.toString?.();
      if (typeof ts === 'string') {
        const re = /-?\d+(?:\.\d+)?|-?\d{1,3}(?:[,\u202F\u00A0]\d{3})+(?:\.\d+)?/g;
        const matches = ts.match(re);
        if (matches && matches.length) {
          const pick = matches
            .map(tok => ({ tok, norm: tok.replace(/[\,\u202F\u00A0]/g, '') }))
            .sort((a,b) => b.norm.length - a.norm.length)[0];
          const n = parseFloat(pick.norm);
          if (!isNaN(n) && Number.isFinite(n)) { s += n; continue; }
        }
      }
    } catch { /* noop */ }
    const n = toNumber(v);
    if (Number.isFinite(n) && n !== 0) { s += n; continue; }
  }
  return s;
}

export function countLabel(entries: any[], pid: string, label: string): number {
  let c = 0;
  for (const entry of entries) {
    const v = getEntryValue(entry, pid);
    if (labelOf(v) === label) c++;
  }
  return c;
}

export function countOthers(entries: any[], pid: string, allowed: Set<string>): number {
  let c = 0;
  for (const entry of entries) {
    const v = getEntryValue(entry, pid);
    if (!allowed.has(labelOf(v))) c++;
  }
  return c;
}

export function countFilled(entries: any[], pid: string): number {
  const isNumericLike = (s: string) => /-?\d{1,3}(?:[,\u202F\u00A0]\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/.test(s);
  let c = 0;
  for (const entry of entries) {
    const v = getEntryValue(entry, pid);
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) { c++; continue; }
    if (typeof v === 'string') {
      const t = v.trim();
      if (t === '' || /^(null|nan)$/i.test(t)) continue;
      if (isNumericLike(t)) { c++; continue; }
      continue;
    }
    // Try wrappers
    try { const vo = (v as any)?.valueOf?.(); if (typeof vo === 'number' && Number.isFinite(vo)) { c++; continue; } } catch {}
    try { const ts = (v as any)?.toString?.(); if (typeof ts === 'string' && isNumericLike(ts)) { c++; continue; } } catch {}
  }
  return c;
}

export function countMissing(entries: any[], pid: string): number {
  let c = 0;
  for (const entry of entries) {
    const v = getEntryValue(entry, pid);
    if (v === undefined || v === null) { c++; continue; }
    if (typeof v === 'string') { const t = v.trim(); if (t === '' || /^(null|nan)$/i.test(t)) { c++; continue; } }
  }
  return c;
}

export function distinctCount(entries: any[], pid: string): number {
  const seen = new Set<string>();
  for (const entry of entries) seen.add(labelOf(getEntryValue(entry, pid)));
  return seen.size;
}
