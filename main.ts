import { Plugin } from 'obsidian';
import { log } from './utils';
import { StatisticsView } from './statistics-view';

export const StatisticsViewType = 'statistics-view';

export default class StatisticsViewPlugin extends Plugin {

	async onload() {
		log('loading plugin')

		this.registerBasesView(StatisticsViewType, {
			name: "Statistics View",
			icon: 'lucide-pie-chart',
			factory: (controller, containerEl) => {
				return new StatisticsView(controller, containerEl)
			},
			options: () => ([
				{ type: 'toggle', displayName: 'Show chart legends', key: 'showChartLegends', default: false },
				{ type: 'toggle', displayName: 'Ignore null/empty values (chips/charts)', key: 'ignoreNulls', default: false },
				{ type: 'slider', displayName: 'Chart top-N before "Other"', key: 'chartTopN', default: 6, min: 1, max: 10, step: 1 },
			]),
		});
	}
}
