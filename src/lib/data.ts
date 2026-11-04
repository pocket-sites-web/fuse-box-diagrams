import fs from 'node:fs';
import path from 'node:path';

// `fuse`: the manual gives no size or type (untraced boxes), so we draw a plain labelled tile.
export type PartType = 'micro2' | 'mini' | 'atm' | 'maxi' | 'jcase' | 'cartridge' | 'relay' | 'fuse';

export interface Fuse {
  slot: string;
  amps: number | null;
  type: PartType;
  circuit: string;
  tags?: string;
  only?: string; // e.g. "3.5 L V6 engine": the slot has another rating on other versions
}

// One fuse box for one vehicle year, as exported from the scraper (data/fuses.json).
export interface Box {
  make: string;
  model: string;
  year: number;
  variant?: string;
  box_key: string;
  box: string;
  short: string;
  location: string;
  locator: string;
  layout: string; // '' = not traced yet: drawn as a numbered slot map
  source_name: string;
  page: string;
  sample?: boolean;
  type_note?: string;
  fuses: Fuse[];
}

export interface Layout {
  rows?: string[][];
  slots?: { s?: string; x: number; y: number; t: PartType; rot?: boolean }[];
  sx?: number;
  sy?: number;
  puller?: boolean;
  grid?: boolean;
}

export interface YearPage {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: number;
  boxes: Box[];
  sample: boolean;
}

export interface Model {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  years: YearPage[];
}

export interface Make {
  make: string;
  makeSlug: string;
  models: Model[];
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.resolve('data', f), 'utf8'));

let layouts: Record<string, Layout> | null = null;
export function getLayout(id: string): Layout {
  if (!id) return { grid: true };
  layouts ??= read<Record<string, Layout>>('layouts.json');
  const l = layouts[id];
  if (!l) throw new Error(`Missing layout ${id}`);
  return l;
}

let cache: Make[] | null = null;
export function getMakes(): Make[] {
  if (cache) return cache;
  const pages = new Map<string, YearPage>();
  for (const b of read<Box[]>('fuses.json')) {
    const key = `${b.make}|${b.model}|${b.year}`;
    if (!pages.has(key))
      pages.set(key, { make: b.make, makeSlug: slugify(b.make), model: b.model, modelSlug: slugify(b.model), year: b.year, boxes: [], sample: false });
    const p = pages.get(key)!;
    p.boxes.push(b);
    p.sample ||= !!b.sample;
  }
  const makes = new Map<string, Make>();
  const models = new Map<string, Model>();
  for (const p of pages.values()) {
    const mk = `${p.make}|${p.model}`;
    if (!models.has(mk)) {
      const m: Model = { make: p.make, makeSlug: p.makeSlug, model: p.model, modelSlug: p.modelSlug, years: [] };
      models.set(mk, m);
      if (!makes.has(p.make)) makes.set(p.make, { make: p.make, makeSlug: p.makeSlug, models: [] });
      makes.get(p.make)!.models.push(m);
    }
    models.get(mk)!.years.push(p);
  }
  for (const m of models.values()) m.years.sort((a, b) => b.year - a.year);
  cache = [...makes.values()]
    .map((mk) => ({ ...mk, models: mk.models.sort((a, b) => a.model.localeCompare(b.model)) }))
    .sort((a, b) => a.make.localeCompare(b.make));
  return cache;
}

export const getModels = () => getMakes().flatMap((m) => m.models);
export const getYearPages = () => getModels().flatMap((m) => m.years);

export const yearRange = (m: Model) => {
  const ys = m.years.map((y) => y.year);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return lo === hi ? `${lo}` : `${lo} to ${hi}`;
};

export const TYPE_NAMES: Record<PartType, string> = {
  micro2: 'Micro2 blade',
  mini: 'Mini blade',
  atm: 'Standard blade (ATO)',
  maxi: 'Maxi blade',
  jcase: 'J-case cartridge',
  cartridge: 'Cartridge fuse',
  relay: 'Relay',
  fuse: 'Fuse (size not listed)',
};

// Industry colour codes by amp rating.
const BLADE: Record<string, [string, string]> = {
  1: ['#1d1d1d', 'Black'], 2: ['#9aa0a6', 'Grey'], 3: ['#7b4fb8', 'Violet'], 4: ['#e58cb4', 'Pink'],
  5: ['#C9A66B', 'Tan'], 7.5: ['#7A4B2A', 'Brown'], 10: ['#D3222A', 'Red'], 15: ['#1E5FD0', 'Blue'],
  20: ['#F2D21B', 'Yellow'], 25: ['#E8E2D2', 'Clear'], 30: ['#2E9E48', 'Green'], 35: ['#3aa8b8', 'Blue-green'], 40: ['#EE7A1E', 'Orange'],
};
const MAXI: Record<string, [string, string]> = {
  20: ['#F2D21B', 'Yellow'], 30: ['#2E9E48', 'Green'], 40: ['#EE7A1E', 'Orange'], 50: ['#D3222A', 'Red'],
  60: ['#1E5FD0', 'Blue'], 70: ['#7A4B2A', 'Brown'], 80: ['#E8E2D2', 'Clear'],
};
const JCASE: Record<string, [string, string]> = {
  20: ['#2E7FD6', 'Blue'], 25: ['#ECECEC', 'White'], 30: ['#E35A9A', 'Pink'], 40: ['#3FA34D', 'Green'],
  50: ['#CC2B2B', 'Red'], 60: ['#E9C21A', 'Yellow'],
};
export function fuseColour(type: PartType, amps: number | null): [string, string] | null {
  if (amps == null || type === 'relay' || type === 'fuse') return null;
  const table = type === 'jcase' || type === 'cartridge' ? JCASE : type === 'maxi' ? MAXI : BLADE;
  return table[String(amps)] ?? ['#b9b2a0', `${amps}A`];
}
export const LEGENDS = { blade: BLADE, jcase: JCASE };

export const isBlade = (t: PartType) => t === 'micro2' || t === 'mini' || t === 'atm' || t === 'maxi';

// Numbered slots sort by number; named slots (Hyundai, Kia) keep the manual's order.
export const isNumbered = (slots: string[]) => slots.every((s) => /^R?\d+[A-Z]?$/i.test(s));
export const sortSlots = (a: string, b: string) => {
  const ra = a.startsWith('R') ? 1 : 0, rb = b.startsWith('R') ? 1 : 0;
  return ra - rb || parseFloat(a.replace(/\D+/g, '')) - parseFloat(b.replace(/\D+/g, '')) || a.localeCompare(b);
};
