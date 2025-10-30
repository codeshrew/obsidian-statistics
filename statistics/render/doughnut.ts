// Doughnut renderer for categorical summaries (lazy-load Chart.js)
let __chartModulePromise: Promise<any> | null = null;
let __chartRegistered = false;
async function getChartCtor(): Promise<any> {
  if (!__chartModulePromise) {
    __chartModulePromise = import('chart.js');
  }
  const mod = await __chartModulePromise as any;
  const Chart = mod.Chart ?? mod.default?.Chart ?? mod;
  if (!__chartRegistered && Chart && mod.ArcElement && mod.DoughnutController) {
    try {
      // Register minimum components + Colors plugin per Chart.js docs
      Chart.register(mod.ArcElement, mod.DoughnutController, mod.Tooltip, mod.Legend, mod.Title, mod.Colors);
      __chartRegistered = true;
    } catch {}
  }
  return Chart;
}

export type DoughnutItem = { label: string; value: number; color?: string };

export async function renderDoughnut(
  container: HTMLElement,
  title: string,
  items: DoughnutItem[],
  opts?: { size?: number; cutout?: string | number; showLegend?: boolean; onOpen?: (rawLabel: string, evt: MouseEvent | any) => void }
): Promise<void> {
  const size = opts?.size ?? 140;
  const cutout = opts?.cutout ?? '60%';
  const showLegend = opts?.showLegend ?? true;

  // Build canvas in a sized wrapper so legend has room
  const wrap = container.createDiv({ cls: 'bases-stats-doughnut' });
  const wrapHeight = showLegend ? size + 80 : size + 8;
  wrap.setAttr('style', `width:${size}px; height:${wrapHeight}px;`);
  const canvas = wrap.createEl('canvas');
  canvas.setAttr('style', 'width:100%; height:100%; display:block;');

  const labels = items.map(i => i.label);
  const data = items.map(i => Math.max(0, Number(i.value) || 0));

  // Destroy any previous chart in this container
  (wrap as any).__chart?.destroy?.();

  const ChartCtor = await getChartCtor();
  const chart = new ChartCtor(canvas.getContext('2d')!, {
    type: 'doughnut',
    data: {
      labels,
      // Colors plugin will auto-assign colors to the dataset
      datasets: [{ data, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout,
      onClick: (evt: any, elements: any[], chart: any) => {
        try {
          if (!opts?.onOpen) return;
          const els = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true) as any[];
          if (!els || !els.length) return;
          const idx = els[0].index ?? els[0]._index;
          const raw = labels[idx];
          if (!raw || /^other$/i.test(String(raw))) return;
          opts.onOpen(raw, evt);
        } catch {}
      },
      plugins: {
        legend: {
          display: showLegend,
          position: 'bottom',
          align: 'start',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 12,
            color: ((): string | undefined => {
              const c = getComputedStyle(document.documentElement).getPropertyValue('--text-normal').trim();
              return c || undefined;
            })(),
          },
          onClick: (evt: any, legendItem: any, legend: any) => {
            try {
              if (!opts?.onOpen) return;
              const idx = legendItem?.index;
              if (typeof idx !== 'number') return;
              const raw = labels[idx];
              if (!raw || /^other$/i.test(String(raw))) return;
              opts.onOpen(raw, evt);
            } catch {}
          },
        },
        title: {
          display: Boolean(title),
          text: title,
          align: 'start',
          color: ((): string | undefined => {
            const c = getComputedStyle(document.documentElement).getPropertyValue('--text-normal').trim();
            return c || undefined;
          })(),
          font: { weight: 'bold' },
          padding: { top: 4, bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.label ?? '';
              const v = ctx.parsed ?? 0;
              const total = ctx.chart._metasets[0].total || data.reduce((a:number,b:number)=>a+b,0);
              const pct = total > 0 ? Math.round((v/total)*100) : 0;
              return `${label}: ${v} (${pct}%)`;
            },
          },
        },
      },
    },
  });
  (wrap as any).__chart = chart;
}
