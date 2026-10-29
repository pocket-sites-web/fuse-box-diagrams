// Draws a fuse box as an SVG string from a layout (slot rows) and the box's fuses.
// Server-rendered so the diagram shows without JavaScript; public/fusebox.js adds the interaction.
import { fuseColour, type Box, type Fuse, type Layout, type PartType } from './data';

const SIZE: Record<PartType, [number, number]> = {
  micro2: [36, 58], mini: [44, 64], atm: [50, 72], maxi: [70, 80], jcase: [60, 60], relay: [80, 62],
};
const MONO = 'IBM Plex Mono, ui-monospace, monospace';
let uid = 0;
// Gradient ids must be unique per SVG: a gradient defined inside a hidden SVG doesn't paint anywhere.
const scope = (svg: string) => { const n = ++uid; return svg.replace(/fb-(gloss|metal|relay|sock|ribs)/g, `fb${n}-$1`); };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

export const DEFS = `<defs>
<linearGradient id="fb-gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="fb-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".5" stop-color="#f1f3f5"/><stop offset="1" stop-color="#9aa1a8"/></linearGradient>
<linearGradient id="fb-relay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4148"/><stop offset="1" stop-color="#22272c"/></linearGradient>
<linearGradient id="fb-sock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".9"/><stop offset="1" stop-color="#0d1013"/></linearGradient>
<pattern id="fb-ribs" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="1" height="8" fill="#fff" opacity=".025"/></pattern>
</defs>`;

export function partSvg(type: PartType, x: number, y: number, amps: number | null, label: string): string {
  const [w, h] = SIZE[type];
  if (type === 'relay') {
    const cx = x + w / 2;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#fb-relay)" stroke="#4b535b"/>`
      + `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="12" rx="3" fill="#fff" opacity=".06"/>`
      + `<path d="M${cx - 14} ${y + h - 17} q3.5 -7 7 0 q3.5 -7 7 0 q3.5 -7 7 0 q3.5 -7 7 0" fill="none" stroke="#8b949c" stroke-width="1.6" stroke-linecap="round"/>`
      + `<text x="${cx}" y="${y + h / 2 - 1}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="15" fill="#d7dde2">${esc(label)}</text>`;
  }
  const c = fuseColour(type, amps);
  if (!c) return `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="5" fill="none" stroke="#3a4249" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  const col = c[0], ink = lum(col) > 0.62 ? '#2a2200' : '#fff';
  if (type === 'jcase') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${col}"/>`
      + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#000" opacity=".12"/>`
      + `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="5" fill="${col}"/>`
      + `<rect x="${x + 10}" y="${y + 8}" width="${w - 20}" height="16" rx="4" fill="#fff" opacity=".28"/>`
      + `<path d="M${x + 14} ${y + 16} h6 l3 -4 l4 8 l4 -8 l4 8 l3 -4 h6" fill="none" stroke="#e9edf0" stroke-width="2" opacity=".9"/>`
      + `<text x="${x + w / 2}" y="${y + h - 14}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="19" fill="${ink}">${amps}</text>`
      + `<rect x="${x + 2}" y="${y + 2}" width="${w * 0.35}" height="${h - 4}" rx="5" fill="url(#fb-gloss)"/>`;
  }
  // Blade fuses, front view: darker grip band with the rating, see-through body showing the element.
  const lx = x + w * 0.24, rx = x + w * 0.76 - 6, ty = y + h * 0.44, by = y + h * 0.9, my = y + h * 0.6;
  const fs = String(amps).length > 2 ? 11.5 : type === 'micro2' ? 12 : 14;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${col}" opacity=".95"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.36}" rx="6" fill="#000" opacity=".16"/>`
    + `<rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.06}" fill="#000" opacity=".12"/>`
    + `<rect x="${x + 5}" y="${y + h * 0.42}" width="${w - 10}" height="${h * 0.5}" rx="3" fill="#fff" opacity="${lum(col) > 0.62 ? 0.25 : 0.14}"/>`
    + `<rect x="${lx}" y="${ty}" width="6" height="${by - ty}" rx="1" fill="url(#fb-metal)" opacity=".9"/>`
    + `<rect x="${rx}" y="${ty}" width="6" height="${by - ty}" rx="1" fill="url(#fb-metal)" opacity=".9"/>`
    + `<path d="M${lx + 6} ${my} l3 -4 l3 8 l3 -8 l3 8 l3 -4 L${rx} ${my}" fill="none" stroke="#e9edf0" stroke-width="1.5" stroke-linejoin="round" opacity=".95"/>`
    + `<text x="${x + w / 2}" y="${y + h * 0.255}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="${fs}" fill="${ink}">${amps}</text>`
    + `<rect x="${x + 2}" y="${y + 2}" width="${w * 0.32}" height="${h - 4}" rx="4" fill="url(#fb-gloss)"/>`;
}

/** A single part on its own, for the detail panel. */
export function partIcon(f: Fuse): string {
  const [w, h] = SIZE[f.type];
  return scope(`<svg viewBox="-6 -6 ${w + 12} ${h + 12}" width="${f.type === 'relay' ? 96 : 64}" height="${f.type === 'relay' ? 78 : 90}" aria-hidden="true">${DEFS}${partSvg(f.type, 0, 0, f.amps, f.slot)}</svg>`);
}

