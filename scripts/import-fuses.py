"""Merge a scraper fuse export into data/fuses.json.

Usage: python scripts/import-fuses.py path/to/fuse-test.json

The export has one record per box per manual (see README). This script:
- skips boxes with no fuses (e.g. US Nissan manuals, which print no fuse tables);
- fills locator, layout, printed page and per-slot fuse type from BOXES below,
  because the manuals don't state blade sizes and the layouts are drawn by hand;
- turns "only:..." tags into an `only` note (a slot can have two ratings by engine or trim);
- replaces any existing records for the same make/model/year/box.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Hand-checked per box: (make, model, year, box_key) -> settings. Only boxes listed here are imported.
BOXES = {
    ("Toyota", "Camry", 2013, "engine"): dict(locator="engine-driver", layout="toyota-camry-2012-engine", page_offset=-2),
    ("Toyota", "Camry", 2013, "engine_cover"): dict(locator="engine-driver", layout="toyota-camry-2012-engine-cover", page_offset=-2),
    ("Toyota", "Camry", 2013, "cabin"): dict(locator="dash-driver-end", layout="toyota-camry-2012-cabin", page_offset=-2),
}


def layout_types(layout):
    if "slots" in layout:
        return {s["s"]: s["t"] for s in layout["slots"] if "s" in s}
    return {}


def main(src):
    export = json.loads(Path(src).read_text(encoding="utf-8"))
    layouts = json.loads((ROOT / "data/layouts.json").read_text(encoding="utf-8"))
    out_path = ROOT / "data/fuses.json"
    current = json.loads(out_path.read_text(encoding="utf-8"))
    key = lambda b: (b["make"], b["model"], b["year"], b["box_key"])

    imported = []
    for b in export:
        cfg = BOXES.get(key(b))
        if not cfg or not b["fuses"]:
            print("skip", key(b), f"({len(b['fuses'])} fuses)")
            continue
        types = layout_types(layouts[cfg["layout"]])
        fuses = []
        for f in b["fuses"]:
            tags = [t for t in (f.get("tags") or []) if not t.startswith("only:")]
            only = [t[5:] for t in (f.get("tags") or []) if t.startswith("only:")]
            amps = f["amps"]
            if amps is not None and float(amps).is_integer():
                amps = int(amps)
            row = {
                "slot": f["slot"],
                "amps": amps,
                "type": f.get("type") or types.get(f["slot"], "mini"),
                "circuit": f["circuit"],
                "tags": " ".join(t.replace("_", " ") for t in tags),
            }
            if only:
                row["only"] = " / ".join(only)
            fuses.append(row)
        page = b.get("page")
        if isinstance(page, int):
            page = str(page + cfg.get("page_offset", 0))
        imported.append({
            "make": b["make"], "model": b["model"], "year": b["year"],
            "box_key": b["box_key"], "box": b["box"], "short": b["short"],
            "location": b["location"], "locator": cfg["locator"], "layout": cfg["layout"],
            "source_name": b["source_name"], "page": page or "",
            "type_note": "Fuse sizes are read from the manual's drawing. Check the old fuse before buying.",
            "fuses": fuses,
        })
        print("import", key(b), len(fuses), "rows")

    keys = {key(b) for b in imported}
    merged = [b for b in current if key(b) not in keys] + imported
    out_path.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
