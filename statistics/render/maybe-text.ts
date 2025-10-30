import type { App, HoverParent } from 'obsidian';
import { renderTextWithWikiLinks } from './links';

export function renderMaybeWikiText(app: App, hoverParent: HoverParent, container: HTMLElement, text: string): void {
  const s = String(text);
  if (s.includes('[[')) renderTextWithWikiLinks(app, hoverParent, container, s);
  else container.setText(s);
}
