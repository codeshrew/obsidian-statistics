export function getEntriesForGroup(entries: any[], groupByProp: string | undefined, targetLabel: string | undefined): any[] {
  if (!groupByProp || !entries || !entries.length) return entries || [];
  const formatVal = (v: any): string => {
    try {
      if (v == null) return '(empty)';
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
      const anyVal = v as any;
      if (anyVal?.toString) return String(anyVal.toString());
      return JSON.stringify(v);
    } catch { return String(v); }
  };
  try {
    return entries.filter(e => formatVal(e.getValue(groupByProp as any)) === (targetLabel ?? ''));
  } catch { return entries; }
}

export function selectFilePropChips(propertiesOrder: string[], maxChips = 3): string[] {
  const idxFileName = propertiesOrder.indexOf('file.name');
  const chips: string[] = [];
  if (idxFileName < 0) return chips;
  const after = propertiesOrder.slice(idxFileName + 1).filter(p => !String(p).startsWith('file.'));
  const before = propertiesOrder.slice(0, idxFileName).filter(p => !String(p).startsWith('file.'));
  const pick = after.length ? after : before;
  for (const p of pick) { if (chips.length < maxChips) chips.push(p); else break; }
  return chips;
}
