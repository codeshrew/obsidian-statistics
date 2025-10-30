import { BasesView, HoverParent, HoverPopover, QueryController } from 'obsidian';
import { prettyProp, considerAsNumericFactory, basePid } from './statistics/inference';
import { buildRows } from './statistics/rows';
import { renderTiles } from './statistics/render/tiles';
import { renderTextWithWikiLinks } from './statistics/render/links';
import { StatisticsViewType } from './main';
import { toNumber, getBooleanConfig, getNumberConfig, getStringConfig, log, clampNumber, parseStatsConfig } from './utils';
import { computeColumnDefs } from './statistics/columns';
// measureType setting removed; dynamic inference used elsewhere

export class StatisticsView extends BasesView implements HoverParent {
  readonly type = StatisticsViewType;
  private containerEl: HTMLElement;

  hoverPopover: HoverPopover | null;

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);
    this.containerEl = parentEl.createDiv('bases-statistics-view-container');
  }

  public onDataUpdated(): void {
    this.containerEl.empty();

    const cfg = this.loadConfig();
    const { propertiesOrder, maxGroups, allEntries, statsTiles, statsColumns } = cfg;

    // KPI tiles (global across entries)
    if (statsTiles.length) {
      const tilesWrap = this.containerEl.createDiv({ cls: 'bases-stats-tiles' });
      for (const tile of statsTiles) {
        const t = tilesWrap.createDiv({ cls: 'bases-stats-tile' });
        const label: string = tile.label ?? tile.type ?? '';
        let val: number | string = '';
        if (tile.type === 'count') {
          val = allEntries.length;
        } else if (tile.type === 'sum' && tile.field) {
          let s = 0;
          for (const e of allEntries) s += toNumber(e.getValue(tile.field as any));
          val = s;
        } else {
          val = '';
        }
        t.createEl('div', { cls: 'bases-stats-tile-value', text: String(val) });
        t.createEl('div', { cls: 'bases-stats-tile-label', text: String(label) });
      }
    }

    // helpers now imported from statistics/inference

    const containerHeader = this.containerEl.createDiv('bases-stats-header');
    const groupByProp = cfg.groupByProp;
    const parts: string[] = [];
    parts.push(`Groups: ${this.data.groupedData.length}`);
    if (groupByProp) parts.push(`Grouped by: ${prettyProp(groupByProp)}`);
    containerHeader.createSpan({ text: parts.join(' • ') });

    // Build columns using shared helper
    const columnDefs = computeColumnDefs({
      groupedData: this.data.groupedData,
      propertiesOrder,
      statsColumns,
    });

    // Debug: final columns for this render
    
    // format helper shared via statistics/format
    const rows = buildRows({ groupedData: this.data.groupedData, columnDefs, groupByProp });

    // Debug: header->value mapping for first group
    try {
      const first = rows[0];
      const pairs = columnDefs.map((c, i) => ({ i, header: c.header, kind: c.kind, pid: c.pid, value: first ? first.cols[i] : undefined }));
      log('BasesStats.firstRow', JSON.stringify({ label: first?.label, count: first?.count, pairs }));
    } catch {}

    const ignoreNulls = cfg.ignoreNulls;
    const chartTopN = cfg.chartTopN;
    const rowsToRender = typeof maxGroups === 'number' ? rows.slice(0, maxGroups) : rows;

      // Recompute numericPids for renderer guard
      const sampleLimit = 20;
      const considerAsNumeric = considerAsNumericFactory(this.data.groupedData, sampleLimit);
      const inferred = new Set<string>(
        (this.config.getOrder?.() ?? [])
          .filter((pid:string) => !String(pid).startsWith('file.') && considerAsNumeric(pid))
          .map((pid:string) => basePid(pid))
      );
      // Also include any pid that has a Sum column
      const sumBase = new Set<string>(columnDefs.filter(c=>c.kind==='sum' && c.pid).map(c=>basePid(String(c.pid))));
      const numericPids = new Set<string>([...Array.from(inferred), ...Array.from(sumBase)]);
      // View overrides plugin fallback for chart legends (computed in loadConfig)
      const showChartLegends = cfg.showChartLegends;
      renderTiles({ app: this.app, hoverParent: this, containerEl: this.containerEl, rows: rowsToRender, columnDefs, propertiesOrder, groupByProp, numericPids, showLegends: showChartLegends, ignoreNulls, chartTopN });
  }

  private loadConfig(): {
    propertiesOrder: string[];
    maxGroups?: number;
    allEntries: any[];
    statsTiles: any[];
    statsColumns: any[];
    groupByProp?: string;
    ignoreNulls: boolean;
    chartTopN: number;
    showChartLegends: boolean;
  } {

    const rawOrder = this.config.getOrder?.();
    const propertiesOrder: string[] = Array.isArray(rawOrder) ? rawOrder.filter(p => typeof p === 'string').map(String) : [];

    const limitVal = this.config.get('limit');
    const rawMax = Number.isFinite(Number(limitVal)) ? Math.max(0, Math.floor(Number(limitVal))) : undefined;
    const maxGroups = typeof rawMax === 'number' ? Math.min(500, rawMax) : undefined;

    const allEntries = this.data.groupedData.flatMap(g => g.entries);

    const rawStats = this.config.get('stats');
    const { tiles: statsTiles, columns: statsColumns } = parseStatsConfig(rawStats);

    const groupByConf = this.config.get('groupBy') as any;
    const groupByProp: string | undefined = typeof groupByConf === 'string' ? String(groupByConf) : (typeof groupByConf?.property === 'string' ? String(groupByConf.property) : undefined);

    const ignoreNulls = getBooleanConfig(this.config, 'ignoreNulls', false);
    const chartTopN = clampNumber(getNumberConfig(this.config, 'chartTopN', 6), 1, 10);
    const showChartLegends = getBooleanConfig(this.config, 'showChartLegends', false);

    return { propertiesOrder, maxGroups, allEntries, statsTiles, statsColumns, groupByProp, ignoreNulls, chartTopN, showChartLegends };
  }
}

