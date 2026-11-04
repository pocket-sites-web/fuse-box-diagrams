"""Merge a scraper fuse export into data/fuses.json.

Usage: python scripts/import-fuses.py path/to/fuses-all.json

Boxes listed in BOXES get a hand-traced layout. Every other box that passes the quality checks
below is imported as a slot map (layout "", type "fuse"): the page then lists fuses in the manual's
order and says it is not a picture of the real box.

The export has one record per box per manual (see README). This script:
- skips boxes with no fuses (e.g. US Nissan manuals, which print no fuse tables);
- fills locator, layout, printed page and per-slot fuse type from BOXES below,
  because the manuals don't state blade sizes and the layouts are drawn by hand;
- turns "only:..." tags into an `only` note (a slot can have two ratings by engine or trim);
- replaces any existing records for the same make/model/year/box.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Makes left out: Nissan (US manuals print no fuse tables) and Honda (UK manuals, merged multi-fuse tables).
MAKES = {"Toyota", "Lexus", "Hyundai", "Kia"}
SKIP_MODELS = {"IONIQ 5 ROBOTAXI"}

# Manuals print model names in mixed styles; one name per model so "KONA Electric" and "Kona Electric" share a page.
MODEL_NAMES = {"ESh": "ES Hybrid", "GSh": "GS Hybrid", "RXh": "RX Hybrid", "IS C": "IS C", "IS F": "IS F",
               "SANTA FE Plugin Hybrid": "Santa Fe Plug-in Hybrid", "IONIQ electric": "Ioniq Electric",
               "NEXO fuel cell": "Nexo Fuel Cell", "SANTA FE": "Santa Fe", "SANTA FE Hybrid": "Santa Fe Hybrid", "Elantra GT": "Elantra GT"}


def model_name(m):
    if m in MODEL_NAMES:
        return MODEL_NAMES[m]
    return " ".join(w.capitalize() if w.isalpha() and w.isupper() and len(w) > 3 else w for w in m.split())


SHORTS = {"Inside, dashboard (driver's side)": "Driver's side panel", "Inside, dashboard (passenger side)": "Passenger side panel",
          "Inside, dashboard (left side)": "Left side panel", "Inside, dashboard (right side)": "Right side panel",
          "Inside, dashboard": "Interior panel"}


def locator_for(key):
    if key.startswith("engine"):
        return "engine-passenger" if key == "engine_right" else "engine-driver" if key == "engine_left" else "engine"
    if key in ("cabin_driver", "cabin_left") or key.startswith("cabin_driver"):
        return "dash-driver-end"
    if key in ("cabin_passenger", "cabin_right"):
        return "dash-passenger-end"
    if key == "cargo":
        return "trunk"
    if key.startswith("cabin"):
        return "dash"
    return ""


def quality(b):
    """Reasons to hold a box back. Bad parses show as long slot names or a slot listed twice with
    different ratings and no note saying which version gets which."""
    amp_rows = [f for f in b["fuses"] if f["amps"]]
    if len(amp_rows) < 5:
        return "under 5 rated fuses"
    if any(len(f["slot"]) > 24 or ":" in f["slot"] for f in b["fuses"]):
        return "garbled slot names"
    if any(f["amps"] and not (1 <= f["amps"] <= 300) for f in b["fuses"]):
        return "amps out of range"
    seen = {}
    for f in b["fuses"]:
        k = (f["slot"], f["amps"], f["circuit"])
        # Same circuit at two ratings (e.g. Toyota ALT 120A or 140A by engine) is a real variant.
        same_circuit = any(c == f["circuit"] for _, _, c in seen.get(f["slot"], ()))
        if f["slot"] in seen and k not in seen[f["slot"]] and not same_circuit and not any(t.startswith("only:") for t in f.get("tags") or []):
            return "duplicate slot " + f["slot"]
        seen.setdefault(f["slot"], set()).add(k)
    return None


def clean_location(loc, page):
    loc = loc.replace("; the drawing shows where.", ".").replace("See the drawing on the listed manual page.", "See the owner's manual.")
    return loc + (f" Page {page} of the owner's manual shows the exact spot." if page else "")


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

    imported, held = [], {}
    for b in export:
        if b["make"] not in MAKES or b["model"] in SKIP_MODELS:
            continue
        b = {**b, "model": model_name(b["model"])}
        cfg = BOXES.get(key(b))
        why = None if cfg else quality(b)
        if why:
            held[why.split(" ")[0]] = held.get(why.split(" ")[0], 0) + 1
            continue
        traced = bool(cfg)
        cfg = cfg or dict(locator=locator_for(b["box_key"]), layout="")
        types = layout_types(layouts[cfg["layout"]]) if traced else {}
        fuses, seen = [], set()
        for f in b["fuses"]:
            if (f["slot"], f["amps"], f["circuit"]) in seen:
                continue
            seen.add((f["slot"], f["amps"], f["circuit"]))
            tags = [t for t in (f.get("tags") or []) if not t.startswith("only:")]
            only = [t[5:] for t in (f.get("tags") or []) if t.startswith("only:")]
            amps = f["amps"]
            if amps is not None and float(amps).is_integer():
                amps = int(amps)
            row = {
                "slot": f["slot"],
                "amps": amps,
                "type": f.get("type") or (types.get(f["slot"], "mini") if traced else "fuse"),
                "circuit": (f["circuit"] or "").strip() or ("Not named in the manual" if f["amps"] else "Not used"),
                "tags": " ".join(t.replace("_", " ") for t in tags),
            }
            if only:
                row["only"] = " / ".join(only)
            elif sum(1 for g in b["fuses"] if g["slot"] == f["slot"] and g["circuit"] == f["circuit"] and g["amps"] != f["amps"]):
                row["only"] = "some versions (check the rating on the old fuse)"
            fuses.append(row)
        page = b.get("printed_page") if not traced else b.get("page")
        if isinstance(page, int):
            page = str(page + (cfg.get("page_offset", 0) if traced else 0))
        imported.append({
            "make": b["make"], "model": b["model"], "year": b["year"],
            "box_key": b["box_key"], "box": b["box"], "short": b["short"],
            "location": clean_location(b["location"], page) if not traced else b["location"], "locator": cfg["locator"], "layout": cfg["layout"],
            "source_name": b["source_name"], "page": page or "",
            **({"type_note": "Fuse sizes are read from the manual's drawing. Check the old fuse before buying."} if traced else {}),
            "fuses": fuses,
        })

    # One record per make/model/year/box: when two manuals cover the same year, keep the fuller table.
    best = {}
    for b in imported:
        k = key(b)
        if k not in best or (b["layout"] and not best[k]["layout"]) or (bool(b["layout"]) == bool(best[k]["layout"]) and len(b["fuses"]) > len(best[k]["fuses"])):
            best[k] = b
    imported = list(best.values())
    print(f"imported {len(imported)} boxes ({sum(1 for b in imported if b['layout'])} traced), held back: {held}")

    # Tab names: short and distinct on each page.
    pages = {}
    for b in imported:
        if not b["layout"]:
            b["short"] = SHORTS.get(b["short"], b["short"])
            if b["short"] == "See drawing":
                b["short"] = b["box"]
        pages.setdefault((b["make"], b["model"], b["year"]), []).append(b)
    for bs in pages.values():
        shorts = [b["short"] for b in bs]
        for b in bs:
            extra = re.findall(r"\(([^)]+)\)", b["box"])
            if shorts.count(b["short"]) > 1 and extra:
                b["short"] = f'{b["short"]} ({re.sub(r"(?i) fuse (box|panel)$", "", extra[-1])})'

    # A traced layout also fits other years of the same generation when the slot list is identical.
    traced = [b for b in current + imported if b["layout"]]
    reused = 0
    for b in imported:
        if b["layout"]:
            continue
        slots = sorted({f["slot"] for f in b["fuses"]})
        for t in traced:
            if (t["make"], t["model"], t["box_key"]) == (b["make"], b["model"], b["box_key"]) and abs(t["year"] - b["year"]) <= 4 \
                    and sorted({f["slot"] for f in t["fuses"]}) == slots:
                types = layout_types(layouts[t["layout"]])
                b.update(layout=t["layout"], locator=t["locator"], type_note=t.get("type_note"))
                for f in b["fuses"]:
                    f["type"] = types.get(f["slot"], "mini")
                reused += 1
                break
    print("traced layouts reused for", reused, "boxes")

    keys = {key(b) for b in imported}
    merged = [b for b in current if key(b) not in keys] + imported
    out_path.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
