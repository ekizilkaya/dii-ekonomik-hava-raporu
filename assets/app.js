/* DII Ekonomik Hava Tahmin Raporu - sayfa mantığı. Bağımlılık yok; grafikler SVG.
   Veri: data/latest.json, signal.csv, clusters_weekly.csv, terms.csv, tefas.csv, nowcast_history.csv */
(function () {
  "use strict";

  // ------------------------------------------------------------------ yardımcılar
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  const MINUS = "−";

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "text") n.textContent = v;
      else if (k === "cls") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else n.setAttribute(k, v);
    }
    (children || []).forEach((c) => c != null && n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  function sv(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }
  function svText(parent, x, y, str, attrs) {
    const t = sv("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  const isNum = (v) => typeof v === "number" && isFinite(v);
  function fmt(v, d = 1, sign = false) {
    if (!isNum(v)) return "–";
    const s = Math.abs(v).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
    if (v < 0 && Number(s.replace(/\./g, "").replace(",", ".")) !== 0) return MINUS + s;
    return (sign && v > 0 ? "+" : "") + s;
  }
  const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d || 1)); };
  const dayStr = (d) => `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const monthStr = (d) => `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const shortDay = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  async function getJSON(url) { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(url); return r.json(); }
  async function getCSV(url) {
    try { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) return null; return parseCSV(await r.text()); }
    catch (e) { return null; }
  }
  function parseCSV(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift() || [];
    return rows.filter((r) => r.length === head.length).map((r) => {
      const o = {};
      head.forEach((h, j) => { const v = r[j]; const n = Number(v); o[h] = v === "" ? null : (isFinite(n) && v.trim() !== "" && !/^\d{4}-\d{2}/.test(v) ? n : v); });
      return o;
    });
  }
  function niceTicks(min, max, count) {
    const span = max - min || 1, step0 = span / (count || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(step0))), err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const out = []; for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  function timeTicks(d0, d1) {
    const days = (d1 - d0) / 864e5, every = days <= 150 ? 1 : days <= 420 ? 2 : days <= 1300 ? 6 : 12;
    const out = []; let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1;
    if (m > 11) { m = 0; y++; }
    while (true) {
      const d = new Date(Date.UTC(y, m, 1));
      if (d > d1) break;
      if (every === 12 ? m === 0 : m % every === 0) out.push(d);
      m++; if (m > 11) { m = 0; y++; }
    }
    const label = (d) => every === 12 ? String(d.getUTCFullYear()) : `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
    return { ticks: out, label };
  }

  // ------------------------------------------------------------------ ikonlar
  const ICONS = {
    sun: '<circle cx="32" cy="32" r="11" fill="var(--warning)"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M15 49l4-4M45 19l4-4"/></g>',
    partly: '<circle cx="24" cy="24" r="9" fill="var(--warning)"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 6v4M8 24h4M11 11l3 3M37 11l-3 3"/></g><path d="M22 50h26a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-3 15z" fill="var(--surface)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
    cloud: '<path d="M16 46h32a10 10 0 0 0 0-20 14 14 0 0 0-27 4 8 8 0 0 0-5 16z" fill="var(--surface-2)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
    rain: '<path d="M16 38h32a10 10 0 0 0 0-20 14 14 0 0 0-27 4 8 8 0 0 0-5 16z" fill="var(--surface-2)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><g stroke="var(--s1)" stroke-width="3" stroke-linecap="round"><path d="M22 45l-3 8M33 45l-3 8M44 45l-3 8"/></g>',
    storm: '<path d="M16 36h32a10 10 0 0 0 0-20 14 14 0 0 0-27 4 8 8 0 0 0-5 16z" fill="var(--surface-2)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 38l-8 12h7l-4 10 12-15h-7l4-7z" fill="var(--warning)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    unknown: '<circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3"/>',
  };
  const mini = {
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--good)"/><path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bad: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--critical)"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l7 12.5H1z" fill="var(--warning)"/><path d="M8 6v4" stroke="#0b0b0b" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r="0.9" fill="#0b0b0b"/></svg>',
    idle: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--muted)" stroke-width="1.6"/><path d="M5 8h6" stroke="var(--muted)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };
  const iconSpan = (key) => { const s = el("span", { cls: "verdict-ic", "aria-hidden": "true" }); s.innerHTML = mini[key]; return s.firstChild; };

  // ------------------------------------------------------------------ tooltip
  function tooltipFor(container) {
    let tip = container.querySelector(".tooltip");
    if (!tip) { tip = el("div", { cls: "tooltip", role: "status", "aria-live": "polite" }); container.appendChild(tip); }
    return {
      show(x, y, title, rows) {
        tip.textContent = "";
        tip.appendChild(el("div", { cls: "t", text: title }));
        rows.forEach((r) => {
          const line = el("div", { cls: "r" });
          if (r.color) line.appendChild(el("i", { style: `background:${r.color}` }));
          line.appendChild(el("b", { text: r.value }));
          line.appendChild(el("span", { text: r.label }));
          tip.appendChild(line);
        });
        const cw = container.clientWidth, tw = tip.offsetWidth || 180;
        let left = x + 14; if (left + tw > cw) left = Math.max(0, x - tw - 14);
        tip.style.left = left + "px"; tip.style.top = Math.max(0, y - 10) + "px";
        tip.classList.add("on");
      },
      hide() { tip.classList.remove("on"); },
    };
  }

  // ------------------------------------------------------------------ çizgi grafiği
  /* opts: x (Date[]), series [{label, color, values, endLabel}], band {lo, hi, color}, yMin, yMax, yFormat, refLines [{y,label}],
     events [{date, num, name}], height, xLabel(d) for tooltip, tooltipFormat(v) */
  function lineChart(container, opts) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    const W = Math.max(280, container.clientWidth), H = opts.height || 240;
    const narrow = W < 520;
    const m = { l: 44, r: opts.endLabels === false ? 12 : (narrow ? 12 : 92), t: opts.events && opts.events.length ? 22 : 12, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const xs = opts.x;
    if (!xs.length) { container.appendChild(el("div", { cls: "empty", text: "Gösterilecek veri yok." })); return; }
    const vals = [];
    opts.series.forEach((s) => s.values.forEach((v) => isNum(v) && vals.push(v)));
    if (opts.band) { opts.band.lo.forEach((v) => isNum(v) && vals.push(v)); opts.band.hi.forEach((v) => isNum(v) && vals.push(v)); }
    (opts.refLines || []).forEach((r) => vals.push(r.y));
    let y0 = opts.yMin != null ? opts.yMin : Math.min(...vals), y1 = opts.yMax != null ? opts.yMax : Math.max(...vals);
    if (opts.yMin == null || opts.yMax == null) { const pad = (y1 - y0) * 0.08 || 1; if (opts.yMin == null) y0 -= pad; if (opts.yMax == null) y1 += pad; }
    const ticks = niceTicks(y0, y1, ph < 160 ? 4 : 5);
    if (opts.yMin == null) y0 = Math.min(y0, ticks[0]); if (opts.yMax == null) y1 = Math.max(y1, ticks[ticks.length - 1]);
    const t0 = xs[0].getTime(), t1 = xs[xs.length - 1].getTime() || t0 + 1;
    const X = (d) => m.l + (t1 === t0 ? pw / 2 : ((d.getTime() - t0) / (t1 - t0)) * pw);
    const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * ph;
    const yf = opts.yFormat || ((v) => fmt(v, Math.abs(y1 - y0) < 5 ? 1 : 0));

    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: "0", "aria-label": opts.ariaLabel || "Zaman serisi grafiği" });
    container.insertBefore(svg, container.firstChild);
    const g = sv("g", { class: "axis" }, svg);
    ticks.forEach((v) => {
      if (v < y0 - 1e-9 || v > y1 + 1e-9) return;
      sv("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: Math.abs(v) < 1e-12 ? "baseline" : "gridline" }, g);
      svText(g, m.l - 8, Y(v) + 3.5, yf(v), { "text-anchor": "end", class: "tick" });
    });
    const tt = timeTicks(xs[0], xs[xs.length - 1]);
    let lastX = -1e9;
    tt.ticks.forEach((d) => {
      const x = X(d); if (x - lastX < 46) return; lastX = x;
      sv("line", { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 4, class: "baseline" }, g);
      svText(g, x, H - 8, tt.label(d), { "text-anchor": "middle", class: "tick" });
    });
    (opts.refLines || []).forEach((r) => {
      sv("line", { x1: m.l, x2: m.l + pw, y1: Y(r.y), y2: Y(r.y), class: "refline" }, svg);
      const lbl = svText(svg, m.l + 6, Y(r.y) - 4, r.label, { class: "reflabel" });
      lbl.setAttribute("paint-order", "stroke"); lbl.setAttribute("style", "stroke:var(--surface);stroke-width:3px;stroke-linejoin:round");
    });
    (opts.events || []).forEach((e) => {
      const d = parseDate(e.date); if (d < xs[0] || d > xs[xs.length - 1]) return;
      const x = X(d);
      sv("line", { x1: x, x2: x, y1: m.t - 4, y2: m.t + ph, class: "eventline" }, svg);
      svText(svg, x, m.t - 8, String(e.num), { "text-anchor": "middle", class: "eventnum" });
    });
    if (opts.band) {
      let dpath = "", seg = [];
      const flush = () => {
        if (seg.length > 1) {
          dpath += "M" + seg.map((i) => `${X(xs[i]).toFixed(1)},${Y(opts.band.hi[i]).toFixed(1)}`).join("L");
          dpath += "L" + seg.slice().reverse().map((i) => `${X(xs[i]).toFixed(1)},${Y(opts.band.lo[i]).toFixed(1)}`).join("L") + "Z";
        }
        seg = [];
      };
      xs.forEach((_, i) => (isNum(opts.band.lo[i]) && isNum(opts.band.hi[i]) ? seg.push(i) : flush())); flush();
      sv("path", { d: dpath, style: `fill:${opts.band.color};opacity:0.14` }, svg);
    }
    const ends = [];
    opts.series.forEach((s) => {
      let d = "", pen = false;
      s.values.forEach((v, i) => { if (isNum(v)) { d += (pen ? "L" : "M") + X(xs[i]).toFixed(1) + "," + Y(v).toFixed(1); pen = true; } else pen = false; });
      sv("path", { d, style: `fill:none;stroke:${s.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round` }, svg);
      if (s.dots) s.values.forEach((v, i) => isNum(v) && sv("circle", { cx: X(xs[i]), cy: Y(v), r: 3, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` }, svg));
      let li = s.values.length - 1; while (li >= 0 && !isNum(s.values[li])) li--;
      if (li >= 0) {
        sv("circle", { cx: X(xs[li]), cy: Y(s.values[li]), r: 4, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` }, svg);
        ends.push({ y: Y(s.values[li]), x: X(xs[li]), text: s.endLabel != null ? s.endLabel : `${s.label} ${yf(s.values[li])}` });
      }
    });
    if (opts.endLabels !== false && !narrow && ends.length) {
      ends.sort((a, b) => a.y - b.y);
      const collide = ends.some((e, i) => i && e.y - ends[i - 1].y < 13);
      if (!collide || ends.length === 1) ends.forEach((e) => svText(svg, m.l + pw + 8, e.y + 4, e.text, { class: "endlabel" }));
    }

    // Hover / klavye katmanı
    const tip = tooltipFor(container);
    const cross = sv("line", { y1: m.t, y2: m.t + ph, class: "crosshair", visibility: "hidden" }, svg);
    const hit = sv("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent", style: "cursor:crosshair" }, svg);
    let cur = -1;
    const xLabel = opts.xLabel || shortDay;
    const vf = opts.tooltipFormat || yf;
    function showAt(i) {
      if (i < 0 || i >= xs.length) return;
      cur = i;
      const x = X(xs[i]);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      const rows = opts.series.map((s) => ({ color: s.color, value: vf(s.values[i]), label: s.label }));
      if (opts.band && isNum(opts.band.lo[i])) rows.push({ color: null, value: `${vf(opts.band.lo[i])} – ${vf(opts.band.hi[i])}`, label: opts.band.label || "aralık" });
      const ys = opts.series.map((s) => s.values[i]).filter(isNum);
      tip.show(x * (container.clientWidth / W), (ys.length ? Y(Math.max(...ys)) : m.t) * (container.clientWidth / W), xLabel(xs[i]), rows);
    }
    function nearest(px) {
      const t = t0 + ((px - m.l) / pw) * (t1 - t0);
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid].getTime() < t) lo = mid; else hi = mid; }
      return Math.abs(xs[lo].getTime() - t) < Math.abs(xs[hi].getTime() - t) ? lo : hi;
    }
    hit.addEventListener("pointermove", (ev) => { const r = svg.getBoundingClientRect(); showAt(nearest((ev.clientX - r.left) * (W / r.width))); });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    svg.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); showAt(Math.max(0, Math.min(xs.length - 1, (cur < 0 ? xs.length - 1 : cur) + (ev.key === "ArrowRight" ? 1 : -1)))); }
      else if (ev.key === "Escape") { cross.setAttribute("visibility", "hidden"); tip.hide(); }
    });
    svg.addEventListener("blur", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
  }

  // ------------------------------------------------------------------ ıraksak renk (OKLab ara değer)
  function hexToRgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const fromLin = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
  function toOklab(hex) {
    const [r, g, b] = hexToRgb(hex).map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromOklab([L, A, B]) {
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    const r = fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), g = fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), b = fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
    return `rgb(${r},${g},${b})`;
  }
  function mix(h1, h2, t) { const a = toOklab(h1), b = toOklab(h2); return fromOklab(a.map((v, i) => v + (b[i] - v) * t)); }
  const DIV_EDGES = [-1.5, -0.75, -0.25, 0.25, 0.75, 1.5];
  const DIV_LABELS = ["< −1,5", "−1,5…−0,75", "−0,75…−0,25", "olağan", "0,25…0,75", "0,75…1,5", "> 1,5"];
  function divColors() {
    const neg = cssVar("--div-neg"), mid = cssVar("--div-mid"), pos = cssVar("--div-pos");
    return [neg, mix(mid, neg, 0.66), mix(mid, neg, 0.33), mid, mix(mid, pos, 0.33), mix(mid, pos, 0.66), pos];
  }
  const divClass = (v) => { let k = 0; while (k < DIV_EDGES.length && v > DIV_EDGES[k]) k++; return k; };

  // ------------------------------------------------------------------ ısı haritası
  function heatmap(container, weeks, rows) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    const W = Math.max(280, container.clientWidth);
    const lw = W < 520 ? 84 : 112, cols = weeks.length, gap = 2;
    const cw = Math.max(3, (W - lw - 4) / cols), chh = 22, H = rows.length * (chh + gap) + 24;
    const colors = divColors();
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Kümelerin haftalık seviyesi ısı haritası" });
    container.insertBefore(svg, container.firstChild);
    rows.forEach((r, ri) => {
      const y = ri * (chh + gap);
      svText(svg, lw - 8, y + chh / 2 + 4, r.short, { "text-anchor": "end", class: "tick", style: "fill:var(--ink-2);font-size:12px" });
      r.values.forEach((v, ci) => {
        if (!isNum(v)) return;
        sv("rect", { x: lw + ci * cw, y, width: Math.max(1, cw - gap), height: chh, rx: 2, style: `fill:${colors[divClass(v)]}` }, svg);
      });
    });
    const tt = timeTicks(weeks[0], weeks[weeks.length - 1]);
    let lastX = -1e9;
    tt.ticks.forEach((d) => {
      const i = weeks.findIndex((w) => w >= d); if (i < 0) return;
      const x = lw + i * cw; if (x - lastX < 46) return; lastX = x;
      svText(svg, x, H - 6, tt.label(d), { "text-anchor": "start", class: "tick" });
    });
    const tip = tooltipFor(container);
    const hit = sv("rect", { x: lw, y: 0, width: cols * cw, height: rows.length * (chh + gap), fill: "transparent" }, svg);
    hit.addEventListener("pointermove", (ev) => {
      const b = svg.getBoundingClientRect(), sx = W / b.width;
      const px = (ev.clientX - b.left) * sx, py = (ev.clientY - b.top) * sx;
      const ci = Math.floor((px - lw) / cw), ri = Math.floor(py / (chh + gap));
      if (ci < 0 || ci >= cols || ri < 0 || ri >= rows.length) return tip.hide();
      const v = rows[ri].values[ci];
      tip.show(px / sx, py / sx, `${shortDay(weeks[ci])} ile biten hafta`, [{ color: null, value: fmt(v, 2), label: rows[ri].name }]);
    });
    hit.addEventListener("pointerleave", () => tip.hide());
  }
  function divLegend(container) {
    container.textContent = "";
    const colors = divColors();
    DIV_LABELS.forEach((lab, i) => { const s = el("span"); s.appendChild(el("i", { cls: "box", style: `background:${colors[i]}` })); s.appendChild(document.createTextNode(lab)); container.appendChild(s); });
  }

  // ------------------------------------------------------------------ yatay çubuklar
  function barList(container, items, opts) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    if (!items.length) { container.appendChild(el("div", { cls: "empty", text: "Gösterilecek veri yok." })); return; }
    const W = Math.max(280, container.clientWidth), narrow = W < 520;
    const lw = narrow ? 118 : 170, vw = 52, rowH = 28, bar = 14;
    const H = items.length * rowH + 6;
    const vmax = Math.max(...items.map((d) => Math.abs(d.value)), 1e-9);
    const hasNeg = items.some((d) => d.value < 0), hasPos = items.some((d) => d.value > 0);
    const pw = W - lw - vw * (hasNeg && hasPos ? 2 : 1);
    const zero = lw + (hasNeg ? (hasPos ? pw / 2 + vw : pw + vw) : 0);
    const scale = (hasNeg && hasPos ? pw / 2 : pw) / vmax;
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": opts.ariaLabel || "Çubuk grafik" });
    container.insertBefore(svg, container.firstChild);
    sv("line", { x1: zero, x2: zero, y1: 0, y2: H - 4, class: "baseline" }, svg);
    const tip = tooltipFor(container);
    items.forEach((d, i) => {
      const yc = i * rowH + rowH / 2, len = Math.abs(d.value) * scale, r = Math.min(4, len / 2);
      const x0 = zero, x1 = d.value >= 0 ? zero + len : zero - len;
      let path;
      if (d.value >= 0) path = `M${x0},${yc - bar / 2}H${x1 - r}Q${x1},${yc - bar / 2} ${x1},${yc - bar / 2 + r}V${yc + bar / 2 - r}Q${x1},${yc + bar / 2} ${x1 - r},${yc + bar / 2}H${x0}Z`;
      else path = `M${x0},${yc - bar / 2}H${x1 + r}Q${x1},${yc - bar / 2} ${x1},${yc - bar / 2 + r}V${yc + bar / 2 - r}Q${x1},${yc + bar / 2} ${x1 + r},${yc + bar / 2}H${x0}Z`;
      const color = typeof opts.color === "function" ? opts.color(d) : opts.color;
      sv("path", { d: path, style: `fill:${color}` }, svg);
      const lbl = d.label.length > (narrow ? 17 : 26) ? d.label.slice(0, narrow ? 16 : 25) + "…" : d.label;
      svText(svg, d.value >= 0 && hasNeg && hasPos ? lw - 8 : (hasNeg && !hasPos ? lw - 8 : lw - 8), yc + 4, lbl, { "text-anchor": "end", class: "tick", style: "fill:var(--ink-2);font-size:12px" });
      svText(svg, d.value >= 0 ? x1 + 6 : x1 - 6, yc + 4, opts.format(d.value), { "text-anchor": d.value >= 0 ? "start" : "end", class: "tick", style: "fill:var(--ink)" });
      const h = sv("rect", { x: 0, y: i * rowH, width: W, height: rowH, fill: "transparent", tabindex: "0", "aria-label": `${d.label}: ${opts.format(d.value)}` }, svg);
      const show = () => tip.show((x1 + 10) * (container.clientWidth / W), yc * (container.clientWidth / W), d.label, [{ color: null, value: opts.format(d.value), label: d.sub || "" }]);
      h.addEventListener("pointerenter", show); h.addEventListener("focus", show);
      h.addEventListener("pointerleave", () => tip.hide()); h.addEventListener("blur", () => tip.hide());
    });
  }

  // ------------------------------------------------------------------ tablo
  function table(container, head, rows, numCols) {
    container.textContent = "";
    const t = el("table");
    const thead = el("thead"), tr = el("tr");
    head.forEach((h, i) => tr.appendChild(el("th", { text: h, cls: numCols && numCols.includes(i) ? "num" : null, scope: "col" })));
    thead.appendChild(tr); t.appendChild(thead);
    const tb = el("tbody");
    rows.forEach((r) => {
      const row = el("tr");
      r.forEach((c, i) => { const td = el("td", { cls: numCols && numCols.includes(i) ? "num" : null }); if (c instanceof Node) td.appendChild(c); else td.textContent = c == null ? "–" : String(c); row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb); container.appendChild(t);
  }

  // ------------------------------------------------------------------ içerik
  const STATE_ORDER = [
    { k: "güneşli", lo: 0, hi: 30 }, { k: "parçalı bulutlu", lo: 30, hi: 70 }, { k: "bulutlu", lo: 70, hi: 85 },
    { k: "sağanak", lo: 85, hi: 95 }, { k: "fırtına", lo: 95, hi: 100 },
  ];
  const CODE_COLOR = { "sarı": "var(--warning)", "turuncu": "var(--serious)", "kırmızı": "var(--critical)" };
  const SHORT = { K1_istihdam: "İstihdam", K2_borc: "Borç", K3_makro: "Makro kriz", K4_guvenli_liman: "Güvenli liman", K5_gecim: "Geçim", K6_risk_istahi: "Risk iştahı", K7_politika_belirsizlik: "Politika" };
  const FUND = { para_piyasasi: "Para piyasası", hisse: "Hisse", doviz_eurobond: "Döviz / eurobond", altin_kiymetli: "Altın / kıymetli", serbest: "Serbest", borclanma: "Borçlanma", degisken_karma: "Değişken / karma", katilim: "Katılım", fon_sepeti: "Fon sepeti" };
  const LABELS = {
    kanitli: { text: "Kanıtlı katkı", color: "var(--good)" },
    zayif: { text: "Zayıf kanıt", color: "var(--warning)" },
    yok: { text: "Katkı kanıtlanmadı", color: "var(--muted)" },
    yetersiz: { text: "Yetersiz veri", color: "var(--muted)" },
  };
  const FEAT = { ar: "geçen ayın değişimi", d_korku_gunluk: "korku", d_risk_istahi_gunluk: "risk iştahı", d_belirsizlik_gunluk: "belirsizlik",
    d_K1_istihdam: "istihdam kümesi", d_K2_borc: "borç kümesi", d_K3_makro: "makro kümesi", d_K4_guvenli_liman: "güvenli liman kümesi",
    d_K5_gecim: "geçim kümesi", d_K6_risk_istahi: "risk iştahı kümesi", d_K7_politika_belirsizlik: "politika kümesi" };

  let S = {}; // durum
  let range = 365;

  function renderStations() {
    const box = $("stations"); box.textContent = "";
    const L = S.latest, gen = new Date(L.generated_at);
    const age = (s) => s ? (gen - parseDate(s)) / 864e5 : 99;
    const chip = (state, text, title) => { const c = el("span", { cls: "chip", title }); c.insertAdjacentHTML("afterbegin", mini[state]); c.appendChild(document.createTextNode(text)); box.appendChild(c); };
    const te = L.data_window && L.data_window.trends_end;
    chip(age(te) <= 3 ? "ok" : "warn", `Trends · ${te ? shortDay(parseDate(te)).replace(/ \d{4}$/, "") : "yok"}`, "Son tam gün (kısmi gün kullanılmaz)");
    const ev = L.stations && L.stations.evds;
    chip(ev ? (ev.ok ? (ev.detail && ev.detail.partial ? "warn" : "ok") : "bad") : "idle", ev ? (ev.ok ? "EVDS" : "EVDS hata") : "EVDS · arşiv", ev && !ev.ok ? ev.detail : "TCMB EVDS hedef serileri");
    const tf = L.tefas && L.tefas.last_date;
    chip(age(tf) <= 4 ? "ok" : "warn", `TEFAS · ${tf ? shortDay(parseDate(tf)).replace(/ \d{4}$/, "") : "yok"}`, "Fon akımları");
    chip("idle", "Sosyal · sentetik", "Gerçek veri ortağı gelene kadar sentetik; hiçbir göstergeye girmez");
  }

  function renderHero() {
    const h = S.latest.headline, box = $("hero-main"), tiles = $("hero-tiles");
    box.textContent = ""; tiles.textContent = "";
    if (!h) { box.appendChild(el("div", { cls: "empty", text: S.latest.note || "Manşet için yeterli veri yok." })); return; }
    const w = el("div", { cls: "weather" });
    const ic = sv("svg", { viewBox: "0 0 64 64", class: "icon", "aria-hidden": "true" }); ic.innerHTML = ICONS[h.ikon] || ICONS.unknown;
    w.appendChild(ic);
    const txt = el("div");
    txt.appendChild(el("div", { cls: "date", text: `${dayStr(parseDate(h.date))} itibarıyla` }));
    txt.appendChild(el("div", { cls: "state", text: h.durum.charAt(0).toLocaleUpperCase("tr-TR") + h.durum.slice(1) }));
    if (h.uyari_kodu) {
      const b = el("span", { cls: "badge" }); b.appendChild(el("span", { cls: "dot", style: `background:${CODE_COLOR[h.uyari_kodu]}` }));
      b.appendChild(document.createTextNode(`${h.uyari_kodu.charAt(0).toLocaleUpperCase("tr-TR") + h.uyari_kodu.slice(1)} kod`)); txt.appendChild(b);
    }
    w.appendChild(txt); box.appendChild(w);
    const fig = el("div", { cls: "hero-fig" }, [`${Math.round(h.korku_pct)}.`]); fig.appendChild(el("small", { text: "yüzdelik" })); box.appendChild(fig);
    let ex = `Ekonomik korku aramaları son üç yılın günlerinin %${Math.round(h.korku_pct)}'${suffix(Math.round(h.korku_pct))} yüksek.`;
    if (isNum(h.korku_pct_30g_once)) ex += ` 30 gün önce ${Math.round(h.korku_pct_30g_once)}. yüzdelikteydi.`;
    box.appendChild(el("p", { cls: "explain", text: ex }));
    const sc = el("div", { cls: "scale", role: "img", "aria-label": `Ölçek: ${h.durum}` });
    STATE_ORDER.forEach((s) => sc.appendChild(el("div", { cls: s.k === h.durum ? "on" : null, text: `${s.k} ${s.lo}–${s.hi}` })));
    box.appendChild(sc);

    const sig = S.signal || [];
    const prev7 = sig.length > 8 ? sig[sig.length - 8] : null;
    const tile = (label, value, delta, hint) => {
      const t = el("div", { cls: "card tile" });
      t.appendChild(el("div", { cls: "label", text: label })); t.appendChild(el("div", { cls: "value", text: value }));
      if (delta) t.appendChild(el("div", { cls: "delta", text: delta }));
      if (hint) t.appendChild(el("div", { cls: "hint", text: hint }));
      tiles.appendChild(t);
    };
    tile("Basınç", `${fmt(h.basinc_hpa, 0)} hPa`, prev7 && isNum(prev7.basinc_hpa) ? `7 gün önce ${fmt(prev7.basinc_hpa, 0)} hPa` : null, "1013 olağan; düşük basınç yüksek korku");
    tile("Bulutluluk", `%${fmt(h.bulutluluk_pct, 0)}`, null, "Korku terimlerinin olağanın belirgin üstündeki payı (z > 1)");
    tile("Risk iştahı", fmt(h.risk_istahi, 2, true), null, "z; borsa, halka arz, kripto aramaları");
    tile("Belirsizlik", fmt(h.belirsizlik, 2, true), null, "z; politika ve seçim aramaları");
  }
  // Sayıya iyelik + ayrılma eki (okunuşa göre): 93'ünden, 2'sinden, 40'ından. 0-100 arası.
  const suffix = (n) => {
    if (n === 0) return "ından";
    if (n === 100) return "ünden";
    const ones = n % 10, tens = n - ones;
    if (ones) return { 1: "inden", 2: "sinden", 3: "ünden", 4: "ünden", 5: "inden", 6: "sından", 7: "sinden", 8: "inden", 9: "undan" }[ones];
    return { 10: "undan", 20: "sinden", 30: "undan", 40: "ından", 50: "sinden", 60: "ından", 70: "inden", 80: "inden", 90: "ından" }[tens];
  };
  const locSuffix = (n) => suffix(n).replace("nden", "nde").replace("ndan", "nda");

  function sliceRange(rows) {
    if (!range || !rows.length) return rows;
    const end = parseDate(rows[rows.length - 1].date), start = new Date(end.getTime() - range * 864e5);
    return rows.filter((r) => parseDate(r.date) >= start);
  }

  function renderSignal() {
    const rows = sliceRange(S.signal || []);
    const x = rows.map((r) => parseDate(r.date));
    const events = (S.latest.events || []).map((e, i) => ({ ...e, num: i + 1 }));
    lineChart($("ch-pct"), {
      x, series: [{ label: "Korku yüzdeliği", color: "var(--s1)", values: rows.map((r) => r.korku_pct), endLabel: null }],
      yMin: 0, yMax: 100, height: 250, refLines: [{ y: 70, label: "70 · sarı" }, { y: 85, label: "85 · turuncu" }, { y: 95, label: "95 · kırmızı" }],
      events, yFormat: (v) => fmt(v, 0), ariaLabel: "Korku endeksinin yüzdeliği, zaman serisi",
    });
    table($("tb-pct"), ["Tarih", "Yüzdelik", "Korku (z)", "Basınç (hPa)"], rows.slice().reverse().map((r) => [r.date, fmt(r.korku_pct, 1), fmt(r.korku, 2), fmt(r.basinc_hpa, 1)]), [1, 2, 3]);

    const comp = [
      { key: "korku", label: "Korku", color: "var(--s1)" },
      { key: "risk_istahi", label: "Risk iştahı", color: "var(--s2)" },
      { key: "belirsizlik", label: "Belirsizlik", color: "var(--s3)" },
    ];
    const lg = $("lg-comp"); lg.textContent = "";
    comp.forEach((c) => { const s = el("span"); s.appendChild(el("i", { style: `background:${c.color}` })); s.appendChild(document.createTextNode(c.label)); lg.appendChild(s); });
    lineChart($("ch-comp"), {
      x, series: comp.map((c) => ({ label: c.label, color: c.color, values: rows.map((r) => r[c.key]) })),
      height: 240, yFormat: (v) => fmt(v, 1), tooltipFormat: (v) => fmt(v, 2), ariaLabel: "Korku, risk iştahı ve belirsizlik bileşenleri",
    });
    table($("tb-comp"), ["Tarih", "Korku", "Risk iştahı", "Belirsizlik", "Endeksteki korku terimi"], rows.slice().reverse().map((r) => [r.date, fmt(r.korku, 2), fmt(r.risk_istahi, 2), fmt(r.belirsizlik, 2), r.n_terms]), [1, 2, 3, 4]);
  }

  function renderClusters() {
    const cw = S.clusters || [];
    const last = cw.slice(-52);
    if (!last.length) { $("ch-heat").appendChild(el("div", { cls: "empty", text: "Veri yok." })); return; }
    const weeks = last.map((r) => parseDate(r.week));
    const names = Object.fromEntries((S.latest.clusters_latest || []).map((c) => [c.id, c.name]));
    const keys = Object.keys(last[0]).filter((k) => k !== "week");
    const rows = keys.map((k) => ({ key: k, short: SHORT[k] || k, name: names[k] || k, values: last.map((r) => r[k]) }));
    divLegend($("lg-heat"));
    heatmap($("ch-heat"), weeks, rows);
    table($("tb-heat"), ["Hafta (bitiş)"].concat(rows.map((r) => r.short)), last.slice().reverse().map((r) => [r.week].concat(keys.map((k) => fmt(r[k], 2)))), rows.map((_, i) => i + 1));

    const terms = (S.terms || []);
    const elig = terms.filter((t) => (t.eligible === "True" || t.eligible === true) && !(t.attention === "True" || t.attention === true) && isNum(t.z7));
    const top = elig.slice().sort((a, b) => b.z7 - a.z7).slice(0, 8);
    const colors = divColors();
    barList($("ch-terms"), top.map((t) => ({ label: String(t.query).split("+")[0].trim(), value: t.z7, sub: `${SHORT[t.cluster] || t.cluster} · z (7 gün)` })),
      { color: (d) => colors[divClass(d.value)], format: (v) => fmt(v, 2, true), ariaLabel: "En çok yükselen terimler" });
    table($("tb-terms"), ["Terim", "Küme", "Sorgu", "Endekste", "z (7 gün)", "Sıfır payı (365 g)"], terms.map((t) => [t.id, SHORT[t.cluster] || t.cluster, t.query, (t.eligible === "True" || t.eligible === true) ? "evet" : "hayır (düşük hacim)", fmt(t.z7, 2), isNum(t.zero_share_365) ? `%${fmt(t.zero_share_365 * 100, 0)}` : "–"]), [4, 5]);
  }

  function renderNowcasts() {
    const box = $("nowcasts"); box.textContent = "";
    const lg = $("lg-nc"); lg.textContent = "";
    [["Gerçekleşen", "var(--s1)"], ["Model (arama sinyalli)", "var(--s2)"], ["AR(1) kıyası", "var(--s3)"]].forEach(([t, c]) => { const s = el("span"); s.appendChild(el("i", { style: `background:${c}` })); s.appendChild(document.createTextNode(t)); lg.appendChild(s); });
    const s = el("span"); s.appendChild(el("i", { cls: "band", style: "background:var(--s2)" })); s.appendChild(document.createTextNode("Modelin %80 aralığı")); lg.appendChild(s);
    const hist = S.nchist || [];
    const ncs = S.latest.nowcasts || [];
    const nSkill = ncs.filter((c) => c.label === "kanitli" || c.label === "zayif").length;
    const sum = $("nc-summary");
    if (sum && ncs.length) {
      const per = (ncs.find((c) => c.metrics && c.metrics.start) || {}).metrics;
      sum.textContent = nSkill === 0
        ? `Sonuç: ${per ? per.start + " – " + per.end + " döneminde" : "Örneklem dışı dönemde"} ${ncs.length} göstergenin hiçbirinde arama sinyali, son değeri tekrarlayan (rastgele yürüyüş) ya da AR(1) kıyasını istatistiksel olarak geçemedi. ` +
          "Bu yüzden kartlardaki büyük rakamlar, örneklem dışında daha isabetli olan kıyas modelinin tahminidir. Arama sinyali bugünkü haliyle resmi göstergelerin aylık değişimini önceden haber vermiyor; algı endeksi betimleyici bir ölçüm olarak okunmalı. " +
          "Her günün tahmini değiştirilemez biçimde arşivleniyor; yeni hipotezler yalnızca bundan sonraki verilerle sınanacak."
        : `Sonuç: ${ncs.length} göstergenin ${nSkill} tanesinde arama sinyali kıyasları geçti (etiketlere bakın). Diğerlerinde büyük rakam kıyas modelinin tahminidir.`;
    }
    const pending = [];
    ncs.forEach((c) => {
      const card = el("div", { cls: "card" });
      const head = el("div", { cls: "nc-head" });
      const ht = el("div"); ht.appendChild(el("h3", { text: c.name })); ht.appendChild(el("p", { cls: "sub", text: `${c.release || ""}` }));
      head.appendChild(ht);
      const L = LABELS[c.label] || LABELS.yetersiz;
      const lb = el("span", { cls: "nc-label" }); lb.appendChild(el("span", { cls: "dot", style: `background:${L.color}` })); lb.appendChild(document.createTextNode(L.text));
      head.appendChild(lb); card.appendChild(head);
      const lv = c.live, u = c.unit === "%" ? "%" : "";
      const dec = c.unit === "%" ? 2 : 1;
      const hm = c.headline_model || (c.label === "kanitli" || c.label === "zayif" ? "model" : "ar1");
      const useModel = hm === "model";
      if (lv && lv.status === "ok") {
        const m = new Date(Date.UTC(+lv.month.slice(0, 4), +lv.month.slice(5, 7) - 1, 1));
        const pick = { model: [lv.model, lv.model_lo, lv.model_hi], ar1: [lv.ar1, lv.ar1_lo, lv.ar1_hi], rw: [lv.rw, lv.rw_lo, lv.rw_hi] }[hm] || [lv.ar1, lv.ar1_lo, lv.ar1_hi];
        const [val, lo, hi] = pick;
        const fig = el("div", { cls: "nc-fig" });
        fig.appendChild(el("span", { cls: "big", text: `${u}${fmt(val, dec)}` }));
        fig.appendChild(el("span", { cls: "range", text: `${monthStr(m)} tahmini · %80 aralık ${u}${fmt(lo, dec)} – ${u}${fmt(hi, dec)}` }));
        card.appendChild(fig);
        const meta = el("p", { cls: "nc-meta" });
        const HM = { model: "arama sinyalli model", ar1: "AR(1) kıyası", rw: "rastgele yürüyüş (son değer)" };
        meta.appendChild(document.createTextNode(`Büyük rakam: ${HM[hm]}. Son açıklanan (${monthStr(new Date(Date.UTC(+lv.last_month.slice(0, 4), +lv.last_month.slice(5, 7) - 1, 1)))}): `));
        meta.appendChild(el("b", { text: `${u}${fmt(lv.last_actual, dec)}` }));
        meta.appendChild(document.createTextNode(useModel ? ` · AR(1) kıyası ${u}${fmt(lv.ar1, dec)}`
          : ` · arama sinyalli model ${u}${fmt(lv.model, dec)} (${c.label === "yetersiz" ? "karne için yeterli geçmiş yok" : "katkısı kanıtlanmadı"})`));
        meta.appendChild(document.createTextNode(` · sinyal penceresi ${lv.n_days}/${lv.expected_days} gün`));
        card.appendChild(meta);
        if (useModel && lv.contributions && lv.contributions.length) {
          const top = lv.contributions.filter((k) => k.feature !== "ar").slice(0, 2).map((k) => `${FEAT[k.feature] || k.feature} ${k.value > 0 ? "yukarı" : "aşağı"} (${fmt(k.value, 2, true)})`);
          if (top.length) card.appendChild(el("p", { cls: "contrib", text: `Tahmini en çok çeken: ${top.join(", ")}` }));
        }
      } else if (lv) {
        card.appendChild(el("p", { cls: "nc-meta", text: `${lv.month}: ${lv.status}` }));
      } else if (c.error) {
        card.appendChild(el("p", { cls: "nc-meta", text: c.error }));
      }
      const h = hist.filter((r) => r.target === c.id);
      const ch = el("div", { cls: "chart" }); card.appendChild(ch);
      box.appendChild(card);
      // Grafikler tüm kartlar ızgaraya yerleştikten sonra çizilir (aksi halde ilk kartlar geçici genişlikte ölçülür).
      pending.push(() => drawHist(ch, h, c, u, dec));
    });
    pending.forEach((f) => f());
  }

  function drawHist(ch, h, c, u, dec) {
      if (h.length) {
        const x = h.map((r) => parseDate(r.month + "-01"));
        lineChart(ch, {
          x, height: 190, endLabels: false,
          series: [
            { label: "Gerçekleşen", color: "var(--s1)", values: h.map((r) => r.actual) },
            { label: "Model", color: "var(--s2)", values: h.map((r) => r.model) },
            { label: "AR(1)", color: "var(--s3)", values: h.map((r) => r.ar1) },
          ],
          band: { lo: h.map((r) => r.lo), hi: h.map((r) => r.hi), color: "var(--s2)", label: "%80 aralık" },
          xLabel: monthStr, yFormat: (v) => fmt(v, c.unit === "%" ? 1 : 0), tooltipFormat: (v) => `${u}${fmt(v, dec)}`,
          ariaLabel: `${c.name}: örneklem dışı tahminler ve gerçekleşen`,
        });
      } else ch.appendChild(el("div", { cls: "empty", text: "Örneklem dışı geçmiş yok (yetersiz veri)." }));
  }

  function renderScorecard() {
    const cards = S.latest.nowcasts || [];
    const rows = cards.map((c) => {
      const m = c.metrics || {};
      const L = LABELS[c.label] || LABELS.yetersiz;
      const lab = el("span", { cls: "verdict" }); lab.appendChild(el("span", { cls: "dot", style: `display:inline-block;width:8px;height:8px;border-radius:50%;background:${L.color}` })); lab.appendChild(document.createTextNode(L.text));
      const p = m.dm_vs_best && isNum(m.dm_vs_best.p) ? fmt(m.dm_vs_best.p, 3) : "–";
      return [c.name, c.n_oos || 0, fmt(m.rmse_model, 2), fmt(m.rmse_ar1, 2), fmt(m.rmse_rw, 2),
        isNum(m.ratio_ar1) ? `${fmt(m.ratio_ar1, 2)} / ${fmt(m.ratio_rw, 2)}` : "–", `${p} / ${isNum(c.p_holm) ? fmt(c.p_holm, 3) : "–"}`,
        isNum(m.hit_model) ? `%${fmt(m.hit_model * 100, 0)} / %${fmt(m.hit_ar1 * 100, 0)}` : "–", isNum(m.coverage) ? `%${fmt(m.coverage * 100, 0)}` : "–", lab];
    });
    table($("scorecard"), ["Gösterge", "n (ay)", "RMSE model", "RMSE AR(1)", "RMSE RW", "Oran: AR(1) / RW", "p: ham / Holm", "Yön isabeti: model / AR(1)", "%80 aralık kapsaması", "Sonuç"], rows, [1, 2, 3, 4, 5, 6, 7, 8]);
    const per = cards.map((c) => c.metrics).find((m) => m && m.start);
    if (per) $("scorecard").appendChild(el("p", { cls: "sub", style: "padding:8px 10px;margin:0", text: `Örneklem dışı dönem: ${per.start} – ${per.end} (her ay yalnızca önceki verilerle yeniden tahmin).` }));
    const n = { kanitli: 0, zayif: 0, yok: 0, yetersiz: 0 };
    cards.forEach((c) => (n[c.label] = (n[c.label] || 0) + 1));
    $("score-note").textContent = `${cards.length} göstergeden ${n.kanitli}'${locSuffix(n.kanitli)} kanıtlı katkı, ${n.zayif}'${locSuffix(n.zayif)} zayıf kanıt var; ${n.yok + n.yetersiz}'${locSuffix(n.yok + n.yetersiz)} arama sinyali basit kıyasları istatistiksel olarak geçemedi. ` +
      "Yön isabeti, aylık değişimin işaretinin doğru tahmin edildiği ayların payıdır. Aralık kapsaması %80'e yakın olmalıdır; çok düşükse belirsizlik eksik, çok yüksekse fazla gösterilmektedir.";
  }

  function renderEvents() {
    const ev = S.latest.events || [];
    const rows = ev.map((e, i) => {
      let key = "idle", txt = "veri yok (sinyal bu tarihten sonra başlıyor)";
      if (e.status === "ok") {
        if (e.jump_pct >= 90) { key = "ok"; txt = "belirgin yükseliş"; }
        else if (e.jump_pct >= 75) { key = "warn"; txt = "zayıf yükseliş"; }
        else { key = "bad"; txt = "yükseliş yok"; }
      }
      const v = el("span", { cls: "verdict" }); v.insertAdjacentHTML("afterbegin", mini[key]); v.appendChild(document.createTextNode(txt));
      return [String(i + 1), e.name, dayStr(parseDate(e.date)), e.component === "korku" ? "Korku" : "Belirsizlik",
        e.status === "ok" ? fmt(e.jump, 2, true) : "–", e.status === "ok" ? `${fmt(e.jump_pct, 0)}.` : "–", isNum(e.peak_pct) ? `${fmt(e.peak_pct, 0)}.` : "–", v];
    });
    table($("events"), ["#", "Olay", "Tarih", "Bileşen", "Sıçrama (z)", "Sıçrama yüzdeliği", "14 gündeki en yüksek korku yüzdeliği", "Sonuç"], rows, [0, 4, 5, 6]);
  }

  function renderTefas() {
    const t = S.tefas || [], L = S.latest.tefas;
    const rk = t.filter((r) => isNum(r.riskten_kacis));
    if (rk.length) {
      lineChart($("ch-riskoff"), {
        x: rk.map((r) => parseDate(r.date)), series: [{ label: "Riskten kaçış", color: "var(--s1)", values: rk.map((r) => r.riskten_kacis) }],
        height: 220, yFormat: (v) => fmt(v, 1), tooltipFormat: (v) => fmt(v, 2), ariaLabel: "Riskten kaçış akım endeksi",
      });
      table($("tb-riskoff"), ["Tarih", "Endeks"], rk.slice().reverse().map((r) => [r.date, fmt(r.riskten_kacis, 2)]), [1]);
    } else $("ch-riskoff").appendChild(el("div", { cls: "empty", text: "Endeks için en az 120 iş günü gerekir." }));
    if (L && L.akim20_last) {
      const items = Object.entries(L.akim20_last).map(([k, v]) => ({ label: FUND[k] || k, value: v, sub: "milyar TL, son 20 iş günü" })).sort((a, b) => b.value - a.value);
      barList($("ch-flows"), items, { color: "var(--s1)", format: (v) => fmt(v, 1, true), ariaLabel: "Fon türüne göre son 20 iş günü net akım" });
    }
    const v = L && L.validity;
    if (v && isNum(v.spearman)) {
      const crit = 1.96 / Math.sqrt(Math.max(1, v.n_weeks - 1));
      const strength = Math.abs(v.spearman) < 0.2 ? "zayıf" : Math.abs(v.spearman) < 0.4 ? "zayıf-orta" : "orta veya güçlü";
      $("validity-note").textContent = `Yakınsak geçerlilik: korku endeksi ile riskten kaçış akımı arasında haftalık Spearman ρ = ${fmt(v.spearman, 2)} (${v.n_weeks} hafta, ${shortDay(parseDate(v.start))} – ${shortDay(parseDate(v.end))}). ` +
        `İlişki ${strength}; ${Math.abs(v.spearman) > crit ? "kaba eşiği" : "kaba eşiği bile"} (±${fmt(crit, 2)}) ${Math.abs(v.spearman) > crit ? "aşıyor, ancak haftalık seriler otokorelasyonlu olduğu için bu eşik iyimserdir" : "aşmıyor"}. ` +
        "İki ölçüm farklı şeyleri yakalıyor olabilir; TEFAS arşivi uzadıkça yeniden değerlendirilecek.";
    }
  }

  function renderFoot() {
    const L = S.latest, f = $("foot"); f.textContent = "";
    const gen = new Date(L.generated_at);
    f.appendChild(document.createTextNode(`Üretildi: ${gen.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (İstanbul) · Yöntem ${L.method_version || ""} · ` +
      (L.data_window ? `Trends ${L.data_window.trends_start} – ${L.data_window.trends_end}, sinyal ${L.data_window.signal_start} itibarıyla · ` : "") +
      (L.quality ? `Endekste ${L.quality.terms_eligible}/${L.quality.terms_total} terim · ` : "") + "Yatırım tavsiyesi değildir."));
    f.appendChild(el("br"));
    f.appendChild(document.createTextNode("Veri kaynakları: Google Trends (Google LLC); TCMB Elektronik Veri Dağıtım Sistemi (EVDS); TÜİK; TEFAS (Takasbank). " +
      "Göstergeler bu verilerden türetilmiştir; kaynak kurumlar sonuçlardan sorumlu değildir."));
  }

  function renderAll() {
    renderStations(); renderHero(); renderSignal(); renderClusters(); renderNowcasts(); renderScorecard(); renderEvents(); renderTefas(); renderFoot();
  }

  // ------------------------------------------------------------------ tema ve olaylar
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode); else root.removeAttribute("data-theme");
    $("theme").textContent = `Tema: ${mode === "light" ? "açık" : mode === "dark" ? "koyu" : "otomatik"}`;
    try { localStorage.setItem("dii-theme", mode); } catch (e) { /* depolama yok */ }
  }
  let theme = "auto";
  try { theme = localStorage.getItem("dii-theme") || "auto"; } catch (e) { theme = "auto"; }
  applyTheme(theme);
  $("theme").addEventListener("click", () => { theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto"; applyTheme(theme); if (S.latest) { renderClusters(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => S.latest && renderClusters());

  $("range").addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    range = Number(b.dataset.range);
    $("range").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderSignal();
  });
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => S.latest && renderAll(), 150); });

  // ------------------------------------------------------------------ yükleme
  (async function load() {
    try {
      const [latest, signal, clusters, terms, tefas, nchist] = await Promise.all([
        getJSON("data/latest.json"), getCSV("data/signal.csv"), getCSV("data/clusters_weekly.csv"),
        getCSV("data/terms.csv"), getCSV("data/tefas.csv"), getCSV("data/nowcast_history.csv"),
      ]);
      S = { latest, signal: signal || [], clusters: clusters || [], terms: terms || [], tefas: tefas || [], nchist: nchist || [] };
      renderAll();
    } catch (e) {
      $("hero-main").textContent = "";
      $("hero-main").appendChild(el("div", { cls: "empty", text: "Veri yüklenemedi. Sayfa bir web sunucusu üzerinden açılmalı (örn. python -m http.server -d site)." }));
    }
  })();
})();