export function boxSvg(box: Box, layout: Layout): string {
  const bySlot = new Map(box.fuses.map((f) => [f.slot, f]));
  const W = 560, padTop = 58, rowGap = 26, gap = 12;
  const rows = layout.rows.map((r) => r.map((id) => bySlot.get(id) ?? ({ slot: id, amps: null, type: 'mini', circuit: 'Not used' } as Fuse)));
  const rowsH = rows.map((r) => Math.max(...r.map((f) => SIZE[f.type][1])));
  const H = padTop + rowsH.reduce((a, b) => a + b + rowGap, 0) + 18;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(box.box)} diagram">${DEFS}`;
  s += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="18" fill="#23292f" stroke="#363e46" stroke-width="2"/>`;
  s += `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="12" fill="#1a1f24"/><rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="12" fill="url(#fb-ribs)"/>`;
  for (const [sx, sy] of [[28, 28], [W - 28, 28], [28, H - 28], [W - 28, H - 28]])
    s += `<circle cx="${sx}" cy="${sy}" r="6.5" fill="#2e353c" stroke="#11151a" stroke-width="1.5"/><path d="M${sx - 3.5} ${sy}h7M${sx} ${sy - 3.5}v7" stroke="#11151a" stroke-width="1.6"/>`;
  s += `<text x="46" y="36" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="14" letter-spacing="1.6" fill="#6f7980">${esc(box.box.toUpperCase())}</text>`;
  s += `<text x="${W - 46}" y="36" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1" fill="#6f7980">▲ FRONT</text>`;
  if (layout.puller) {
    const px = W - 74, py = H - 100;
    s += `<path d="M${px} ${py} h22 v12 l-5 6 v44 a6 6 0 0 1 -12 0 v-44 l-5 -6z" fill="#e9ecef" opacity=".9"/><rect x="${px + 7}" y="${py + 22}" width="8" height="34" rx="2" fill="#c9ced3"/>`
      + `<text x="${px + 11}" y="${py + 82}" text-anchor="middle" font-family="${MONO}" font-size="8.5" fill="#6f7980">PULLER</text>`;
  }
  let y = padTop;
  rows.forEach((row, ri) => {
    const rowW = row.reduce((a, f) => a + SIZE[f.type][0], 0) + gap * (row.length - 1);
    let x = (W - rowW) / 2;
    for (const f of row) {
      const [w, h] = SIZE[f.type];
      const yy = y + (rowsH[ri] - h);
      const what = f.type === 'relay' ? 'Relay' : 'Fuse';
      s += `<g class="slot" data-slot="${esc(f.slot)}" tabindex="0" role="button" aria-label="${what} ${esc(f.slot)}: ${esc(f.circuit)}${f.amps ? `, ${f.amps} amps` : ''}">`
        + `<rect x="${x - 4}" y="${yy - 4}" width="${w + 8}" height="${h + 8}" rx="8" fill="url(#fb-sock)" stroke="#000"/>`
        + `<rect class="ring" x="${x - 7}" y="${yy - 7}" width="${w + 14}" height="${h + 14}" rx="10" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`
        + `<g class="part">${partSvg(f.type, x, yy, f.amps, f.slot)}</g>`
        + (f.type === 'relay' ? '' : `<text class="num" x="${x + w / 2}" y="${yy + h + 17}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="12" fill="#7d878f">${esc(f.slot)}</text>`)
        + `</g>`;
      x += w + gap;
    }
    y += rowsH[ri] + rowGap;
  });
  return scope(s + '</svg>');
}

// Top-view truck/car outline with a pin where the box is. Front at the top, driver on the left (US).
const PINS: Record<string, [number, number]> = {
  'driver-footwell': [42, 112], 'passenger-footwell': [78, 112], 'engine-driver': [38, 46], 'engine-passenger': [82, 46],
  'dash-driver-end': [28, 100], 'dash-passenger-end': [92, 100], 'glovebox': [76, 102], 'trunk': [60, 196], 'under-seat': [44, 132],
};
export function locatorSvg(locator: string): string {
  const [px, py] = PINS[locator] ?? [60, 60];
  return `<svg width="56" height="104" viewBox="0 0 120 224" aria-hidden="true">
<rect x="16" y="20" width="10" height="30" rx="3" fill="var(--muted)" opacity=".5"/><rect x="94" y="20" width="10" height="30" rx="3" fill="var(--muted)" opacity=".5"/>
<rect x="16" y="160" width="10" height="30" rx="3" fill="var(--muted)" opacity=".5"/><rect x="94" y="160" width="10" height="30" rx="3" fill="var(--muted)" opacity=".5"/>
<rect x="22" y="6" width="76" height="212" rx="16" fill="var(--bg)" stroke="var(--ink)" stroke-width="3"/>
<path d="M28 78 L92 78 L86 96 L34 96Z" fill="var(--line)" stroke="var(--ink)" stroke-width="2"/>
<rect x="30" y="98" width="60" height="44" rx="4" fill="none" stroke="var(--ink)" stroke-width="2" opacity=".5"/>
<rect x="30" y="148" width="60" height="62" rx="3" fill="none" stroke="var(--ink)" stroke-width="2"/>
<path d="M60 14v10M55 19l5-5 5 5" stroke="var(--muted)" stroke-width="2" fill="none"/>
<circle class="pin-pulse" cx="${px}" cy="${py}" r="13" fill="var(--accent)" opacity=".3"/>
<circle cx="${px}" cy="${py}" r="7" fill="var(--accent)" stroke="var(--ink)" stroke-width="2"/></svg>`;
}
