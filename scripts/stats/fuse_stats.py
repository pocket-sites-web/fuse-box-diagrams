"""Statistics for fuseboxdiagrams.com/statistics/.

Usage: python3 scripts/stats/fuse_stats.py RECALLS_TXT NHTSA_COMPLAINTS_DIR
  RECALLS_TXT: FLAT_RCL_POST_2010.txt from https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip
  NHTSA_COMPLAINTS_DIR: unzipped COMPLAINTS_RECEIVED_*.txt from https://static.nhtsa.gov/odi/ffdd/cmpl/
Writes src/data/stats/*.json and public/data/*.csv.
"""
import sys, os, json, csv, glob, statistics as S
from collections import Counter, defaultdict
import pandas as pd
UPPER = {"Bmw": "BMW", "Gmc": "GMC", "Mini": "MINI"}
def nice(x): return " ".join(UPPER.get(w, w) for w in x.title().split())

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'src', 'data', 'stats'); os.makedirs(OUT, exist_ok=True)
PUB = os.path.join(ROOT, 'public', 'data'); os.makedirs(PUB, exist_ok=True)
RCL, CMPL = sys.argv[1], sys.argv[2]
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w') as f: json.dump(obj, f, indent=1)

# ---------- 1. Recalls ----------
cols = ['RECORD_ID', 'CAMPNO', 'MAKETXT', 'MODELTXT', 'YEARTXT', 'MFGCAMPNO', 'COMPNAME', 'MFGNAME', 'BGMAN', 'ENDMAN', 'RCLTYPECD', 'POTAFF', 'ODATE', 'INFLUENCED_BY', 'MFGTXT', 'RCDATE', 'DATEA', 'RPNO', 'FMVSS', 'DESC_DEFECT', 'CONEQUENCE_DEFECT', 'CORRECTIVE_ACTION', 'NOTES', 'RCL_CMPT_ID', 'MFR_COMP_NAME', 'MFR_COMP_DESC', 'MFR_COMP_PTNO', 'DO_NOT_DRIVE', 'PARK_OUTSIDE']
r = pd.read_csv(RCL, sep='\t', header=None, names=cols, quoting=csv.QUOTE_NONE, encoding='latin-1', dtype=str, on_bad_lines='skip')
r = r[r['RCLTYPECD'] == 'V'].copy()
r['MFGNAME'] = r['MFGNAME'].fillna('').str.strip().str.rstrip('.').str.strip()
r['pot'] = pd.to_numeric(r['POTAFF'], errors='coerce'); r['yr'] = r['RCDATE'].str[:4]; r['comp0'] = r['COMPNAME'].fillna('').str.split(':').str[0]
camp = r.groupby('CAMPNO').agg(yr=('yr', 'first'), pot=('pot', 'max'), mfr=('MFGNAME', 'first'), desc=('DESC_DEFECT', 'first'), cons=('CONEQUENCE_DEFECT', 'first'),
                               po=('PARK_OUTSIDE', 'first'), dnd=('DO_NOT_DRIVE', 'first'), comps=('comp0', lambda s: set(s)))
Y0, Y1 = '2010', '2025'
camp = camp[camp['yr'].between(Y0, Y1)]
txt = (camp['desc'].fillna('') + ' ' + camp['cons'].fillna('')).str.upper()
E = camp['comps'].apply(lambda s: 'ELECTRICAL SYSTEM' in s)
fire = txt.str.contains('FIRE'); fuse = txt.str.contains(r'\bFUSE', regex=True)
rc = {'years': [int(Y0), int(Y1)], 'campaigns': int(len(camp)), 'vehicles': int(camp['pot'].sum()),
      'electrical': int(E.sum()), 'electrical_vehicles': int(camp.loc[E, 'pot'].sum()), 'electrical_pct': round(100 * E.mean(), 1),
      'electrical_fire': int((E & fire).sum()), 'electrical_fire_vehicles': int(camp.loc[E & fire, 'pot'].sum()),
      'fire_all': int(fire.sum()), 'fuse': int(fuse.sum()), 'fuse_vehicles': int(camp.loc[fuse, 'pot'].sum()),
      'park_outside': int((camp['po'] == 'Yes').sum()), 'park_outside_electrical': int(((camp['po'] == 'Yes') & E).sum()),
      'do_not_drive': int((camp['dnd'] == 'Yes').sum())}
first5 = camp['yr'].between('2010', '2014'); last5 = camp['yr'].between('2021', '2025')
rc['electrical_2010_2014'] = int((E & first5).sum()); rc['electrical_2021_2025'] = int((E & last5).sum())
rc['by_year'] = {y: {'campaigns': int(len(g)), 'electrical': int(g['comps'].apply(lambda s: 'ELECTRICAL SYSTEM' in s).sum()), 'electrical_vehicles': int(g.loc[g['comps'].apply(lambda s: 'ELECTRICAL SYSTEM' in s), 'pot'].sum())} for y, g in camp.groupby('yr')}
comp_rows = []
for c in set().union(*camp['comps']):
    if not c: continue
    m = camp['comps'].apply(lambda s: c in s); comp_rows.append({'component': c.title().replace('And', 'and'), 'campaigns': int(m.sum()), 'vehicles': int(camp.loc[m, 'pot'].sum())})
