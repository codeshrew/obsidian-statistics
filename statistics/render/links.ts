import type { App, HoverParent } from 'obsidian';

export function renderTextWithWikiLinks(app: App, hoverParent: HoverParent, container: HTMLElement, text: string): void {
  const parts = String(text).split(/(\[\[[^\]]+\]\])/g);
  for (const part of parts) {
    if (!part) continue;
    const m = part.match(/^\[\[([^\]]+)\]\]$/);
    if (m) {
      const inner = m[1];
      const [linktextRaw, aliasRaw] = inner.split('|');
      const linktext = (linktextRaw || '').trim();
      const alias = (aliasRaw || linktext)!.trim();
      const a = container.createEl('a', { text: alias });
      a.onClickEvent((evt: MouseEvent) => {
        if (evt.button !== 0 && evt.button !== 1) return;
        evt.preventDefault();
        const mod = (window as any).Keymap?.isModEvent ? (window as any).Keymap.isModEvent(evt as any) : (evt.metaKey || evt.ctrlKey);
        app.workspace.openLinkText(linktext, '', mod);
      });
      a.addEventListener('mouseover', (evt) => {
        (app.workspace as any).trigger('hover-link', {
          event: evt,
          source: 'bases',
          hoverParent,
          targetEl: a,
          linktext,
        });
      });
    } else {
      container.appendText(part);
    }
  }
}

export function openByLabel(app: App, rawLabel: string, evt: MouseEvent | any): void {
  try {
    const s = String(rawLabel).trim();
    if (!s || /^(other|null|undefined|\(empty\))$/i.test(s)) return;
    const tagTokens: string[] = [];
    const hashRe = /#([A-Za-z0-9_\/\-]+)/g; let m1: RegExpExecArray | null;
    while ((m1 = hashRe.exec(s))) tagTokens.push(`#${m1[1]}`);
    const tagRe = /\btag:\s*#?([A-Za-z0-9_\/\-]+)/gi; let m2: RegExpExecArray | null;
    while ((m2 = tagRe.exec(s))) tagTokens.push(`#${m2[1]}`);
    if (tagTokens.length > 0 || s.startsWith('#')) {
      const tags = tagTokens.length > 0 ? Array.from(new Set(tagTokens)) : [s];
      const query = tags.map(t => `tag:${t}`).join(' ');
      try {
        const gs = (app as any).internalPlugins?.getPluginById?.('global-search')?.instance;
        if (gs?.openGlobalSearch) { gs.openGlobalSearch(query); return; }
      } catch {}
      try {
        let leaf = (app as any).workspace?.getLeavesOfType?.('search')?.[0];
        if (!leaf) {
          leaf = (app as any).workspace?.getRightLeaf?.(true);
          leaf?.setViewState?.({ type: 'search' });
        }
        const view = leaf?.view;
        if (view?.setQuery) view.setQuery(query);
      } catch {}
      return;
    }
    const m = s.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
    const target = m ? m[1] : s;
    if (!target) return;
    const mod = !!(evt && (evt.metaKey || evt.ctrlKey));
    (app as any).workspace.openLinkText(target, '', mod);
  } catch {}
}

