# Fuse box diagrams

Astro static site: clickable fuse box diagrams by year, make and model. Sister site to keyfobbatterysize.com. Deploys to Cloudflare Pages (build `npm run build`, output `dist`).

Plan: `niche-research/fuse-box/01-site-plan.md` in the project files.

## Before launch
Live on fuseboxdiagrams.com (launched 2026-11-05). In `src/lib/site.ts`, setting `PREVIEW = true` hides the site from search engines again. While `PREVIEW` is true every page is noindex, robots.txt blocks crawlers and a banner says the data is sample data.

## Data
Both files come from the vehicle-specs scraper export (first real box: 2013 Toyota Camry).

`data/fuses.json`: one record per fuse box per vehicle year.

```json
{
  "make": "Ford", "model": "F-150", "year": 2006,
  "box_key": "interior",            // stable key within the year: interior, hood, rear...
  "box": "Passenger compartment fuse panel",   // manual's name
  "short": "Interior panel",        // tab label
  "location": "Driver's footwell, left of the brake pedal, behind a cover.",
  "locator": "driver-footwell",     // pin on the outline: driver-footwell, passenger-footwell, engine-driver,
                                    // engine-passenger, dash-driver-end, dash-passenger-end, glovebox, trunk, under-seat
  "layout": "ford-f150-2004-interior",  // key into layouts.json (one layout is shared by many years)
  "source_name": "2006 Ford F-150 Owner's Guide", "page": "214",
  "sample": false,
  "fuses": [
    { "slot": "14", "amps": 10, "type": "mini", "circuit": "Radio", "tags": "stereo audio" },
    { "slot": "R1", "amps": null, "type": "relay", "circuit": "Accessory delay relay" }
  ]
}
```

`type` is one of `micro2`, `mini`, `atm`, `maxi`, `jcase`, `relay`. `tags` are optional search synonyms.

`data/layouts.json`: the physical arrangement of slots, as rows from the front of the box, drawn from the manual's diagram:

```json
{ "ford-f150-2004-interior": { "puller": true, "rows": [["1","2","3"], ["R1","R2"]] } }
```

Or, for a faithful copy of the manual's drawing, positions traced from the page image (drawing pixels, scaled by `sx`/`sy`). Slots without `s` are empty sockets; `t` sets the fuse size when the export doesn't:

```json
{ "toyota-camry-2012-cabin": { "sx": 2.2, "slots": [{ "s": "1", "x": 266, "y": 298, "t": "mini" }, { "x": 359, "y": 298, "t": "mini" }] } }
```

## Importing scraper data
`python scripts/import-fuses.py path/to/export.json` merges an export into `data/fuses.json`. Only boxes listed in its `BOXES` table are imported, because each one needs a layout, a locator and a page offset checked by hand.

## Code
- `src/lib/fusebox.ts` draws the boxes as SVG at build time.
- `src/scripts/fusebox.ts` adds tap-to-select, circuit search, the detail panel and table sync.
- Pages: `/[make]/`, `/[make]/[model]/`, `/[make]/[model]/[year]/`.
