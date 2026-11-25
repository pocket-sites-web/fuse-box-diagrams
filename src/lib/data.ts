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

// ---- Year-to-year comparison -------------------------------------------------------------
const fuseKey = (b: Box, f: Fuse) => `${b.short}|${f.slot}`;
const fingerprint = (p: YearPage) =>
  JSON.stringify(p.boxes.map((b) => [b.short, b.fuses.map((f) => [f.slot, f.amps, f.type, f.circuit.toLowerCase(), f.only ?? ''])]));

export interface YearRun { from: number; to: number; first: YearPage }

// Consecutive years whose fuse boxes are identical, oldest first.
export function yearRuns(m: Model): YearRun[] {
  const ys = [...m.years].sort((a, b) => a.year - b.year);
  const runs: YearRun[] = [];
  for (const p of ys) {
    const r = runs[runs.length - 1];
    if (r && r.to === p.year - 1 && fingerprint(r.first) === fingerprint(p)) r.to = p.year;
    else runs.push({ from: p.year, to: p.year, first: p });
  }
  return runs;
}

// A year page whose fuses are identical to the year before repeats that page word for word.
// It stays on the site for visitors but is noindexed so Google indexes one page per layout.
export function sameAsYear(m: Model, p: YearPage): number | null {
  const run = yearRuns(m).find((r) => p.year >= r.from && p.year <= r.to)!;
  return run.from === p.year ? null : run.from;
}

export interface FuseChange { box: string; slot: string; kind: 'added' | 'removed' | 'amps' | 'circuit'; before?: string; after?: string }

// What differs between two years: fuses added, removed, re-rated or given a new job.
export function compareYears(prev: YearPage, cur: YearPage): FuseChange[] {
  const a = new Map(prev.boxes.flatMap((b) => b.fuses.map((f) => [fuseKey(b, f), { b, f }] as const)));
  const c = new Map(cur.boxes.flatMap((b) => b.fuses.map((f) => [fuseKey(b, f), { b, f }] as const)));
  const out: FuseChange[] = [];
  const amps = (f: Fuse) => (f.amps ? `${f.amps}A` : f.type === 'relay' ? 'relay' : '–');
  for (const [k, { b, f }] of c) {
    const o = a.get(k);
    if (!o) out.push({ box: b.short, slot: f.slot, kind: 'added', after: `${f.circuit} (${amps(f)})` });
    else if (o.f.circuit.toLowerCase() !== f.circuit.toLowerCase()) out.push({ box: b.short, slot: f.slot, kind: 'circuit', before: o.f.circuit, after: f.circuit });
    else if (o.f.amps !== f.amps) out.push({ box: b.short, slot: f.slot, kind: 'amps', before: amps(o.f), after: amps(f) });
  }
  for (const [k, { b, f }] of a) if (!c.has(k)) out.push({ box: b.short, slot: f.slot, kind: 'removed', before: `${f.circuit} (${amps(f)})` });
  return out;
}

// True when two years list their boxes so differently that a fuse-by-fuse comparison means nothing
// (different box names, or more than half the fuses differ).
export function isNewLayout(prev: YearPage, cur: YearPage): boolean {
  const names = (p: YearPage) => p.boxes.map((b) => b.short).sort().join('|');
  if (names(prev) !== names(cur)) return true;
  const total = cur.boxes.reduce((a, b) => a + b.fuses.length, 0);
  return compareYears(prev, cur).length > total / 2;
}
