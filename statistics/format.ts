export const formatVal = (v: any): string => {
  try {
    if (v == null) return '(empty)';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    const anyVal = v as any;
    if (anyVal?.toString) return String(anyVal.toString());
    return JSON.stringify(v);
  } catch { return String(v); }
};
