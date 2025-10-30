// Minimal shared types for grouped data
export interface BaseFile {
  name?: string;
  path?: string;
  frontmatter?: any;
  metadata?: any;
}

export interface BaseEntry {
  getValue: (pid: string) => any;
  file?: BaseFile;
  note?: any;
  metadata?: any;
}

export interface Group {
  entries: BaseEntry[];
  label?: string;
  value?: any;
  key?: any;
}
