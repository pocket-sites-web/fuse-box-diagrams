// Interaction for the year page: box tabs, tap-to-select, circuit search, synced table and detail panel.
interface F {
  slot: string; amps: number | null; type: string; circuit: string; tags?: string; only?: string;
  typeName: string; colour: string | null; colourName: string | null; icon: string; shop: string; shopLabel: string;
}
interface B { key: string; short: string; name: string; page: string; note: string; fuses: F[] }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function initFuseBox(root: HTMLElement) {
  const boxes: B[] = JSON.parse(root.dataset.boxes!);
  const byKey = new Map(boxes.map((b) => [b.key, b]));
  const firstWithAmps = (b: B) => (b.fuses.find((f) => f.amps) ?? b.fuses[0]).slot;
  const state = { box: boxes[0].key, q: '', sel: Object.fromEntries(boxes.map((b) => [b.key, firstWithAmps(b)])) as Record<string, string> };
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const input = $<HTMLInputElement>('#q');

  // Manuals word the same thing many ways ("headlight", "H-LP", "CIG"), so each search maps to a set of terms.
  const SYNONYMS: Record<string, string[]> = {
    radio: ['radio', 'audio', 'stereo', 'amp'],
    'power point': ['power point', 'power outlet', 'p/outlet', 'cig', 'lighter', 'accessory socket', 'power socket'],
    'cigarette lighter': ['cig', 'lighter', 'power outlet', 'power point', 'p/outlet'],
    'fuel pump': ['fuel pump', 'f/pump', 'fuel'],
    'brake lights': ['brake light', 'stop light', 'stop lamp', 'brake lamp', 'stop'],
    horn: ['horn'],
    wipers: ['wiper', 'washer'],
    'a/c': ['a/c', 'air condition', 'a/con', 'climate', 'blower', 'heater', 'htr'],
    headlamp: ['headlight', 'headlamp', 'h-lp', 'h/lamp', 'low beam', 'high beam'],
  };
  const matches = (key: string) => {
    const q = state.q.trim().toLowerCase();
    if (!q) return [];
    const test = SYNONYMS[q]
      ? (hay: string) => SYNONYMS[q].some((t) => hay.includes(t))
      : (hay: string) => q.split(/\s+/).every((w) => hay.includes(w));
    return byKey.get(key)!.fuses
      .filter((f) => f.circuit !== 'Not used' && f.circuit !== '-' && test(`${f.circuit} ${f.tags ?? ''}`.toLowerCase()))
      .map((f) => f.slot)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  };

  function panel() {
    const b = byKey.get(state.box)!, id = state.sel[b.key];
    const slots = [...new Set(b.fuses.map((f) => f.slot))], idx = slots.indexOf(id);
    const rows = b.fuses.filter((f) => f.slot === id), f = rows[0];
    const relay = f.type === 'relay';
    const amps = rows.map((r) => r.amps).filter((a) => a != null);
    const rating = amps.length ? [...new Set(amps)].map((a) => `${a} amps`).join(' or ') : '–';
    const versions = rows.length > 1
      ? `<p class="tip">${rows.map((r) => `<b>${r.amps}A</b> on ${esc(r.only ?? 'other versions')}`).join('<br>')}</p>` : '';
    const replace = rows.length > 1
      ? 'the rating for your version'
      : `a ${f.amps}A ${f.typeName.toLowerCase()}${f.colourName ? ` (${f.colourName.toLowerCase()})` : ''}`;
    const tip = relay
      ? '<b>Testing a relay:</b> swap it with an identical relay from the same box. If the fault moves, the relay is bad.'
      : f.amps ? `<b>Replace with:</b> ${replace}. Never fit a higher rating.${b.note ? ` ${esc(b.note)}` : ''}` : '<b>Empty slot.</b> Nothing on this vehicle uses it.';
    const prev = slots[(idx - 1 + slots.length) % slots.length], next = slots[(idx + 1) % slots.length];
    $('#panel').innerHTML = `
      <div class="head">${f.icon}<div><div class="slotno">${esc(b.short)} · ${relay ? 'Relay' : 'Fuse'} ${esc(f.slot)}</div><h2>${esc(f.circuit)}</h2></div></div>
      <dl>
        <dt>Rating</dt><dd>${rating}</dd>
        <dt>Type</dt><dd>${esc(f.typeName)}</dd>
        ${f.colour && rows.length === 1 ? `<dt>Colour</dt><dd><span class="swatch" style="background:${f.colour}"></span>${esc(f.colourName ?? '')}</dd>` : ''}
        <dt>Box</dt><dd>${esc(b.name)}</dd>
        ${b.page ? `<dt>Manual</dt><dd>p. ${esc(b.page)}</dd>` : ''}
      </dl>
      ${versions}
      <p class="tip">${tip}</p>
      ${f.amps || relay ? `<a class="buy" href="${f.shop}" target="_blank" rel="nofollow sponsored noopener">Shop ${esc(f.shopLabel)}s on Amazon <small>(affiliate)</small></a>` : ''}
      <div class="nav"><button type="button" data-go="${esc(prev)}">← ${esc(prev)}</button><button type="button" data-go="${esc(next)}">${esc(next)} →</button></div>`;
    $$('#panel [data-go]').forEach((btn) => btn.addEventListener('click', () => select(btn.dataset.go!)));
  }

