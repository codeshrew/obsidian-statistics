import { Keymap, App, HoverParent } from 'obsidian';
import { formatNumber, prettyProp, basePid, getEntryValue } from '../inference';
import type { ColumnDef, BuiltRow } from '../rows';
import { renderTextWithWikiLinks, openByLabel as openByLabelHelper } from './links';
import { renderDoughnut } from './doughnut';
import { renderMaybeWikiText } from './maybe-text';
import { getEntriesForGroup, selectFilePropChips } from './files';
// formatVal was unused; removed
import { computePerGroupTopCounts } from './chips';
import { countFilled, distinctCount } from '../aggregations';
import { isNumericLike, isMissingLike, toNumberSafe, log } from '../../utils';

export function renderTiles(opts: {
  app: App;
  hoverParent: HoverParent;
  containerEl: HTMLElement;
  rows: BuiltRow[];
  columnDefs: ColumnDef[];
  propertiesOrder: string[];
  groupByProp?: string;
  numericPids?: Set<string>;
  showLegends?: boolean;
  ignoreNulls?: boolean;
  chartTopN?: number;
}) {
  const { app, hoverParent, containerEl, rows, columnDefs, propertiesOrder, groupByProp, numericPids, showLegends, ignoreNulls, chartTopN } = opts;
  const isNumericPid = (pid?: string) => {
    if (!pid) return false;
    const b = basePid(pid);
    return !!(numericPids && numericPids.has(b));
  };
  const grid = containerEl.createDiv({ cls: 'bases-stats-grid' });
  const renderShowList = (
    wrap: HTMLElement,
    items: any[],
    defaultShow: number,
    renderRow: (parent: HTMLElement, item: any) => void,
    moreClass: string = 'bases-stats-files-more',
    makeLabels?: (remaining: number) => { show: string; collapse: string }
  ) => {
    let showAll = false;
    const redraw = () => {
      wrap.empty();
      const total = items.length;
      const limit = showAll ? total : Math.min(defaultShow, total);
      // Batch DOM writes into a detached container, then append once
      const temp = document.createElement('div');
      for (let i = 0; i < limit; i++) renderRow(temp as unknown as HTMLElement, items[i]);
      while (temp.firstChild) wrap.appendChild(temp.firstChild);
      if (total > defaultShow) {
        const more = wrap.createDiv({ cls: moreClass });
        const remain = total - defaultShow;
        const labels = makeLabels ? makeLabels(remain) : { show: `Show all (${remain} more)`, collapse: 'Collapse' };
        const btn = more.createEl('button', { cls: 'mod-cta', text: showAll ? labels.collapse : labels.show });
        // Accessibility: link button to the controlled list and reflect state
        if (!wrap.id) wrap.id = `list-${Math.random().toString(36).slice(2)}`;
        btn.setAttr('aria-controls', wrap.id);
        btn.setAttr('aria-expanded', String(showAll));
        btn.onClickEvent(() => { showAll = !showAll; btn.setAttr('aria-expanded', String(showAll)); redraw(); });
      }
    };
    redraw();
  };
  for (const r of rows) {
    const card = grid.createDiv({ cls: 'bases-stats-card' });
    const head = card.createDiv({ cls: 'bases-stats-card-head' });
    const titleEl = head.createDiv({ cls: 'bases-stats-card-title' });
    const titleSpan = titleEl.createSpan({ cls: 'bases-stats-card-title-text' });
    renderTextWithWikiLinks(app, hoverParent, titleSpan, r.label);
    head.createEl('div', { cls: 'bases-stats-card-count', text: formatNumber(r.count) });

    // KPI band: columns per numeric property with three stacked cells (Sum, Avg, Coverage); plus Distinct counts for categoricals
    const kpiWrap = card.createDiv({ cls: 'bases-stats-kpis bases-stats-kpis-grid' });
    const pidsSelected = (propertiesOrder || []).filter(p => typeof p === 'string') as string[];
    const sumBaseFromColumns = new Set<string>(columnDefs.filter(c=>c.kind==='sum' && c.pid).map(c=>basePid(String(c.pid))));
    const isNumericForGroup = (pid: string): boolean => {
      let observed = 0, numeric = 0, nonNumeric = 0;
      for (const e of r.entries) {
        const v = getEntryValue(e, pid);
        if (v === undefined || v === null) continue;
        if (typeof v === 'string') {
          const t = v.trim();
          if (t === '' || /^null$/i.test(t) || /^nan$/i.test(t)) continue;
          if (isNumericLike(t)) numeric++; else nonNumeric++;
        } else if (typeof v === 'number' && Number.isFinite(v)) {
          numeric++;
        } else {
          nonNumeric++;
        }
        if (++observed >= 12) break;
      }
      if (observed === 0) return false;
      const threshold = Math.max(1, Math.floor(observed * 0.6));
      return numeric >= threshold;
    };
    const isNumericSelected = (pid: string) => sumBaseFromColumns.has(basePid(pid)) || isNumericPid(pid) || isNumericForGroup(pid);
    const numericSelected = pidsSelected.filter(p => isNumericSelected(p));
    const categoricalSelected = pidsSelected.filter(p => !isNumericSelected(p) && !String(p).startsWith('file.'));
    try { log('[Tiles KPI] group=', r.label, { numericSelected, categoricalSelected }); } catch {}
    const computeNumericStats = (entries: any[], pid: string) => {
      let sum = 0; let nonMissing = 0; const total = entries.length;
      for (const e of entries) {
        const raw = getEntryValue(e, pid);
        if (raw == null || isMissingLike(raw)) continue;
        const n = toNumberSafe(raw);
        sum += n; nonMissing++;
      }
      const avg = nonMissing > 0 ? (sum / nonMissing) : 0;
      const coverage = total > 0 ? Math.round((nonMissing / total) * 100) : 0;
      return { sum, avg, coverage };
    };
    const normalizeMulti = (raw: any): string[] => {
      if (raw == null) return [];
      const s = String(raw).trim();
      if (!s) return [];
      // split commas while preserving wiki tokens
      const parts = s.split(/\s*,\s*/g).filter(Boolean);
      return parts.map(p => {
        const m = p.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
        return m ? m[1] : p;
      }).filter(x => !isMissingLike(x));
    };
    // Render numeric KPI columns
    for (const pid of numericSelected) {
      const stats = computeNumericStats(r.entries, pid);
      try { log('[Tiles KPI Stats]', pid, stats); } catch {}
      const col = kpiWrap.createDiv({ cls: 'bases-stats-kpi' });
      col.createDiv({ cls: 'bases-stats-kpi-label', text: prettyProp(pid) });
      const stack = col.createDiv({ cls: 'bases-stats-kpi-values' });
      // Sum cell
      const c1 = stack.createDiv({ cls: 'bases-stats-kpi-cell' });
      c1.createDiv({ cls: 'bases-stats-kpi-cell-title', text: 'Sum' });
      c1.createDiv({ cls: 'bases-stats-kpi-cell-value', text: `${formatNumber(stats.sum)}` });
      // Avg cell
      const c2 = stack.createDiv({ cls: 'bases-stats-kpi-cell' });
      c2.createDiv({ cls: 'bases-stats-kpi-cell-title', text: 'Avg' });
      c2.createDiv({ cls: 'bases-stats-kpi-cell-value', text: `${formatNumber(Math.round(stats.avg))}` });
      // Coverage cell
      const c3 = stack.createDiv({ cls: 'bases-stats-kpi-cell' });
      c3.createDiv({ cls: 'bases-stats-kpi-cell-title', text: 'Coverage' });
      c3.createDiv({ cls: 'bases-stats-kpi-cell-value', text: `${stats.coverage}%` });
    }
    // (legacy distinct KPI removed; handled by Distinct Counts section above)

    const showFiles = Array.isArray(propertiesOrder) && propertiesOrder.includes('file.name');
    if (showFiles && r.entries && r.entries.length) {
      const filesWrap = card.createDiv({ cls: 'bases-stats-files' });
      filesWrap.setAttr('role', 'list');
      const DEFAULT_SHOW = 6;
      const entriesForGroup = getEntriesForGroup(r.entries, groupByProp, r.groupKeyStr ?? r.label);
      const filePropChips: string[] = selectFilePropChips(propertiesOrder, 3);
      renderShowList(
        filesWrap,
        entriesForGroup,
        DEFAULT_SHOW,
        (parent, entry) => {
          const fileName = String(entry.file?.name ?? '');
          const filePath = String(entry.file?.path ?? '');
          const rowLine = parent.createDiv({ cls: 'bases-stats-file-row' });
          rowLine.setAttr('role', 'listitem');
          rowLine.setAttr('aria-label', `File: ${fileName || filePath || '(file)'}`);
          const left = rowLine.createDiv({ cls: 'bases-stats-file-left' });
          const headRow = left.createDiv({ cls: 'bases-stats-file-head' });
          headRow.createSpan({ cls: 'bases-stats-file-dot', text: '•' });
          const a = headRow.createEl('a', { cls: 'bases-stats-file', text: fileName || filePath || '(file)' });
          a.onClickEvent((evt: MouseEvent) => {
            if (evt.button !== 0 && evt.button !== 1) return;
            evt.preventDefault();
            const mod = Keymap.isModEvent(evt as any);
            app.workspace.openLinkText(filePath, '', mod);
          });
          a.addEventListener('mouseover', (evt) => {
            (app.workspace as any).trigger('hover-link', {
              event: evt,
              source: 'bases',
              hoverParent,
              targetEl: a,
              linktext: filePath,
            });
          });
          if (filePropChips.length) {
            const chips = left.createDiv({ cls: 'bases-stats-file-chips' });
            for (const pid of filePropChips) {
              const chip = chips.createDiv({ cls: 'bases-stats-file-chip' });
              chip.setAttr('data-pid', String(pid));
              chip.createSpan({ cls: 'bases-stats-file-chip-label', text: prettyProp(pid) });
              const v = (() => { try { return entry.getValue(pid as any); } catch { return undefined; } })();
              const valEl = chip.createSpan({ cls: 'bases-stats-file-chip-value' });
              if (typeof v === 'number') valEl.setText(formatNumber(v));
              else {
                const sval = v == null ? '' : String(v);
                if (sval) renderMaybeWikiText(app, hoverParent, valEl, sval);
                else { valEl.addClass('is-empty'); valEl.setText('(empty)'); }
              }
            }
          }
        },
        'bases-stats-files-more',
        (remain) => ({ show: `Show all files (${remain} more)`, collapse: 'Collapse files' })
      );
    }
    if (showFiles && r.entries && r.entries.length && columnDefs.length) {
      card.createDiv({ cls: 'bases-stats-sep' });
    }
    if (columnDefs.length) {
      const summary = card.createDiv({ cls: 'bases-stats-summary' });
      const sumBase = new Set<string>(columnDefs.filter(c=>c.kind==='sum' && c.pid).map(c=>basePid(String(c.pid))));
      // Derive allowed categorical pids directly from selected properties, excluding numeric and file.* (group-aware)
      const allowedCountByPidSet = new Set<string>(
        (propertiesOrder || [])
          .filter(p => {
            if (typeof p !== 'string') return false;
            if (p.startsWith('file.')) return false;
            return !isNumericSelected(p);
          })
          .map(String)
      );
      const allowedSumPidSet = new Set(
        columnDefs.filter(c=>c.kind==='sum' && c.pid).map(c=>String(c.pid))
      );
      const pidInSummarySet = new Set<string>([...Array.from(allowedSumPidSet), ...Array.from(allowedCountByPidSet)]);
      const orderedByProps = (propertiesOrder || []).filter(p => pidInSummarySet.has(String(p))).map(String);
      const extras = Array.from(pidInSummarySet).filter(p => !orderedByProps.includes(p));
      const pidOrder = [...orderedByProps, ...extras];

      const findSumIdxForPid = (pid: string): number => {
        const b = basePid(String(pid));
        return columnDefs.findIndex(c => c.kind==='sum' && c.pid && basePid(String(c.pid))===b);
      };

      for (const pid of pidOrder) {
        const sumIdx = findSumIdxForPid(pid);
        // Remove numeric Sum rows from Summary: skip rendering if pid has a Sum column
        if (sumIdx >= 0) { continue; }
        if (!allowedCountByPidSet.has(String(pid))) continue;
        const row = summary.createDiv({ cls: 'bases-stats-summary-row' });
        const rowLabel = row.createDiv({ cls: 'bases-stats-summary-label', text: prettyProp(String(pid)) });
        const rowChips = row.createDiv({ cls: 'bases-stats-summary-chips' });
        rowChips.setAttr('role', 'list');
        const rowChart = row.createDiv({ cls: 'bases-stats-summary-chart' });
        const perPidCap = Number.isFinite(Number(chartTopN)) ? Math.max(1, Math.floor(Number(chartTopN))) : 4;
        const { tops, others } = computePerGroupTopCounts(r.entries, String(pid), perPidCap, { ignoreNulls: !!ignoreNulls });
        if ((tops?.length ?? 0) + (others?.length ?? 0) === 0) { row.remove(); continue; }

        // Render doughnut (compact view) for categorical summaries
        let chartRendered = false;
        try {
          const otherSum = others.reduce((a, x) => a + x.count, 0);
          const items = [...tops.map(t=>({ label: String(t.label), value: t.count })), ...(otherSum>0? [{ label: 'Other', value: otherSum }]:[])];
          // If there are at least 2 slices, show chart
          if (items.length >= 2) {
            renderDoughnut(rowChart, prettyProp(String(pid)), items, { size: 160, cutout: '62%', showLegend: !!showLegends, onOpen: (raw, evt) => openByLabelHelper(app, raw, evt) }).catch(()=>{});
            chartRendered = true;
            rowLabel.hide();
            row.removeClass('is-list-row');
          }
        } catch {}

        const all = [...tops, ...others];
        const initial = Math.min(perPidCap, all.length);
        const renderCatItem = (parent: HTMLElement, t: { label: string; count: number }) => {
          const chip = parent.createDiv({ cls: 'bases-stats-chip bases-stats-summary-item' });
          chip.setAttr('role', 'listitem');
          const lbl = chip.createEl('span', { cls: 'bases-stats-chip-label' });
          lbl.createEl('span', { cls: 'bases-stats-chip-badge', text: prettyProp(String(pid)) });
          const primary = lbl.createEl('span', { cls: 'bases-stats-chip-primary' });
          renderMaybeWikiText(app, hoverParent, primary, String(t.label));
          chip.createEl('span', { cls: 'bases-stats-chip-value', text: `${formatNumber(t.count)}/${formatNumber(r.count)}` });
          const pct = r.count > 0 ? Math.round((t.count / r.count) * 100) : 0;
          const prog = chip.createDiv({ cls: 'bases-stats-chip-progress', attr: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) } });
          const fill = prog.createDiv({ cls: 'bases-stats-chip-progress-fill' });
          fill.setAttr('style', `width:${pct}%`);
          const level = pct >= 66 ? 'high' : (pct >= 33 ? 'mid' : 'low');
          fill.addClass(`level-${level}`);
          chip.createEl('span', { cls: `bases-stats-chip-percent level-${level}`, text: `${pct}%` });
          chip.setAttr('aria-label', `${prettyProp(String(pid))}: ${String(t.label)} — ${pct}%`);
        };
        // Only render the list if no chart was rendered
        if (!chartRendered) {
          row.addClass('is-list-row');
          renderShowList(
            rowChips,
            all,
            perPidCap,
            (parent, item) => { if (item.count > 0) renderCatItem(parent, item); },
            'bases-stats-summary-more',
            (remain) => ({ show: `Show all (${remain} more)`, collapse: 'Collapse' })
          );
        } else {
          rowChips.remove();
        }
      }
    }
  }
}
