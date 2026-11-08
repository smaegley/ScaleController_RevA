// Scale Controller web page (docs/firmware-spec.md 6.9).
//
// Served from the device by ESPHome's web_server (`js_include`, gzipped into the firmware).
// Replaces ESPHome's generic entity list with a scale-specific page. Talks only to the
// device's own web-server API: the /events stream for live state, and POST
// /<domain>/<name>/<action> for buttons and settings. No internet access needed.

(() => {
  'use strict';

  const KG_PER_LB = 0.45359237;
  const entities = {};             // "sensor/Weight" -> latest state + metadata
  let deviceTitle = 'Scale';
  let connected = false;
  let lastWeighInAt = null;        // client clock; null until a weigh-in happens while open
  let initialLoad = true;

  // ---------- page shell ----------

  const head = document.head;
  const meta = (name, content) => {
    const m = document.createElement('meta');
    m.name = name;
    m.content = content;
    head.appendChild(m);
  };
  meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  meta('color-scheme', 'light dark');
  document.title = deviceTitle;

  const style = document.createElement('style');
  style.textContent = `
:root {
  --bg: #f4f5f7; --card: #ffffff; --text: #0f172a; --muted: #64748b; --line: #e5e7eb;
  --accent: #0f766e; --accent-ink: #ffffff; --accent-soft: #ccfbf1;
  --ok: #15803d; --ok-soft: #dcfce7; --bad: #b91c1c; --bad-soft: #fee2e2;
  --info: #1d4ed8; --info-soft: #dbeafe;
  --shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06);
  --radius: 20px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f14; --card: #131a22; --text: #e6edf3; --muted: #8b98a5; --line: #222c38;
    --accent: #2dd4bf; --accent-ink: #042f2b; --accent-soft: #123b37;
    --ok: #4ade80; --ok-soft: #12301f; --bad: #f87171; --bad-soft: #3a1717;
    --info: #60a5fa; --info-soft: #14243d;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.25);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body {
  font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent;
  padding-bottom: calc(84px + env(safe-area-inset-bottom));
}
button, input, select { font: inherit; color: inherit; }
.wrap { max-width: 560px; margin: 0 auto; padding: 16px 16px 24px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 4px 16px; }
header h1 { font-size: 20px; font-weight: 650; letter-spacing: -.01em; margin: 0; }
.conn { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); transition: background .3s; }
.conn.on .dot { background: var(--ok); }
.card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
  font-size: 14px; font-weight: 550; transition: background .3s, color .3s; }
.pill.ok { background: var(--ok-soft); color: var(--ok); }
.pill.bad { background: var(--bad-soft); color: var(--bad); }
.pill.info { background: var(--info-soft); color: var(--info); }
.weight { text-align: center; padding: 28px 8px 8px; }
.weight .num { font-size: clamp(64px, 22vw, 120px); font-weight: 600; letter-spacing: -.04em; line-height: 1;
  font-variant-numeric: tabular-nums; }
.weight .num.empty { color: var(--line); font-weight: 300; }
.weight .unit { font-size: clamp(22px, 6vw, 32px); font-weight: 500; color: var(--muted); margin-left: 6px; letter-spacing: 0; }
.weight .sub { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
.weight .sub .dot { transition: background .2s; }
.weight .sub.stable .dot { background: var(--ok); }
.weight .sub.settling .dot { background: var(--info); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .3; } }
.btn { appearance: none; border: 0; border-radius: 14px; padding: 14px 20px; font-weight: 600; cursor: pointer;
  background: var(--line); color: var(--text); transition: transform .08s, opacity .2s, background .2s; }
.btn:active { transform: scale(.98); }
.btn:disabled { opacity: .5; cursor: default; }
.btn.primary { background: var(--accent); color: var(--accent-ink); }
.btn.big { width: 100%; padding: 18px; font-size: 18px; border-radius: 16px; }
.btn.danger { background: var(--bad-soft); color: var(--bad); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0;
  border-top: 1px solid var(--line); }
.row:first-of-type { border-top: 0; }
.row > :first-child { flex: 1; min-width: 0; }
.row > :last-child { flex: none; }
.row.stack { flex-direction: column; align-items: stretch; gap: 10px; }
.row.stack select { max-width: none; width: 100%; }
.row .label { font-weight: 550; }
.row .help { font-size: 13px; color: var(--muted); margin-top: 2px; }
.row .value { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; }
h2 { font-size: 13px; font-weight: 650; text-transform: uppercase; letter-spacing: .06em; color: var(--muted);
  margin: 24px 4px 8px; }
h2:first-child { margin-top: 0; }
.field { display: flex; align-items: center; gap: 6px; }
.field input { width: 110px; text-align: right; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--bg); font-variant-numeric: tabular-nums; }
.field input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.field .u { color: var(--muted); font-size: 14px; min-width: 22px; }
.field.saved input { border-color: var(--ok); }
select { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); max-width: 190px; }
.seg { display: inline-flex; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 3px; }
.seg button { border: 0; background: transparent; padding: 7px 16px; border-radius: 9px; font-weight: 600; cursor: pointer; color: var(--muted); }
.seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.toggle { position: relative; width: 52px; height: 32px; flex: none; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle span { position: absolute; inset: 0; border-radius: 999px; background: var(--line); transition: background .2s; cursor: pointer; }
.toggle span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s; }
.toggle input:checked + span { background: var(--accent); }
.toggle input:checked + span::after { transform: translateX(20px); }
.steps { counter-reset: step; }
.step { display: flex; gap: 14px; padding: 16px 0; border-top: 1px solid var(--line); opacity: .45; transition: opacity .3s; }
.step:first-child { border-top: 0; }
.step.active, .step.done { opacity: 1; }
.step .n { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 700;
  font-size: 14px; background: var(--line); }
.step.active .n { background: var(--accent); color: var(--accent-ink); }
.step.done .n { background: var(--ok-soft); color: var(--ok); }
.step .body { flex: 1; min-width: 0; }
.step .title { font-weight: 600; }
.step .text { color: var(--muted); font-size: 14px; margin: 2px 0 12px; }
.step .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.msg { font-size: 14px; margin-top: 10px; }
.msg.bad { color: var(--bad); } .msg.ok { color: var(--ok); } .msg.info { color: var(--info); }
.mini { display: flex; justify-content: space-between; align-items: baseline; color: var(--muted); font-size: 14px; }
.mini b { color: var(--text); font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
details summary { cursor: pointer; list-style: none; font-weight: 600; }
details summary::-webkit-details-marker { display: none; }
details summary::after { content: "›"; float: right; color: var(--muted); transition: transform .2s; }
details[open] summary::after { transform: rotate(90deg); }
.links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
nav { position: fixed; left: 0; right: 0; bottom: 0; background: color-mix(in srgb, var(--card) 88%, transparent);
  backdrop-filter: saturate(1.6) blur(16px); -webkit-backdrop-filter: saturate(1.6) blur(16px);
  border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
nav .tabs { max-width: 560px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); }
nav button { border: 0; background: none; padding: 10px 0 12px; display: flex; flex-direction: column; align-items: center; gap: 3px;
  color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; }
nav button svg { width: 24px; height: 24px; }
nav button.on { color: var(--accent); }
.view { display: none; animation: fade .2s ease-out; }
.view.on { display: block; }
@keyframes fade { from { opacity: 0; transform: translateY(4px); } }
.empty { color: var(--muted); text-align: center; padding: 8px 0; }
`;
  head.appendChild(style);

  const icon = (path) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const ICONS = {
    scale: icon('<path d="M4 20h16"/><path d="M6 20V9a6 6 0 0 1 12 0v11"/><path d="M12 9l2.5-2.5"/>'),
    calibrate: icon('<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    settings: icon('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  };

  document.body.innerHTML = `
<div class="wrap">
  <header><h1 id="title">Scale</h1><span class="conn" id="conn"><span class="dot"></span><span id="conn-text">Connecting…</span></span></header>

  <section class="view on" id="view-scale">
    <div class="card">
      <div style="text-align:center"><span class="pill info" id="status">Connecting…</span></div>
      <div class="weight">
        <div><span class="num" id="weight">—</span><span class="unit" id="unit">kg</span></div>
        <div class="sub" id="stability"><span class="dot"></span><span id="stability-text">Waiting for readings</span></div>
      </div>
    </div>
    <button class="btn primary big" id="zero">Zero</button>
    <div class="card" style="margin-top:16px">
      <div class="mini"><span>Last weigh-in</span><span id="lastwi-when"></span></div>
      <div class="mini" style="margin-top:4px"><b id="lastwi">—</b></div>
    </div>
  </section>

  <section class="view" id="view-calibrate">
    <div class="card">
      <div class="mini"><span>Current reading</span><span id="cal-status"></span></div>
      <div class="mini" style="margin-top:4px"><b id="cal-weight">—</b></div>
    </div>
    <div class="card steps">
      <div class="step active" id="step1"><div class="n">1</div><div class="body">
        <div class="title">Empty the scale</div>
        <div class="text">Remove everything and keep it still, then press Zero.</div>
        <div class="actions"><button class="btn primary" id="cal-zero">Zero</button></div>
        <div class="msg" id="msg1"></div></div></div>
      <div class="step" id="step2"><div class="n">2</div><div class="body">
        <div class="title">Add a known weight</div>
        <div class="text">Place something you have weighed accurately (ideally 1 kg or more) and enter its weight.</div>
        <div class="actions"><span class="field"><input id="cal-mass" type="number" inputmode="decimal" step="any" min="0"><span class="u" id="cal-mass-unit">kg</span></span>
          <button class="btn primary" id="cal-go">Calibrate</button></div>
        <div class="msg" id="msg2"></div></div></div>
      <div class="step" id="step3"><div class="n">3</div><div class="body">
        <div class="title">Check it</div>
        <div class="text">The reading above should now match your weight. Take it off: it should return to zero.</div>
        <div class="actions"><button class="btn" id="cal-again">Start over</button></div>
        <div class="msg" id="msg3"></div></div></div>
    </div>
  </section>

  <section class="view" id="view-settings">
    <div id="settings"></div>
    <h2>Device</h2>
    <div class="card"><details><summary>Diagnostics</summary><div id="diag" style="margin-top:8px"></div>
      <div class="links"><button class="btn danger" id="restart">Restart</button>
      <button class="btn" id="esphome-page">ESPHome page</button></div></details></div>
  </section>
</div>
<nav><div class="tabs">
  <button class="on" data-view="scale">${ICONS.scale}Scale</button>
  <button data-view="calibrate">${ICONS.calibrate}Calibrate</button>
  <button data-view="settings">${ICONS.settings}Settings</button>
</div></nav>`;

  const $ = (id) => document.getElementById(id);

  // ---------- helpers ----------

  const ent = (id) => entities[id];
  const val = (id) => (entities[id] ? entities[id].value : undefined);
  const isLb = () => val('select/Display unit') === 'lb';
  const unit = () => (isLb() ? 'lb' : 'kg');
  const toDisplay = (kg) => (isLb() ? kg / KG_PER_LB : kg);
  const fromDisplay = (v) => (isLb() ? v * KG_PER_LB : v);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const fmtWeight = (kg) => {
    if (!isNum(kg)) return '—';
    const v = toDisplay(kg);
    const d = isLb() ? 1 : Math.abs(v) < 100 ? 2 : 1;
    const s = v.toFixed(d);
    return s === (-0).toFixed(d) ? (0).toFixed(d) : s;   // no "-0.00"
  };
  const ago = (t) => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
  };

  const post = (id, action, params) => {
    const [domain, ...rest] = id.split('/');
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return fetch(`/${domain}/${encodeURIComponent(rest.join('/'))}/${action}${qs}`, { method: 'POST' });
  };

  // ---------- navigation ----------

  document.querySelectorAll('nav button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + b.dataset.view));
      window.scrollTo(0, 0);
    }));

  // ---------- main view ----------

  const statusClass = (text, problem) => {
    if (/ing:|ing…/.test(text)) return 'info';
    if (/failed/i.test(text)) return 'bad';
    if (/^(Zeroed|Calibrated)/.test(text)) return 'ok';
    return problem ? 'bad' : 'ok';
  };

  const renderMain = () => {
    const live = ent('sensor/Live weight') ? val('sensor/Live weight') : val('sensor/Weight');
    $('weight').textContent = isNum(live) ? fmtWeight(live) : '–.––';
    $('weight').classList.toggle('empty', !isNum(live));
    $('unit').textContent = unit();
    $('cal-weight').textContent = `${fmtWeight(live)} ${unit()}`;
    $('cal-mass-unit').textContent = unit();

    const status = val('text_sensor/Status');
    const problem = val('binary_sensor/Problem') === true;
    const pill = $('status');
    pill.textContent = status || (connected ? 'OK' : 'Connecting…');
    pill.className = 'pill ' + statusClass(pill.textContent, problem);
    $('cal-status').textContent = status || '';

    const stable = val('binary_sensor/Stable');
    const sub = $('stability');
    if (!isNum(live)) {
      sub.className = 'sub';
      $('stability-text').textContent = status === 'Not calibrated' ? 'Calibrate to start weighing' : 'Waiting for readings';
    } else {
      sub.className = 'sub ' + (stable ? 'stable' : 'settling');
      $('stability-text').textContent = stable ? 'Stable' : 'Settling';
    }

    $('lastwi').textContent = isNum(val('sensor/Last weigh-in')) ? `${fmtWeight(val('sensor/Last weigh-in'))} ${unit()}` : '—';
    $('lastwi-when').textContent = lastWeighInAt ? ago(lastWeighInAt) : '';
  };
  setInterval(() => lastWeighInAt && ($('lastwi-when').textContent = ago(lastWeighInAt)), 15000);

  $('zero').addEventListener('click', () => post('button/Zero', 'press'));

  // ---------- calibration wizard ----------

  let calStep = 1;
  let calWaiting = null;           // 'zero' | 'cal' while a press is in progress

  const setStep = (n) => {
    calStep = n;
    [1, 2, 3].forEach((i) => {
      const s = $('step' + i);
      s.classList.toggle('active', i === n);
      s.classList.toggle('done', i < n);
    });
    $('cal-zero').disabled = n !== 1;
    $('cal-go').disabled = n !== 2;
  };
  const say = (i, text, cls) => {
    const m = $('msg' + i);
    m.textContent = text || '';
    m.className = 'msg ' + (cls || '');
  };

  const calOnStatus = (text) => {
    if (calWaiting === 'zero') {
      if (/^Zeroing/.test(text)) say(1, 'Keep the scale still…', 'info');
      else if (text === 'Zeroed') { calWaiting = null; say(1, 'Zeroed', 'ok'); setStep(2); $('cal-mass').focus(); }
      else if (/^Zero failed/.test(text)) { calWaiting = null; say(1, text, 'bad'); $('cal-zero').disabled = false; }
    } else if (calWaiting === 'cal') {
      if (/^Calibrating/.test(text)) say(2, 'Keep the scale still…', 'info');
      else if (/^Calibrated/.test(text)) { calWaiting = null; say(2, text, 'ok'); setStep(3); }
      else if (/^Calibration failed/.test(text)) { calWaiting = null; say(2, text, 'bad'); $('cal-go').disabled = false; }
    }
  };

  $('cal-zero').addEventListener('click', () => {
    calWaiting = 'zero';
    $('cal-zero').disabled = true;
    say(1, 'Zeroing…', 'info');
    post('button/Zero', 'press');
  });
  $('cal-go').addEventListener('click', async () => {
    const v = parseFloat($('cal-mass').value);
    if (!(v > 0)) { say(2, 'Enter the weight first', 'bad'); return; }
    calWaiting = 'cal';
    $('cal-go').disabled = true;
    say(2, 'Calibrating…', 'info');
    await post('number/Calibration weight', 'set', { value: fromDisplay(v).toFixed(4) });
    post('button/Calibrate', 'press');
  });
  $('cal-again').addEventListener('click', () => { [1, 2, 3].forEach((i) => say(i, '')); setStep(1); });
  setStep(1);

  // ---------- settings ----------

  const SETTINGS = [
    ['Display', [
      ['select/Display unit', 'Units shown on this page and the display. Home Assistant always gets kg; change the unit per entity there.'],
      ['select/Status LED', 'What the green LED on the board shows.'],
    ]],
    ['Weighing', [
      ['number/Stability band', 'A reading counts as stable when it stays within this for 1.5 s.'],
      ['number/Minimum weigh-in', 'Weigh-ins below this are ignored.'],
      ['number/Rated capacity', 'Total rating of your load cells; above it the scale reports Overload.'],
      ['switch/Auto-zero', 'Slowly corrects zero drift while the scale is empty. Leave off for kegs, bins and beds.'],
    ]],
    ['Reporting to Home Assistant', [
      ['select/Report mode', 'Send on change (plus a regular heartbeat), or on a fixed interval.'],
      ['number/Report threshold', 'Minimum change before the weight is sent again.'],
      ['number/Report interval', 'Heartbeat, or the fixed interval.'],
    ]],
    ['Calibration', [
      ['number/Calibration factor', 'Set by Calibrate. Note it down to restore it after a reset.'],
    ]],
  ];
  const controls = {};             // id -> { el, update() }

  const numberControl = (id) => {
    const wrap = document.createElement('span');
    wrap.className = 'field';
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.step = 'any';
    const u = document.createElement('span');
    u.className = 'u';
    wrap.append(input, u);
    const isKg = () => (ent(id).uom || '') === 'kg';
    const save = async () => {
      const v = parseFloat(input.value);
      if (!isFinite(v)) return update(true);
      const out = isKg() ? fromDisplay(v) : v;
      const r = await post(id, 'set', { value: String(Math.round(out * 10000) / 10000) });
      if (r.ok) { wrap.classList.add('saved'); setTimeout(() => wrap.classList.remove('saved'), 1200); }
    };
    input.addEventListener('change', save);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
    const update = (force) => {
      const e = ent(id);
      u.textContent = isKg() ? unit() : e.uom || '';
      if (document.activeElement === input && !force) return;
      const n = parseFloat(e.value);
      if (!isNum(n)) { input.value = ''; return; }
      const v = isKg() ? toDisplay(n) : n;
      input.value = String(Math.round(v * 1000) / 1000);
    };
    return { el: wrap, update };
  };

  const selectControl = (id) => {
    const e = ent(id);
    const options = e.option || [];
    if (options.length <= 2 && options.every((o) => o.length <= 3)) {
      const seg = document.createElement('span');
      seg.className = 'seg';
      const buttons = options.map((o) => {
        const b = document.createElement('button');
        b.textContent = o;
        b.addEventListener('click', () => post(id, 'set', { option: o }));
        seg.appendChild(b);
        return b;
      });
      return { el: seg, update: () => buttons.forEach((b) => b.classList.toggle('on', b.textContent === ent(id).value)) };
    }
    const sel = document.createElement('select');
    options.forEach((o) => sel.add(new Option(o, o)));
    sel.addEventListener('change', () => post(id, 'set', { option: sel.value }));
    return { el: sel, update: () => { if (document.activeElement !== sel) sel.value = ent(id).value; } };
  };

  const switchControl = (id) => {
    const label = document.createElement('label');
    label.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    label.append(input, document.createElement('span'));
    input.addEventListener('change', () => post(id, input.checked ? 'turn_on' : 'turn_off'));
    return { el: label, update: () => { input.checked = ent(id).value === true; } };
  };

  const buildSettings = () => {
    const root = $('settings');
    root.innerHTML = '';
    for (const [group, items] of SETTINGS) {
      const present = items.filter(([id]) => ent(id));
      if (!present.length) continue;
      const h = document.createElement('h2');
      h.textContent = group;
      const card = document.createElement('div');
      card.className = 'card';
      for (const [id, help] of present) {
        const domain = id.split('/')[0];
        const c = domain === 'number' ? numberControl(id) : domain === 'select' ? selectControl(id) : switchControl(id);
        const row = document.createElement('div');
        const long = domain === 'select' && (ent(id).option || []).some((o) => o.length > 12);
        row.className = long ? 'row stack' : 'row';
        const text = document.createElement('div');
        text.innerHTML = '<div class="label"></div><div class="help"></div>';
        text.firstChild.textContent = ent(id).name || id.split('/')[1];
        text.lastChild.textContent = help;
        row.append(text, c.el);
        card.appendChild(row);
        controls[id] = c;
        c.update();
      }
      root.append(h, card);
    }
  };

  const DIAG = [
    ['text_sensor/Firmware version', (v) => v],
    ['sensor/Raw counts', (v) => (isNum(v) ? Math.round(v).toLocaleString() : '—')],
    ['sensor/Chip temperature', (v) => (isNum(v) ? `${v.toFixed(1)} °C` : '—')],
    ['sensor/Wi-Fi signal', (v) => (isNum(v) ? `${Math.round(v)} dBm` : '—')],
    ['sensor/Uptime', (v) => {
      if (!isNum(v)) return '—';
      const d = Math.floor(v / 86400), h = Math.floor((v % 86400) / 3600), m = Math.floor((v % 3600) / 60);
      return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    }],
  ];
  const renderDiag = () => {
    $('diag').innerHTML = '';
    for (const [id, fmt] of DIAG) {
      if (!ent(id)) continue;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span class="label"></span><span class="value"></span>';
      row.firstChild.textContent = ent(id).name;
      row.lastChild.textContent = fmt(val(id));
      $('diag').appendChild(row);
    }
  };

  $('restart').addEventListener('click', () => {
    if (confirm('Restart the scale?')) post('button/Restart', 'press');
  });
  // ESPHome's stock page for debugging. It loads from the internet (oi.esphome.io).
  $('esphome-page').addEventListener('click', () => {
    document.open();
    document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width, initial-scale=1"></head>' +
      '<body><esp-app></esp-app><script src="https://oi.esphome.io/v3/www.js"><\/script></body></html>');
    document.close();
  });

  // ---------- live connection ----------

  let renderQueued = false;
  let settingsDirty = false;
  const queueRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (settingsDirty) { settingsDirty = false; buildSettings(); }
      renderMain();
      for (const id in controls) controls[id].update();
      renderDiag();
    });
  };

  const setConnected = (on) => {
    connected = on;
    $('conn').classList.toggle('on', on);
    $('conn-text').textContent = on ? 'Live' : 'Reconnecting…';
    queueRender();
  };

  const source = new EventSource('/events');
  source.addEventListener('open', () => setConnected(true));
  source.addEventListener('error', () => setConnected(false));
  source.addEventListener('ping', (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.title) { deviceTitle = d.title; document.title = d.title; $('title').textContent = d.title; }
    } catch (_) { /* keep-alive without payload */ }
    if (!connected) setConnected(true);
  });
  source.addEventListener('state', (e) => {
    const d = JSON.parse(e.data);
    if (!d.id) return;
    const known = !!entities[d.id];
    const prev = entities[d.id] ? entities[d.id].value : undefined;
    entities[d.id] = Object.assign(entities[d.id] || {}, d);
    if (!known && SETTINGS.some(([, items]) => items.some(([id]) => id === d.id))) settingsDirty = true;
    if (d.id === 'text_sensor/Status' && d.value !== prev) calOnStatus(d.value);
    if (d.id === 'sensor/Last weigh-in' && !initialLoad && d.value !== prev) lastWeighInAt = Date.now();
    queueRender();
  });
  // States arriving in the first second are the initial snapshot, not new weigh-ins.
  setTimeout(() => { initialLoad = false; }, 1500);
})();
