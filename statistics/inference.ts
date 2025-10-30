import { toNumber } from '../utils';
import type { Group } from '../types';

export const toTitle = (s: string): string => s.replace(/[_\.]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export const prettyProp = (pid?: string): string => {
  if (!pid) return '';
  let p = String(pid);
  if (p.startsWith('note.')) p = p.substring(5);
  else if (p.startsWith('file.')) p = p.substring(5);
  else if (p.startsWith('formula.')) p = p.substring(8);
  return toTitle(p);
};

export const formatNumber = (n: number): string => new Intl.NumberFormat().format(n);

// Shared sampling constant
export const DEFAULT_SAMPLE_LIMIT = 20;

export const getEntryValue = (entry: any, pid: string): any => {
  const base = basePid(pid);
  const tryPids: string[] = [];
  const add = (s?: string) => { if (s && !tryPids.includes(s)) tryPids.push(s); };
  const cap = (s: string) => s.length ? s[0].toUpperCase() + s.slice(1) : s;
  add(pid);
  add(base);
  add(pid.toLowerCase());
  add(base.toLowerCase());
  if (pid.includes('.')) {
    const [pref, name] = pid.split('.', 2);
    add(`${pref}.${name}`);
    add(`${pref}.${cap(name)}`);
    add(`${pref}.${name.toLowerCase()}`);
    add(`${pref}.${cap(name.toLowerCase())}`);
    // also try cross-prefix with base
    add(`note.${name}`); add(`file.${name}`); add(`formula.${name}`);
    add(`note.${cap(name)}`); add(`file.${cap(name)}`); add(`formula.${cap(name)}`);
    add(`note.${name.toLowerCase()}`); add(`file.${name.toLowerCase()}`); add(`formula.${name.toLowerCase()}`);
  } else {
    add(`note.${pid}`); add(`file.${pid}`); add(`formula.${pid}`);
    add(`note.${cap(pid)}`); add(`file.${cap(pid)}`); add(`formula.${cap(pid)}`);
    add(`note.${pid.toLowerCase()}`); add(`file.${pid.toLowerCase()}`); add(`formula.${pid.toLowerCase()}`);
  }
  for (const p of tryPids) {
    try { const v = entry.getValue(p as any); if (v !== undefined) return v; } catch { /* noop */ }
  }
  // Frontmatter fallback: search common containers case-insensitively
  try {
    const fmCandidates = [
      entry?.file?.frontmatter,
      entry?.frontmatter,
      entry?.note?.frontmatter,
      entry?.file?.metadata?.frontmatter,
      entry?.metadata?.frontmatter,
    ];
    const keysToTry = Array.from(new Set([pid, base, pid.toLowerCase(), base.toLowerCase()]));
    for (const fm of fmCandidates) {
      if (!fm || typeof fm !== 'object') continue;
      const entriesFM = Object.entries(fm as Record<string, any>);
      for (const [k, v] of entriesFM) {
        const kl = String(k).toLowerCase();
        if (keysToTry.some(t => String(t).toLowerCase() === kl)) return v;
      }
    }
  } catch { /* noop */ }
  return undefined;
};

export const considerAsNumericFactory = (groupedData: Group[], sampleLimit = DEFAULT_SAMPLE_LIMIT) => (pid: string): boolean => {
  let observed = 0; let numeric = 0; let nonNumeric = 0;
  const isNumericString = (s: string): boolean => {
    const t = s.replace(/,/g, '').trim();
    return /^-?\d+(?:\.\d+)?$/.test(t);
  };
  for (const group of groupedData) {
    for (const e of group.entries) {
      const v = getEntryValue(e, pid);
      if (v === undefined || v === null) continue;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '' || /^null$/i.test(trimmed) || /^nan$/i.test(trimmed)) continue;
      }
      observed++;
      if (typeof v === 'number') numeric++;
      else if (typeof v === 'string' && isNumericString(v)) numeric++;
      else nonNumeric++;
      if (observed >= sampleLimit) break;
    }
    if (observed >= sampleLimit) break;
  }
  if (observed === 0) return false;
  // If small sample and all observed are numeric, consider numeric
  if (observed <= 5 && numeric > 0 && nonNumeric === 0) return true;
  const threshold = Math.max(1, Math.floor(observed * 0.6));
  return numeric >= threshold;
};

export const isLinkLikeFactory = (groupedData: Group[], sampleLimit = DEFAULT_SAMPLE_LIMIT) => (pid: string): boolean => {
  let n = 0; let linky = 0;
  for (const group of groupedData) {
    for (const e of group.entries) {
      const v = getEntryValue(e, pid);
      if (typeof v === 'string' && v.includes('[[ ')) linky++; // unlikely spaced variant
      else if (typeof v === 'string' && v.includes('[[')) linky++;
      if (++n >= sampleLimit) break;
    }
    if (n >= sampleLimit) break;
  }
  return linky > 0;
};

export const getTopNValuesFactory = (groupedData: Group[]) => (pid: string, topN: number): string[] => {
  const freq = new Map<string, number>();
  for (const group of groupedData) {
    for (const e of group.entries) {
      const v = getEntryValue(e, pid);
      const sval = v == null ? '' : String(v);
      const label = sval === '' ? '(empty)' : sval;
      freq.set(label, (freq.get(label) ?? 0) + 1);
    }
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, Math.max(0, Math.floor(topN))).map(([k]) => k);
};

// Normalize pid to its base without source prefix
export const basePid = (p?: string) => !p ? '' : String(p).replace(/^(note\.|file\.|formula\.)/, '');

// Central sanitization for columns: remove categorical that collide with numeric sums or are numeric
export function sanitizeColumns<T extends { kind: 'sum'|'countBy'|'distinct'|'coverage'; pid?: string; header: string; values?: string[]; othersBucket?: string }>(groupedData: Group[], columnDefs: T[]): T[] {
  const considerAsNumeric = considerAsNumericFactory(groupedData, DEFAULT_SAMPLE_LIMIT);
  const sumBase = new Set<string>(columnDefs.filter(c=>c.kind==='sum' && c.pid).map(c=>basePid(String(c.pid))));
  const isNumericLike = (s: string): boolean => /^-?\d+(?:\.\d+)?$/.test(String(s).replace(/,/g, '').trim());
  const hasAnyNumericSample = (pid: string): boolean => {
    for (const group of groupedData) {
      for (const e of group.entries) {
        const v = getEntryValue(e, pid);
        if (v === undefined || v === null) continue;
        if (typeof v === 'number' && Number.isFinite(v)) return true;
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed === '' || /^null$/i.test(trimmed) || /^nan$/i.test(trimmed)) continue;
          if (isNumericLike(trimmed)) return true;
        }
      }
    }
    return false;
  };
  const filtered: T[] = [];
  for (const c of columnDefs) {
    if (c.kind === 'countBy' && c.pid) {
      const b = basePid(String(c.pid));
      if (sumBase.has(b)) continue; // skip categorical when a Sum exists for same base
      if (considerAsNumeric(String(c.pid))) continue; // skip categorical for numeric pids
      if (hasAnyNumericSample(String(c.pid))) continue; // skip if any numeric sample exists
      // If the explicit categorical values are numeric-like-only, drop them too
      if (Array.isArray(c.values) && c.values.length > 0 && c.values.every(v => isNumericLike(v))) continue;
    }
    filtered.push(c);
  }
  return filtered;
}
