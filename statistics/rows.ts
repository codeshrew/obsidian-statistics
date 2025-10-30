import { isMissing } from '../utils';
import { getEntryValue } from './inference';
import { formatVal } from './format';
import { sumValues, countLabel, countOthers, distinctCount, countFilled, countMissing } from './aggregations';
import type { Group, BaseEntry } from '../types';

export type ColumnDef = { kind: 'sum'|'countBy'|'distinct'|'coverage'; pid?: string; header: string; values?: string[]; othersBucket?: string };

export interface BuiltRow {
  label: string;
  groupKeyStr: string | undefined;
  count: number;
  cols: (number|string)[];
  entries: BaseEntry[];
}

// formatVal shared via ./format

export function buildRows(opts: {
  groupedData: Group[];
  columnDefs: ColumnDef[];
  groupByProp?: string;
}): BuiltRow[] {
  const { groupedData, columnDefs, groupByProp } = opts;
  const rows: BuiltRow[] = [];
  let gidx = 1;

  for (const group of groupedData) {
    let label: string | undefined = group.label ?? (group as any).value ?? group.key;
    let groupKeyStr: string | undefined = undefined;
    if ((group as any).value != null) {
      try { groupKeyStr = formatVal((group as any).value); } catch { /* noop */ }
    }
    if (!label && groupByProp && group.entries?.length) {
      const sample = group.entries[0];
      try { const v = sample.getValue(groupByProp as any); label = formatVal(v); groupKeyStr = formatVal(v); } catch { /* noop */ }
    }
    if (!label) label = `Group ${gidx}`;
    const count = group.entries.length;
    const colValues: (number|string)[] = [];

    for (const col of columnDefs) {
      if (col.kind === 'sum' && col.pid) {
        colValues.push(sumValues(group.entries, col.pid));
        continue;
      }
      if (col.kind === 'countBy' && col.pid) {
        if (col.values && col.values.length === 1 && col.values[0] === '__MISSING__') {
          const miss = countMissing(group.entries, col.pid);
          const rate = count > 0 ? Math.round((miss / count) * 1000) / 10 : 0;
          colValues.push(`${rate}%`);
        } else if (col.values && col.values.length > 0) {
          if (col.othersBucket) colValues.push(countOthers(group.entries, col.pid, new Set(col.values)));
          else colValues.push(countLabel(group.entries, col.pid, String(col.values[0])));
        } else {
          colValues.push(0);
        }
        continue;
      }
      if (col.kind === 'distinct' && col.pid) {
        colValues.push(distinctCount(group.entries, col.pid));
        continue;
      }
      if (col.kind === 'coverage' && col.pid) {
        const filled = countFilled(group.entries, col.pid);
        const rate = count > 0 ? Math.round((filled / count) * 1000) / 10 : 0;
        colValues.push(`${rate}%`);
        continue;
      }
      colValues.push('');
    }

    rows.push({ label, groupKeyStr, count, cols: colValues, entries: group.entries });
    gidx++;
  }

  return rows;
}
