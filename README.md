# Statistics View

Rich statistics and charts for Obsidian Bases.

This plugin adds a "Statistics View" to Bases, helping you explore grouped data with compact charts and summary chips.

## Features

- **Doughnut charts** per property, with an automatic "Other" bucket
- **Legend toggle** and **Top‑N slider** for compact visual summaries
- **Inline summary chips** showing counts and percentages
- **Tiles layout only** (fast and focused)

## Usage

1. Open or create a Base in Obsidian.
2. Add a new view and choose "Statistics View".
3. Configure the options in the view sidebar.

### Options

- **Show chart legends**: Toggle chart legends under each chart
- **Ignore null/empty values**: Exclude empty values from charts/lists
- **Chart top‑N before "Other"**: Choose how many categories to show before aggregating the rest into "Other" (1–10, default 6)

These settings are saved into the Base’s `.base` file and reloaded automatically.

## Requirements

- Obsidian v1.10.0 or newer

## Developers

### Run locally

- Clone the repo into `<Vault>/.obsidian/plugins/statistics-view/`
- Install deps: `npm install`
- Dev build (watch): `npm run dev`
- Production build: `npm run build`
- Reload Obsidian and enable in Settings → Community plugins.

### Release checklist

- Update `manifest.json` version (SemVer) and `minAppVersion` if needed.
- Update `versions.json` mapping: `{ "<version>": "<min-obsidian-version>" }`.
- Tag and create a GitHub release with the exact version (no leading `v`).
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release.
