import { prettyProp, considerAsNumericFactory, isLinkLikeFactory, getTopNValuesFactory, sanitizeColumns, basePid } from './inference';
import type { Group } from '../types';
import { isNumericLike, isMissingLike } from '../utils';
import type { ColumnDef } from './rows';

export function computeColumnDefs(opts: {
  groupedData: Group[];
  propertiesOrder: string[];
  statsColumns: any[];
}): ColumnDef[] {
  const { groupedData, propertiesOrder, statsColumns } = opts;
  const sampleLimit = 20;
  const considerAsNumeric = considerAsNumericFactory(groupedData, sampleLimit);
  const isLinkLike = isLinkLikeFactory(groupedData, sampleLimit);
  const columnDefs: ColumnDef[] = [];

  if (statsColumns.length) {
    const getTopNValues = getTopNValuesFactory(groupedData);
    for (const c of statsColumns) {
      if (c.type === 'sum' && c.field) {
        const h = c.label ?? `Sum(${prettyProp(String(c.field))})`;
        columnDefs.push({ kind: 'sum', pid: String(c.field), header: h, othersBucket: c.othersBucket, values: c.values });
      } else if (c.type === 'countBy' && c.field) {
        let values: string[] | undefined = undefined;
        if (Array.isArray(c.values) && c.values.length) values = c.values.map((x:any)=>String(x));
        else if (typeof c.topN === 'number' && c.topN > 0) values = getTopNValues(String(c.field), c.topN);
        if (values && values.length) {
          for (const v of values) {
            const base = c.label ?? prettyProp(String(c.field));
            columnDefs.push({ kind: 'countBy', pid: String(c.field), header: `${base}: ${v}`, values: [v] });
          }
          if (c.othersBucket) {
            columnDefs.push({ kind: 'countBy', pid: String(c.field), header: String(c.othersBucket), othersBucket: String(c.othersBucket), values });
          }
        }
      }
    }
    // Auto-promote numeric fields to Sum even if not explicitly configured
    const considerAsNumeric = considerAsNumericFactory(groupedData, sampleLimit);
    const sumBaseSet = new Set<string>(columnDefs.filter(d=>d.kind==='sum' && d.pid).map(d=>basePid(String(d.pid))));
    const candidatePids = Array.from(new Set<string>(statsColumns.map((c:any)=>String(c.field||c.pid||'')).filter(Boolean)));
    for (const pid of candidatePids) {
      if (!pid) continue;
      const b = basePid(pid);
      if (sumBaseSet.has(b)) continue;
      if (considerAsNumeric(pid)) {
        const h = `Sum(${prettyProp(String(pid))})`;
        columnDefs.unshift({ kind: 'sum', pid: String(pid), header: h });
        sumBaseSet.add(b);
      }
    }
    return sanitizeColumns(groupedData, columnDefs);
  }

  // Dynamic inference
  const TABLE_COL_CAP = 6;
  const TOP_N = 3;
  const getTopNValues = getTopNValuesFactory(groupedData);
  const numericPids = new Set<string>(
    propertiesOrder.filter(pid => !String(pid).startsWith('file.') && considerAsNumeric(pid)).map(p => basePid(p))
  );

  const sumDefs: ColumnDef[] = [];
  const otherDefs: ColumnDef[] = [];
  

  for (const pid of propertiesOrder) {
    const isFileProp = typeof pid === 'string' && pid.startsWith('file.');
    if (isFileProp) continue;
    if (numericPids.has(basePid(pid))) {
      sumDefs.push({ kind: 'sum', pid, header: `Sum(${prettyProp(pid)})` });
      continue;
    }
    const topsForNumericProbe = getTopNValues(pid, TOP_N);
    if (topsForNumericProbe.length > 0 && topsForNumericProbe.every(v => isNumericLike(v) || isMissingLike(v))) {
      sumDefs.push({ kind: 'sum', pid, header: `Sum(${prettyProp(pid)})` });
      continue;
    }

    if (isLinkLike(pid)) {
      otherDefs.push({ kind: 'distinct', pid, header: `Distinct ${prettyProp(pid)}` });
      const tops = getTopNValues(pid, TOP_N);
      for (const v of tops) {
        if (!isMissingLike(v)) otherDefs.push({ kind: 'countBy', pid, header: `${prettyProp(pid)}: ${v}`, values: [v] });
      }
      const nonMissing = tops.filter(v => !isMissingLike(v));
      if (nonMissing.length) otherDefs.push({ kind: 'countBy', pid, header: 'Other', othersBucket: 'Other', values: nonMissing });
      otherDefs.push({ kind: 'coverage', pid, header: `${prettyProp(pid)} Coverage (%)` });
      continue;
    }

    const tops = getTopNValues(pid, TOP_N);
    if (tops.length > 0) {
      for (const v of tops) {
        if (!isMissingLike(v)) otherDefs.push({ kind: 'countBy', pid, header: `${prettyProp(pid)}: ${v}`, values: [v] });
      }
      const nonMissing = tops.filter(v => !isMissingLike(v));
      if (nonMissing.length) otherDefs.push({ kind: 'countBy', pid, header: 'Other', othersBucket: 'Other', values: nonMissing });
    }
  }

  const merged: ColumnDef[] = [];
  for (const d of sumDefs) { if (merged.length < TABLE_COL_CAP) merged.push(d); }
  for (const d of otherDefs) { if (merged.length < TABLE_COL_CAP) merged.push(d); }
  columnDefs.push(...merged);

  // Ensure at least one Sum for the first numeric-like pid if none present
  const hasSumForBase = (b: string) => columnDefs.some(c => c.kind==='sum' && c.pid && basePid(String(c.pid))===b);
  const findFirstNumericLikePid = (): string | undefined => {
    for (const pid of propertiesOrder) {
      if (String(pid).startsWith('file.')) continue;
      const b = basePid(pid);
      if (hasSumForBase(b)) continue;
      const tops = getTopNValues(pid, TOP_N);
      if (tops.length && tops.every(v => isNumericLike(v) || isMissingLike(v))) return pid as string;
      if (numericPids.has(b)) return pid as string;
    }
    return undefined;
  };
  const ensurePid = findFirstNumericLikePid();
  if (ensurePid && columnDefs.length) {
    const b = basePid(ensurePid);
    if (!hasSumForBase(b)) {
      const sumCol: ColumnDef = { kind: 'sum', pid: ensurePid, header: `Sum(${prettyProp(ensurePid)})` };
      const idxCountBy = columnDefs.findIndex(c => c.kind==='countBy' && c.pid && basePid(String(c.pid))===b);
      if (idxCountBy >= 0) columnDefs.splice(idxCountBy, 1, sumCol);
      else if (columnDefs.length < TABLE_COL_CAP) columnDefs.push(sumCol);
    }
  }

  // Missing-rate columns no longer generated

  return sanitizeColumns(groupedData, columnDefs);
}
