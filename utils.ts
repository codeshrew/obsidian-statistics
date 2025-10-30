export const toNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }
  const anyVal = val as any;
  if (anyVal?.toNumber) {
    const n = Number(anyVal.toNumber());
    return isNaN(n) ? 0 : n;
  }
  if (anyVal?.toString) {
    const n = Number(anyVal.toString());
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

export const isMissing = (val: any): boolean => {
  const anyVal = val as any;
  if (anyVal?.isEmpty) {
    try { return !!anyVal.isEmpty(); } catch { /* noop */ }
  }
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) return val.length === 0;
  return false;
};

// Debug logging gate
export const DEBUG = false;
export const log = (...args: any[]) => { if (DEBUG) { try { console.log(...args); } catch { /* noop */ } } };

// Config getters
export function getBooleanConfig(config: any, key: string, defaultValue: boolean): boolean {
  try {
    const v = config?.get?.(key);
    if (v === undefined || v === null || v === '') return defaultValue;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  } catch { return defaultValue; }
}

export function getNumberConfig(config: any, key: string, defaultValue: number): number {
  try {
    const v = config?.get?.(key);
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : defaultValue;
  } catch { return defaultValue; }
}

export function getStringConfig(config: any, key: string, defaultValue: string): string {
  try {
    const v = config?.get?.(key);
    if (v === undefined || v === null) return defaultValue;
    return String(v);
  } catch { return defaultValue; }
}

// Stronger coercion and validation helpers
export function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function getObjectConfig(config: any, key: string): Record<string, any> | null {
  try {
    const v = config?.get?.(key);
    return v && typeof v === 'object' ? (v as Record<string, any>) : null;
  } catch { return null; }
}

export function getArrayOfStrings(val: unknown, maxLen = 100): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const x of val) {
    if (typeof x === 'string') out.push(x);
    else if (x != null) out.push(String(x));
    if (out.length >= maxLen) break;
  }
  return out;
}

export type MeasureType = 'count' | 'sum';
export function coerceMeasureType(val: unknown, defaultValue: MeasureType = 'count'): MeasureType {
  const s = String(val ?? '').toLowerCase();
  return s === 'sum' ? 'sum' : (s === 'count' ? 'count' : defaultValue);
}

function toPosInt(val: unknown, fallback: number): number {
  const n = Math.floor(Number(val));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseStatsConfig(raw: unknown): { tiles: any[]; columns: any[] } {
  const safeObj = raw && typeof raw === 'object' ? (raw as any) : {};
  const rawTiles = Array.isArray(safeObj.tiles) ? safeObj.tiles.slice(0, 50) : [];
  const rawCols = Array.isArray(safeObj.columns) ? safeObj.columns.slice(0, 100) : [];

  const tiles = rawTiles
    .filter((t: any) => t && typeof t === 'object')
    .map((t: any) => {
      const type = String(t.type ?? '').toLowerCase();
      const label = t.label != null ? String(t.label) : undefined;
      if (type === 'count') return { type: 'count', label };
      if (type === 'sum') {
        const field = t.field != null ? String(t.field) : '';
        if (field) return { type: 'sum', field, label };
      }
      return null;
    })
    .filter(Boolean) as any[];

  const columns = rawCols
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => {
      const type = String(c.type ?? '').toLowerCase();
      const label = c.label != null ? String(c.label) : undefined;
      if (type === 'sum') {
        const field = c.field != null ? String(c.field) : '';
        if (field) return { type: 'sum', field, label };
        return null;
      }
      if (type === 'countby') {
        const field = c.field != null ? String(c.field) : '';
        if (!field) return null;
        const othersBucket = c.othersBucket != null ? String(c.othersBucket) : undefined;
        const values = Array.isArray(c.values) ? getArrayOfStrings(c.values, 100) : undefined;
        const topN = typeof c.topN === 'number' ? clampNumber(Math.floor(c.topN), 1, 20) : undefined;
        const out: any = { type: 'countBy', field, label };
        if (othersBucket) out.othersBucket = othersBucket;
        if (values && values.length) out.values = values;
        else if (topN) out.topN = topN;
        return out;
      }
      return null;
    })
    .filter(Boolean) as any[];

  return { tiles, columns };
}

// Numeric helpers (DRY across modules)
export const isNumericLike = (s: string): boolean => {
  const t = String(s ?? '').replace(/,/g, '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(t);
};

export const isMissingLike = (v: any): boolean => {
  const s = String(v ?? '').trim();
  return !s || /^(null|nan|undefined|\(empty\))$/i.test(s);
};

export const toNumberSafe = (v: any): number => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