rc['by_component'] = sorted(comp_rows, key=lambda x: -x['campaigns'])[:12]
mf = camp[E].groupby('mfr').agg(n=('pot', 'size'), veh=('pot', 'sum')).sort_values('n', ascending=False).head(12)
rc['electrical_by_mfr'] = [{'mfr': k, 'campaigns': int(v['n']), 'vehicles': int(v['veh'])} for k, v in mf.iterrows()]
themes = {'Fire risk': 'FIRE', 'Loss of drive power or stalling': r'LOSS OF (DRIVE |MOTIVE )?POWER|STALL', 'Lights failing': r'LIGHT', 'Warning lights or gauges': r'WARNING|TELLTALE|GAUGE|INSTRUMENT', 'Rear camera': r'CAMERA|REARVIEW IMAGE', 'Wiring harness': r'WIRING|HARNESS', 'Battery': r'BATTERY', 'Short circuit': r'SHORT'}
etxt = txt[E]
rc['electrical_themes'] = {k: int(etxt.str.contains(p, regex=True).sum()) for k, p in themes.items()}
dump('recalls.json', rc)
with open(os.path.join(PUB, 'electrical-recalls-by-year.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['year_recall_filed', 'all_vehicle_recall_campaigns', 'electrical_system_campaigns', 'electrical_vehicles_potentially_affected'])
    for y, v in rc['by_year'].items(): w.writerow([y, v['campaigns'], v['electrical'], v['electrical_vehicles']])

# ---------- 2. Complaints ----------
names = ['CMPLID', 'ODINO', 'MFR_NAME', 'MAKETXT', 'MODELTXT', 'YEARTXT', 'CRASH', 'FAILDATE', 'FIRE', 'INJURED', 'DEATHS', 'COMPDESC', 'CITY', 'STATE', 'VIN', 'DATEA', 'LDATE', 'MILES', 'OCCURENCES', 'CDESCR', 'CMPL_TYPE'] + [f'f{i}' for i in range(22, 52)]
parts = [pd.read_csv(fp, sep='\t', header=None, names=names, usecols=['ODINO', 'MAKETXT', 'MODELTXT', 'YEARTXT', 'FIRE', 'LDATE', 'COMPDESC', 'CDESCR', 'f46'], quoting=csv.QUOTE_NONE, encoding='latin-1', dtype=str, on_bad_lines='skip') for fp in sorted(glob.glob(os.path.join(CMPL, 'COMPLAINTS_RECEIVED_*.txt')))]
c = pd.concat(parts, ignore_index=True); c = c[c['f46'] == 'V']
c = c.groupby('ODINO').agg(make=('MAKETXT', 'first'), model=('MODELTXT', 'first'), year=('YEARTXT', 'first'), ld=('LDATE', 'first'), fire=('FIRE', 'first'), txt=('CDESCR', 'first'), comp=('COMPDESC', lambda s: '|'.join(s.dropna()))).reset_index()
c['make'] = c['make'].replace({'MERCEDES BENZ': 'MERCEDES-BENZ'})
c['yr'] = c['ld'].str[:4]; c = c[c['yr'].between('2015', '2025')]; c['txt'] = c['txt'].fillna('').str.upper()
el = c['comp'].str.contains('ELECTRICAL SYSTEM')
fz = c['txt'].str.contains(r'BLOWN FUSE|FUSE (?:BLEW|BLOWS|BLOWING|KEEPS BLOWING|BURNT|BURNED|MELTED)|BLEW (?:A|THE) FUSE|BLOWS (?:A|THE) FUSE|FUSES BLOW|FUSE BOX', regex=True)
cc = {'years': [2015, 2025], 'total': int(len(c)), 'electrical': int(el.sum()), 'electrical_pct': round(100 * el.mean(), 1),
      'electrical_fire': int((el & (c['fire'] == 'Y')).sum()), 'fuse': int(fz.sum()),
      'fuse_melt_fire_smoke': int((fz & c['txt'].str.contains(r'MELT|FIRE|SMOKE|BURN', regex=True)).sum())}
circ = {'Lights': r'HEADLIGHT|TAIL ?LIGHT|BRAKE LIGHT|LIGHTS', 'Engine stalls or won\'t start': r"WOULD NOT START|WON'?T START|STALL", 'Instrument cluster or dash': r'CLUSTER|DASH', 'Fuel pump': 'FUEL PUMP', 'Wipers': 'WIPER', 'Radio or infotainment': r'RADIO|INFOTAINMENT|STEREO', 'A/C, heater or blower': r'A/C|AIR CONDITION|HEATER|BLOWER', 'Power windows': 'WINDOW', 'Horn': 'HORN', 'Trailer wiring': 'TRAILER', 'Power outlet or lighter': r'CIGARETTE LIGHTER|POWER OUTLET|12V|12 VOLT'}
cc['fuse_circuits'] = {k: int((fz & c['txt'].str.contains(p, regex=True)).sum()) for k, p in circ.items()}
top = c[fz].groupby(['year', 'make', 'model']).size().sort_values(ascending=False).head(12)
cc['fuse_top_model_years'] = [{'model': f'{y} {nice(a)} {nice(b)}', 'n': int(v)} for (y, a, b), v in top.items()]
mk = c.groupby('make').size(); me = c[el].groupby('make').size(); mfz = c[fz].groupby('make').size()
t = pd.DataFrame({'all': mk, 'el': me, 'fz': mfz}).fillna(0); t = t[t['all'] >= 3000]; t['pct'] = 100 * t['el'] / t['all']
cc['electrical_by_make'] = [{'make': nice(m), 'complaints': int(v['all']), 'electrical': int(v['el']), 'pct': round(v['pct'], 1), 'fuse': int(v['fz'])} for m, v in t.sort_values('pct', ascending=False).iterrows()]
dump('complaints.json', cc)
with open(os.path.join(PUB, 'electrical-complaints-by-make.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['make', 'nhtsa_vehicle_complaints_2015_2025', 'electrical_system_complaints', 'pct_electrical', 'complaints_mentioning_blown_fuse'])
    for x in cc['electrical_by_make']: w.writerow([x['make'], x['complaints'], x['electrical'], x['pct'], x['fuse']])

# ---------- 3. Our fuse box data ----------
d = json.load(open(os.path.join(ROOT, 'data', 'fuses.json')))
mys = defaultdict(list)
for b in d: mys[(b['make'], b['model'], b['year'])].append(b)
fuses = [f for b in d for f in b['fuses']]
fc = {k: sum(len(b['fuses']) for b in v) for k, v in mys.items()}
amps = Counter(f['amps'] for f in fuses if f.get('amps'))
own = {'boxes': len(d), 'model_years': len(mys), 'models': len({(a, b) for a, b, _ in mys}), 'makes': sorted({k[0] for k in mys}),
       'year_min': min(k[2] for k in mys), 'year_max': max(k[2] for k in mys), 'fuses': len(fuses),
       'median_fuses': S.median(fc.values()), 'max': {'model': ' '.join(map(str, [max(fc, key=fc.get)[2], *max(fc, key=fc.get)[:2]])), 'fuses': max(fc.values())},
       'min': {'model': ' '.join(map(str, [min(fc, key=fc.get)[2], *min(fc, key=fc.get)[:2]])), 'fuses': min(fc.values())},
       'boxes_per_model_year': dict(sorted(Counter(len(v) for v in mys.values()).items())),
       'amps': {f'{a:g}A': round(100 * n / sum(amps.values()), 1) for a, n in amps.most_common(12)},
       'spare_pct': round(100 * sum('spare' in (f.get('tags') or '') for f in fuses) / len(fuses), 1)}
own['by_period'] = {}
for a, b in [(2010, 2014), (2015, 2019), (2020, 2024), (2025, 2026)]:
    v = [n for k, n in fc.items() if a <= k[2] <= b]
    if v: own['by_period'][f'{a}–{b}'] = {'model_years': len(v), 'median': S.median(v), 'mean': round(S.mean(v), 1)}
own['by_make'] = {mk: {'model_years': sum(1 for k in fc if k[0] == mk), 'median': S.median([n for k, n in fc.items() if k[0] == mk])} for mk in own['makes']}
TAGS = {'engine': 'Engine and fuel', 'lights': 'Lights', 'windows locks': 'Windows and locks', 'climate': 'Heating and A/C', 'wipers': 'Wipers', 'audio': 'Audio', 'brakes': 'Brakes', 'power outlet': 'Power outlets', 'seats': 'Seats', 'steering': 'Steering', 'dash': 'Dashboard', 'horn': 'Horn', 'airbag': 'Airbags', 'transmission': 'Transmission', 'keys': 'Keys and immobiliser'}
tc = Counter()
for f in fuses:
    tg = (f.get('tags') or '')
    for t, lab in TAGS.items():
        if t in tg: tc[lab] += 1
own['systems'] = {k: round(100 * v / len(fuses), 1) for k, v in tc.most_common()}
dump('fuseboxes.json', own)
with open(os.path.join(PUB, 'fuse-count-by-model-year.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['make', 'model', 'model_year', 'fuse_boxes', 'fuses'])
    for (mk, md, yr), v in sorted(mys.items()): w.writerow([mk, md, yr, len(v), fc[(mk, md, yr)]])
print('ok', rc['electrical'], cc['fuse'], own['model_years'])