  function marks() {
    const searching = !!state.q.trim();
    for (const b of boxes) {
      const m = new Set(matches(b.key));
      const svg = root.querySelector(`.boxview[data-box="${b.key}"] .diagram svg`);
      svg?.classList.toggle('searching', searching);
      svg?.querySelectorAll<SVGGElement>('.slot').forEach((s) => {
        s.classList.toggle('match', m.has(s.dataset.slot!));
        s.classList.toggle('sel', b.key === state.box && s.dataset.slot === state.sel[b.key]);
      });
      $$<HTMLTableRowElement>(`tbody tr[data-box="${b.key}"]`).forEach((tr) => {
        tr.classList.toggle('sel', b.key === state.box && tr.dataset.slot === state.sel[b.key]);
        tr.classList.toggle('dim', searching && !m.has(tr.dataset.slot!));
      });
    }
    $$<HTMLButtonElement>('.tabs button').forEach((t) => {
      const on = t.dataset.box === state.box;
      t.setAttribute('aria-selected', String(on));
      const hit = t.querySelector<HTMLElement>('.hit')!, n = matches(t.dataset.box!).length;
      hit.hidden = !(searching && n);
      hit.textContent = String(n);
    });
    $$('.boxview').forEach((v) => (v.hidden = v.dataset.box !== state.box));
    $$<HTMLButtonElement>('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.q!.toLowerCase() === state.q.trim().toLowerCase()));
  }

  function result() {
    const q = state.q.trim(), r = $('#result');
    $('#clear').hidden = !q;
    if (!q) { r.textContent = ''; return; }
    const here = matches(state.box);
    const others = boxes.filter((b) => b.key !== state.box).map((b) => ({ b, m: matches(b.key) })).filter((o) => o.m.length);
    if (!here.length && !others.length) { r.innerHTML = `No fuse mentions <b>${esc(q)}</b>. Try a simpler word, like "lights" or "power".`; return; }
    const cur = byKey.get(state.box)!;
    let s = here.length
      ? `<b>${here.length}</b> in the ${esc(cur.short.toLowerCase())}: ${here.map((id) => `<button type="button" data-goto="${cur.key}:${esc(id)}">${esc(id)}</button>`).join(', ')}.`
      : `None in the ${esc(cur.short.toLowerCase())}.`;
    for (const o of others) s += ` <b>${o.m.length}</b> more in the <button type="button" data-goto="${o.b.key}:${esc(o.m[0])}">${esc(o.b.short.toLowerCase())}</button>.`;
    r.innerHTML = s;
    r.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((b) => b.addEventListener('click', () => {
      const [k, id] = b.dataset.goto!.split(':');
      state.box = k; state.sel[k] = id; render();
    }));
  }

  function render() { panel(); marks(); result(); }
  function select(id: string) { state.sel[state.box] = id; panel(); marks(); }

  function setQuery(v: string) {
    state.q = v; input.value = v;
    if (v.trim()) {
      let here = matches(state.box);
      if (!here.length) {
        const other = boxes.find((b) => matches(b.key).length);
        if (other) { state.box = other.key; here = matches(other.key); }
      }
      if (here.length && !here.includes(state.sel[state.box])) state.sel[state.box] = here[0];
    }
    render();
  }

  root.querySelectorAll<SVGGElement>('.slot').forEach((g) => {
    const box = g.closest<HTMLElement>('.boxview')!.dataset.box!;
    const go = () => { state.box = box; select(g.dataset.slot!); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $$<HTMLButtonElement>('.tabs button').forEach((t) => t.addEventListener('click', () => { state.box = t.dataset.box!; render(); }));
  $$<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    const go = () => {
      state.box = tr.dataset.box!; select(tr.dataset.slot!);
      const d = root.querySelector(`.boxview[data-box="${state.box}"] .diagram`)!;
      const top = d.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) d.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    };
    tr.addEventListener('click', go);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  $$<HTMLButtonElement>('#chips .chip').forEach((c) => c.addEventListener('click', () => setQuery(c.classList.contains('on') ? '' : c.dataset.q!)));
  let t: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setQuery(input.value), 120); });
  $('#clear').addEventListener('click', () => { setQuery(''); input.focus(); });

  // Deep link: #interior-14 selects that fuse.
  const h = location.hash.slice(1).toLowerCase();
  const hit = boxes.flatMap((b) => b.fuses.map((f) => ({ b, f }))).find(({ b, f }) => `${b.key}-${f.slot}`.toLowerCase() === h);
  if (hit) { state.box = hit.b.key; state.sel[hit.b.key] = hit.f.slot; }
  render();
}
