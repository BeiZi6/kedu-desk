import { BarTuple, fmtBarTime, fmtPrice } from './market';

export interface ChartBlob {
  spec: Record<string, any>;
  data: {
    rows: BarTuple[];
    pre: number;
    cmp?: (number | null)[];
  };
}

export type GlossTuple = [string, string, string]; // [namesPipeSeparated, explanation, lessonId]

const NS = 'http://www.w3.org/2000/svg';
const NAMES: Record<string, string> = {
  BTC: 'BTC/USDT',
  ETH: 'ETH/USDT',
  ANT: 'ANT 永续（OKX）',
  SOL: 'SOL/USDT',
  DOGE: 'DOGE/USDT',
  ZEC: 'ZEC/USDT',
  WLD: 'WLD/USDT',
};
const BARS: Record<string, string> = {
  '1D': '日线',
  '4H': '4 小时线',
  '1H': '1 小时线',
  '15m': '15 分钟线',
  '1W': '周线',
};

function E(tag: string, attrs: Record<string, any>, text?: string | number): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) {
    if (attrs[k] !== null && attrs[k] !== undefined) {
      el.setAttribute(k, String(attrs[k]));
    }
  }
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

function estWidth(s: string, fs: number): number {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 1 : 0.58;
  return w * fs;
}

function niceTicks(min: number, max: number, n: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const r = step0 / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function sma(rows: BarTuple[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let s = 0;
  for (let i = 0; i < rows.length; i++) {
    s += rows[i][4];
    if (i >= n) s -= rows[i - n][4];
    out.push(i >= n - 1 ? s / n : null);
  }
  return out;
}

function emaArr(vals: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (n + 1);
  let e: number | null = null;
  let s = 0;
  let c = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v === null) {
      out.push(null);
      continue;
    }
    if (c < n - 1) {
      s += v;
      c++;
      out.push(null);
    } else if (c === n - 1) {
      s += v;
      c++;
      e = s / n;
      out.push(e);
    } else {
      e = v * k + (e as number) * (1 - k);
      out.push(e);
    }
  }
  return out;
}

function ema(rows: BarTuple[], n: number): (number | null)[] {
  return emaArr(rows.map((r) => r[4]), n);
}

function rsi(rows: BarTuple[], n: number): (number | null)[] {
  const out: (number | null)[] = [null];
  let ag = 0;
  let al = 0;
  for (let i = 1; i < rows.length; i++) {
    const ch = rows[i][4] - rows[i - 1][4];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    if (i <= n) {
      ag += g / n;
      al += l / n;
      out.push(i === n ? 100 - 100 / (1 + ag / (al || 1e-12)) : null);
    } else {
      ag = (ag * (n - 1) + g) / n;
      al = (al * (n - 1) + l) / n;
      out.push(100 - 100 / (1 + ag / (al || 1e-12)));
    }
  }
  return out;
}

function atr(rows: BarTuple[], n: number): (number | null)[] {
  const out: (number | null)[] = [null];
  let a = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const pc = rows[i - 1][4];
    const t = Math.max(r[2] - r[3], Math.abs(r[2] - pc), Math.abs(r[3] - pc));
    if (i <= n) {
      a += t / n;
      out.push(i === n ? a : null);
    } else {
      a = (a * (n - 1) + t) / n;
      out.push(a);
    }
  }
  return out;
}

function macd(rows: BarTuple[]) {
  const f = ema(rows, 12);
  const s = ema(rows, 26);
  const dif = f.map((v, i) => (v === null || s[i] === null ? null : v - (s[i] as number)));
  const dea = emaArr(dif, 9);
  const hist = dif.map((v, i) => (v === null || dea[i] === null ? null : v - (dea[i] as number)));
  return { dif, dea, hist };
}

function boll(rows: BarTuple[], n: number, k: number) {
  const m = sma(rows, n);
  const up: (number | null)[] = [];
  const dn: (number | null)[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (m[i] === null) {
      up.push(null);
      dn.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += Math.pow(rows[j][4] - (m[i] as number), 2);
    const sd = Math.sqrt(s / n);
    up.push((m[i] as number) + k * sd);
    dn.push((m[i] as number) - k * sd);
  }
  return { mid: m, up, dn };
}

export function mountChartFigure(fig: HTMLElement, blob: ChartBlob): () => void {
  const spec = blob.spec;
  const D = blob.data;
  const cap = fig.querySelector('figcaption');
  // Clear any previous mounted header/cv/lg while keeping figcaption
  fig.querySelectorAll('.hd, .cv, .lg, script.cd').forEach((n) => n.remove());

  const intraday = spec.bar !== '1D' && spec.bar !== '1W';
  const hint = intraday ? '北京时间 · 悬停或点击任一 K 线读数' : '悬停或点击任一 K 线读数';

  const hd = document.createElement('div');
  hd.className = 'hd';
  hd.innerHTML = `<span class="ttl">${
    spec.title || `${NAMES[spec.sym] || spec.sym} · ${BARS[spec.bar] || spec.bar}`
  }${spec.log ? ' · 对数坐标' : ''}</span><span class="ro">${hint}</span>`;

  const cv = document.createElement('div');
  cv.className = 'cv';
  const lg = document.createElement('div');
  lg.className = 'lg';

  fig.insertBefore(lg, cap);
  fig.insertBefore(cv, lg);
  fig.insertBefore(hd, cv);

  const draw = () => {
    const rowsAll = D.rows;
    const pre = D.pre || 0;
    const rows = rowsAll.slice(pre);
    const n = rows.length;
    if (!n) return;

    const W = Math.max(280, Math.floor(cv.clientWidth || 640));
    const small = W < 520;
    const H0 = spec.h || (small ? 290 : 346);
    const sub = spec.sub;
    const sh = sub ? (small ? 68 : 80) : 0;
    const H = H0 + (sh ? sh + 14 : 0);
    const mL = 6;
    const mR = small ? 58 : 66;
    const mT = 18;
    const mB = 24;
    const pw = W - mL - mR;
    const phAll = H0 - mT - mB;
    const vh = spec.vol === false ? 0 : Math.round(phAll * 0.16);
    const ph = phAll - vh - (vh ? 6 : 0);
    const sy0 = mT + phAll + 12;
    const bottom = sh ? sy0 + sh : mT + phAll;
    const cw = pw / n;
    const bw = Math.max(1.1, Math.min(cw * 0.68, 13));

    const idxMap: Record<string, number> = {};
    rows.forEach((r, i) => {
      idxMap[fmtBarTime(r[0], intraday)] = i;
    });
    const xi = (key?: string | null): number => {
      if (!key) return 0;
      if (idxMap[key] !== undefined) return idxMap[key];
      let best = 0;
      for (let i = 0; i < n; i++) {
        if (fmtBarTime(rows[i][0], intraday) <= key) best = i;
      }
      return best;
    };
    const X = (i: number) => mL + (i + 0.5) * cw;

    let cmp: (number | null)[] | null = null;
    if (D.cmp) {
      const cvSlice = D.cmp.slice(pre);
      const b0 = cvSlice.findIndex((v) => v !== null);
      if (b0 >= 0) {
        const baseVal = cvSlice[b0] as number;
        cmp = cvSlice.map((v) => (v === null ? null : (v / baseVal) * rows[b0][4]));
      }
    }

    const bb = spec.bb ? boll(rowsAll, spec.bb[0], spec.bb[1]) : null;
    let lo = Infinity;
    let hi = -Infinity;
    rows.forEach((r) => {
      if (r[3] < lo) lo = r[3];
      if (r[2] > hi) hi = r[2];
    });
    (spec.ann || []).forEach((a: any) => {
      ['p', 'p1', 'p2', 'pa', 'pb'].forEach((k) => {
        if (typeof a[k] === 'number') {
          if (a[k] < lo) lo = a[k];
          if (a[k] > hi) hi = a[k];
        }
      });
    });
    if (cmp) {
      cmp.forEach((v) => {
        if (v !== null) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      });
    }
    if (bb) {
      for (let z = pre; z < rowsAll.length; z++) {
        if (bb.up[z] !== null && (bb.up[z] as number) > hi) hi = bb.up[z] as number;
        if (bb.dn[z] !== null && (bb.dn[z] as number) < lo) lo = bb.dn[z] as number;
      }
    }

    const isLog = !!spec.log;
    const f = isLog ? (v: number) => Math.log(Math.max(v, 1e-9)) : (v: number) => v;
    let hasUp = false;
    let hasDn = false;
    (spec.ann || []).forEach((a: any) => {
      if (a.k !== 'pt') return;
      const up = a.dir ? a.dir === 'up' : (a.at || 'h') !== 'l';
      if (up) hasUp = true;
      else hasDn = true;
    });

    const span = f(hi) - f(lo) || 1;
    const a0 = f(lo) - span * (hasDn ? 0.24 : 0.08);
    const a1 = f(hi) + span * (hasUp ? 0.26 : 0.1);
    const Y = (p: number) => mT + ph - ((f(p) - a0) / (a1 - a0)) * ph;

    const svg = E('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img' });

    // Price grid
    let tk: number[] = [];
    if (isLog) {
      const m0 = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1e-6))));
      for (let m = m0; m <= hi * 1.2; m *= 10) {
        [1, 2, 5].forEach((k) => {
          if (k * m >= lo * 0.9 && k * m <= hi * 1.15) tk.push(k * m);
        });
      }
    } else {
      tk = niceTicks(a0, a1, small ? 4 : 5);
    }
    tk.forEach((v) => {
      const y = Y(v);
      if (y < mT - 2 || y > mT + ph + 2) return;
      svg.appendChild(E('line', { class: 'grid', x1: mL, x2: mL + pw, y1: y, y2: y }));
      svg.appendChild(E('text', { class: 'ax', x: mL + pw + 6, y: y + 4 }, fmtPrice(v)));
    });

    // Time ticks
    const want = small ? 4 : 6;
    let lastX = -99;
    let prevLab = '';
    const off8 = intraday ? 8 * 3600 : 0;
    const spanD = (rows[n - 1][0] - rows[0][0]) / 86400;
    const pad2 = (x: number) => (x < 10 ? `0${x}` : `${x}`);
    for (let i = 0; i < n; i++) {
      const d = new Date((rows[i][0] + off8) * 1000);
      const p = i ? new Date((rows[i - 1][0] + off8) * 1000) : null;
      let lab: string | null = null;
      if (!intraday) {
        if (spanD > 900) {
          if (!p || p.getUTCFullYear() !== d.getUTCFullYear()) lab = `${d.getUTCFullYear()}`;
        } else if (spanD > 45) {
          if (!p || p.getUTCMonth() !== d.getUTCMonth()) {
            lab = `${d.getUTCMonth() === 0 || !p ? `${d.getUTCFullYear() % 100}年` : ''}${d.getUTCMonth() + 1}月`;
          }
        } else if (i % Math.max(1, Math.ceil(n / want)) === 0) {
          lab = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        }
      } else {
        const spanH = spanD * 24;
        if (spanH > 60) {
          if (!p || p.getUTCDate() !== d.getUTCDate()) lab = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        } else if (
          d.getUTCMinutes() === 0 &&
          d.getUTCHours() % (spanH > 30 ? 12 : spanH > 14 ? 6 : 3) === 0
        ) {
          lab =
            d.getUTCHours() === 0
              ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
              : `${pad2(d.getUTCHours())}:00`;
        }
      }
      if (lab && X(i) - lastX > (small ? 48 : 56) && lab !== prevLab) {
        svg.appendChild(E('line', { class: 'grid', x1: X(i), x2: X(i), y1: bottom, y2: bottom + 4 }));
        const edge = X(i) < 28;
        svg.appendChild(
          E(
            'text',
            { class: 'ax', x: edge ? mL + 1 : X(i), y: H - 5, 'text-anchor': edge ? 'start' : 'middle' },
            lab,
          ),
        );
        lastX = X(i);
        prevLab = lab;
      }
    }

    // Volume
    if (vh) {
      let vmax = 0;
      rows.forEach((r) => {
        if (r[5] > vmax) vmax = r[5];
      });
      rows.forEach((r, i) => {
        const h = vmax ? (r[5] / vmax) * vh : 0;
        svg.appendChild(
          E('rect', {
            class: r[4] >= r[1] ? 'vu' : 'vd',
            x: X(i) - bw / 2,
            y: mT + phAll - h,
            width: bw,
            height: Math.max(0.6, h),
          }),
        );
      });
    }

    const drawPath = (
      vals: (number | null)[],
      yf: (v: number) => number,
      cls: string,
      extra?: Record<string, any>,
    ) => {
      let dd = '';
      let pen = false;
      vals.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) {
          pen = false;
          return;
        }
        dd += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${yf(v).toFixed(1)}`;
        pen = true;
      });
      if (!dd) return;
      svg.appendChild(E('path', { class: cls, d: dd, style: 'fill:none', ...(extra || {}) }));
    };

    lg.innerHTML = '';
    const chip = (html: string) => {
      const s = document.createElement('span');
      s.innerHTML = html;
      lg.appendChild(s);
    };

    if (bb) {
      drawPath(bb.up.slice(pre), Y, 'a-b', { 'stroke-width': 1.1, opacity: 0.75 });
      drawPath(bb.dn.slice(pre), Y, 'a-b', { 'stroke-width': 1.1, opacity: 0.75 });
      drawPath(bb.mid.slice(pre), Y, 'a-b', {
        'stroke-width': 1,
        'stroke-dasharray': '4 3',
        opacity: 0.6,
      });
      chip(`<i style="border-color:var(--acc)"></i>布林带(${spec.bb[0]},${spec.bb[1]})`);
    }

    if (spec.line) {
      drawPath(
        rows.map((r) => r[4]),
        Y,
        'a-n',
        { 'stroke-width': 1.6 },
      );
    } else {
      const g = E('g', {});
      rows.forEach((r, i) => {
        const up = r[4] >= r[1];
        const c = up ? 'cu' : 'cd';
        const x = X(i);
        g.appendChild(E('line', { class: c, x1: x, x2: x, y1: Y(r[2]), y2: Y(r[3]), 'stroke-width': 1 }));
        const y1 = Y(Math.max(r[1], r[4]));
        const y2 = Y(Math.min(r[1], r[4]));
        g.appendChild(
          E('rect', {
            class: c,
            x: x - bw / 2,
            y: y1,
            width: bw,
            height: Math.max(1.2, y2 - y1),
            'stroke-width': 0,
          }),
        );
      });
      svg.appendChild(g);
    }

    let mi = 0;
    (
      [
        ['ma', sma, 'MA'],
        ['ema', ema, 'EMA'],
      ] as const
    ).forEach(([key, fn, prefix]) => {
      (spec[key] || []).forEach((per: number) => {
        mi++;
        drawPath(fn(rowsAll, per).slice(pre), Y, `ma ma${mi}`);
        chip(`<i style="border-color:var(--ma${mi})"></i>${prefix}${per}`);
      });
    });

    if (cmp) {
      drawPath(cmp, Y, 'a-y', { 'stroke-width': 1.6 });
      chip(`<i style="border-color:var(--amb)"></i>${spec.cmp}（同起点涨跌幅折算）`);
    }
    (spec.lg || []).forEach((t: string) => chip(t));

    // Subcharts (RSI, ATR, MACD)
    let subVals: (number | null)[] | null = null;
    let subName = '';
    if (sub) {
      const sy1 = sy0 + sh;
      svg.appendChild(E('rect', { x: mL, y: sy0, width: pw, height: sh, fill: 'none', class: 'grid' }));
      const SY = (v: number, mn: number, mx: number) => sy1 - 4 - ((v - mn) / (mx - mn || 1)) * (sh - 8);
      if (sub === 'rsi') {
        const rv = rsi(rowsAll, 14).slice(pre);
        subVals = rv;
        subName = 'RSI14';
        [30, 70].forEach((lv) => {
          svg.appendChild(
            E('line', { class: 'cross', x1: mL, x2: mL + pw, y1: SY(lv, 0, 100), y2: SY(lv, 0, 100) }),
          );
          svg.appendChild(E('text', { class: 'ax', x: mL + pw + 6, y: SY(lv, 0, 100) + 4 }, lv));
        });
        drawPath(rv, (v) => SY(v, 0, 100), 'ma ma2');
      } else if (sub === 'atr') {
        const av = atr(rowsAll, 14).slice(pre);
        let amx = 0;
        av.forEach((v) => {
          if (v !== null && v > amx) amx = v;
        });
        amx = amx || 1;
        subVals = av;
        subName = 'ATR14';
        svg.appendChild(
          E('text', { class: 'ax', x: mL + pw + 6, y: SY(amx, 0, amx * 1.05) + 8 }, fmtPrice(amx)),
        );
        drawPath(av, (v) => SY(v, 0, amx * 1.05), 'ma ma3');
      } else if (sub === 'macd') {
        const mc = macd(rowsAll);
        const dif = mc.dif.slice(pre);
        const dea = mc.dea.slice(pre);
        const hs = mc.hist.slice(pre);
        let mm = 0;
        dif.concat(dea, hs).forEach((v) => {
          if (v !== null && Math.abs(v) > mm) mm = Math.abs(v);
        });
        mm = mm || 1;
        subVals = hs;
        subName = 'MACD 柱';
        const yz = SY(0, -mm, mm);
        svg.appendChild(E('line', { class: 'grid', x1: mL, x2: mL + pw, y1: yz, y2: yz }));
        hs.forEach((v, i) => {
          if (v === null) return;
          const y = SY(v, -mm, mm);
          svg.appendChild(
            E('rect', {
              class: v >= 0 ? 'cu' : 'cd',
              x: X(i) - bw / 2,
              y: Math.min(y, yz),
              width: bw,
              height: Math.max(0.6, Math.abs(y - yz)),
              'stroke-width': 0,
              opacity: 0.6,
            }),
          );
        });
        drawPath(dif, (v) => SY(v, -mm, mm), 'ma ma1');
        drawPath(dea, (v) => SY(v, -mm, mm), 'ma ma2');
        chip('<i style="border-color:var(--ma1)"></i>快线 DIF');
        chip('<i style="border-color:var(--ma2)"></i>慢线 DEA');
      }
      svg.appendChild(
        E('text', { class: 'ax', x: mL + 6, y: sy0 + 14 }, sub === 'macd' ? 'MACD(12,26,9)' : subName),
      );
    }

    // Annotations with automatic label collision avoidance
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const label = (
      x: number,
      y: number,
      text: string,
      cls: string,
      anchor: string,
      pref?: number,
    ) => {
      const lines = String(text).split('|');
      const fs = 14;
      let w = 0;
      lines.forEach((l) => {
        w = Math.max(w, estWidth(l, fs));
      });
      w += 12;
      const h = lines.length * 17 + 6;
      let bx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      bx = Math.max(mL + 2, Math.min(mL + pw - w - 2, bx));
      let by = y - h / 2;
      let tries = 0;
      let dir = pref || (by < mT + ph / 2 ? 1 : -1);
      const hit = () =>
        placed.some((r) => bx < r.x + r.w && bx + w > r.x && by < r.y + r.h && by + h > r.y);
      while (hit() && tries++ < 8) {
        by += dir * (h + 2);
        if (by < mT - 10 || by > mT + phAll - h) {
          dir = -dir;
          by = y - h / 2 + dir * (h + 2);
        }
      }
      by = Math.max(mT - 10, Math.min(mT + phAll - h, by));
      placed.push({ x: bx, y: by, w, h });
      const gg = E('g', {});
      gg.appendChild(E('rect', { class: 'lbg', x: bx, y: by, width: w, height: h, rx: 4 }));
      lines.forEach((l, k) => {
        gg.appendChild(
          E('text', { class: `lb ${cls}`, x: bx + 6, y: by + 15 + k * 17, stroke: 'none' }, l),
        );
      });
      svg.appendChild(gg);
    };

    (spec.ann || []).forEach((a: any) => {
      const c = `a-${a.c || 'n'}`;
      const i0 = a.a != null ? xi(a.a) : 0;
      const i1 = a.b != null ? xi(a.b) : n - 1;
      if (a.k === 'h') {
        const y = Y(a.p);
        const x0 = a.a != null ? X(i0) - cw / 2 : mL;
        const x1 = a.b != null ? X(i1) + cw / 2 : mL + pw;
        svg.appendChild(
          E('line', {
            class: c,
            x1: x0,
            x2: x1,
            y1: y,
            y2: y,
            'stroke-width': 1.4,
            'stroke-dasharray': a.solid ? null : '5 4',
          }),
        );
        if (a.t) {
          label(
            a.side === 'r' ? x1 - 4 : x0 + 4,
            y + (a.below ? 12 : -12),
            a.t,
            c,
            a.side === 'r' ? 'end' : 'start',
          );
        }
      } else if (a.k === 'zone') {
        const ya = Y(Math.max(a.p1, a.p2));
        const yb = Y(Math.min(a.p1, a.p2));
        const xa = a.a != null ? X(i0) - cw / 2 : mL;
        const xb = a.b != null ? X(i1) + cw / 2 : mL + pw;
        svg.appendChild(
          E('rect', { class: `zf ${c}`, x: xa, y: ya, width: xb - xa, height: Math.max(2, yb - ya) }),
        );
        svg.appendChild(
          E('line', { class: c, x1: xa, x2: xb, y1: ya, y2: ya, 'stroke-width': 1, opacity: 0.5 }),
        );
        svg.appendChild(
          E('line', { class: c, x1: xa, x2: xb, y1: yb, y2: yb, 'stroke-width': 1, opacity: 0.5 }),
        );
        if (a.t) {
          label(
            a.side === 'r' ? xb - 4 : xa + 4,
            a.below ? yb + 13 : ya - 12,
            a.t,
            c,
            a.side === 'r' ? 'end' : 'start',
          );
        }
      } else if (a.k === 'line') {
        const xA = X(i0);
        const xB = X(i1);
        const yA = Y(a.pa);
        const yB = Y(a.pb);
        let xE = xB;
        let yE = yB;
        if (a.ext && i1 > i0) {
          xE = mL + pw;
          yE = yA + ((yB - yA) * (xE - xA)) / (xB - xA);
        }
        svg.appendChild(
          E('line', {
            class: c,
            x1: xA,
            y1: yA,
            x2: xE,
            y2: yE,
            'stroke-width': 1.6,
            'stroke-dasharray': a.dash ? '5 4' : null,
          }),
        );
        if (a.t) label(xB + 6, yB - 14, a.t, c, 'start');
      } else if (a.k === 'pt') {
        const i = xi(a.d);
        const r = rows[i];
        const mapIdx: Record<string, number> = { o: 1, h: 2, l: 3, c: 4 };
        const pr = typeof a.at === 'number' ? a.at : r[mapIdx[a.at || 'h']];
        const upw = a.dir ? a.dir === 'up' : (a.at || 'h') !== 'l';
        const x = X(i);
        const y0 = Y(pr);
        const off = (a.off || 28) * (upw ? -1 : 1);
        svg.appendChild(E('circle', { class: c, cx: x, cy: y0 + (upw ? -5 : 5), r: 2.8 }));
        svg.appendChild(
          E('line', {
            class: c,
            x1: x,
            x2: x,
            y1: y0 + (upw ? -8 : 8),
            y2: y0 + off + (upw ? 8 : -8),
            'stroke-width': 1,
          }),
        );
        const lh = String(a.t).split('|').length * 17 + 6;
        label(x, y0 + off + (upw ? -lh / 2 + 4 : lh / 2 - 4), a.t, c, a.al || 'middle', upw ? -1 : 1);
      } else if (a.k === 'v') {
        const xv = X(xi(a.d));
        svg.appendChild(
          E('line', {
            class: c,
            x1: xv,
            x2: xv,
            y1: mT,
            y2: bottom,
            'stroke-width': 1.2,
            'stroke-dasharray': '3 4',
          }),
        );
        if (a.t) label(xv + 5, mT + 10 + (a.row || 0) * 22, a.t, c, a.al || 'start');
      } else if (a.k === 'rng') {
        const xa2 = X(i0);
        const xb2 = X(i1);
        const ya2 = Y(a.pa);
        const yb2 = Y(a.pb);
        svg.appendChild(
          E('line', {
            class: c,
            x1: xa2,
            y1: ya2,
            x2: xb2,
            y2: yb2,
            'stroke-width': 1.3,
            'stroke-dasharray': '2 3',
          }),
        );
        const pct = (a.pb / a.pa - 1) * 100;
        label(
          (xa2 + xb2) / 2,
          (ya2 + yb2) / 2,
          a.t || `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
          c,
          'middle',
        );
      } else if (a.k === 'note') {
        label(X(xi(a.d)), Y(a.p), a.t, c, a.al || 'middle');
      }
    });

    const cross = E('line', { class: 'cross', y1: mT, y2: bottom, x1: -9, x2: -9 });
    svg.appendChild(cross);
    const roEl = hd.querySelector('.ro') as HTMLElement;

    const show = (i: number | null) => {
      if (i === null) {
        cross.setAttribute('x1', '-9');
        cross.setAttribute('x2', '-9');
        roEl.textContent = hint;
        return;
      }
      const r = rows[i];
      const prev = i ? rows[i - 1][4] : pre ? rowsAll[pre - 1][4] : r[1];
      const ch = (r[4] / prev - 1) * 100;
      cross.setAttribute('x1', String(X(i)));
      cross.setAttribute('x2', String(X(i)));
      const subStr =
        subVals && subVals[i] !== null
          ? ` · ${subName} ${sub === 'rsi' ? (subVals[i] as number).toFixed(1) : fmtPrice(subVals[i] as number)}`
          : '';
      roEl.innerHTML = `${fmtBarTime(r[0], intraday)} 开${fmtPrice(r[1])} 高${fmtPrice(r[2])} 低${fmtPrice(r[3])} 收${fmtPrice(r[4])} <span class="${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span>${subStr}`;
    };

    const onPtr = (ev: PointerEvent) => {
      const b = svg.getBoundingClientRect();
      const x = (ev.clientX - b.left) * (W / (b.width || W));
      const idx = Math.floor((x - mL) / cw);
      show(idx >= 0 && idx < n ? idx : null);
    };
    svg.addEventListener('pointermove', onPtr);
    svg.addEventListener('pointerdown', onPtr);
    svg.addEventListener('pointerleave', () => show(null));

    cv.innerHTML = '';
    cv.appendChild(svg);
  };

  draw();
  let timer: number | undefined;
  let lastW = cv.clientWidth;
  const observer = new ResizeObserver(() => {
    if (Math.abs(cv.clientWidth - lastW) < 8) return;
    lastW = cv.clientWidth;
    window.clearTimeout(timer);
    timer = window.setTimeout(draw, 100);
  });
  observer.observe(cv);
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}

export function enhanceRichContainer(opts: {
  root: HTMLElement;
  scopeKey: string;
  charts: Record<string, ChartBlob>;
  glossary: GlossTuple[];
  onOpenTerm: (term: { title: string; exp: string; lessonId: string; rect: DOMRect }) => void;
  onRouteHref: (href: string) => void;
}): () => void {
  const { root, scopeKey, charts, glossary, onOpenTerm, onRouteHref } = opts;
  const cleanups: (() => void)[] = [];

  // 1. Auto-number section h2s cleanly inside lessons
  const secH2s = root.querySelectorAll('section.sec > h2');
  secH2s.forEach((h2, idx) => {
    const text = h2.textContent || '';
    if (!/^\d+\./.test(text) && text !== '自测' && text !== '本课作业') {
      h2.textContent = `${idx + 1}. ${text}`;
    }
  });

  // 2. Render KaTeX math formulas if loaded
  const renderMath = (window as any).renderMathInElement;
  if (typeof renderMath === 'function') {
    try {
      renderMath(root, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } catch {
      // ignore math error
    }
  }

  // 3. Mount all visible K-line charts
  const mountVisibleCharts = (scopeEl: ParentNode) => {
    scopeEl.querySelectorAll<HTMLElement>('figure.cht[id]').forEach((fig) => {
      if (fig.dataset.mounted === '1') return;
      const blob = charts[fig.id];
      if (!blob) return;
      fig.dataset.mounted = '1';
      cleanups.push(mountChartFigure(fig, blob));
    });
  };
  mountVisibleCharts(root);

  // 4. First-occurrence inline glossary terms inside <p> and <li> (skipping quizzes/headings/links/code/katex)
  if (glossary.length > 0 && scopeKey.startsWith('l')) {
    const termMap = new Map<string, { title: string; exp: string; lessonId: string }>();
    const allNames: string[] = [];
    for (const [namesStr, exp, lid] of glossary) {
      const parts = namesStr.split('|').filter((x) => x.length >= 2);
      const primary = parts[0] || namesStr;
      for (const nm of parts) {
        termMap.set(nm, { title: primary, exp, lessonId: lid });
        allNames.push(nm);
      }
    }
    allNames.sort((a, b) => b.length - a.length);
    const escaped = allNames.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join('|')})`, 'g');
    const annotated = new Set<string>();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (
          p.closest(
            'a, button, code, pre, h1, h2, h3, h4, summary, figcaption, svg, .katex, .qz, .gl-term',
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return p.closest('p, li, td') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes: Text[] = [];
    let curNode = walker.nextNode();
    while (curNode) {
      textNodes.push(curNode as Text);
      curNode = walker.nextNode();
    }

    for (const tn of textNodes) {
      const val = tn.nodeValue || '';
      if (!re.test(val)) continue;
      re.lastIndex = 0;
      let last = 0;
      let changed = false;
      const frag = document.createDocumentFragment();
      let m: RegExpExecArray | null;
      while ((m = re.exec(val)) !== null) {
        const word = m[1];
        const info = termMap.get(word);
        if (!info || annotated.has(info.title)) continue;
        annotated.add(info.title);
        changed = true;
        if (m.index > last) {
          frag.appendChild(document.createTextNode(val.slice(last, m.index)));
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gl-term';
        btn.textContent = word;
        btn.onclick = (e) => {
          e.stopPropagation();
          onOpenTerm({ ...info, rect: btn.getBoundingClientRect() });
        };
        frag.appendChild(btn);
        last = m.index + word.length;
      }
      if (changed) {
        if (last < val.length) frag.appendChild(document.createTextNode(val.slice(last)));
        tn.parentNode?.replaceChild(frag, tn);
      }
    }
  }

  // 5. Interactive Self-Test Quizzes (.qz)
  root.querySelectorAll<HTMLElement>('.qz').forEach((qz) => {
    const ansAttr = qz.getAttribute('data-a');
    const items = qz.querySelectorAll<HTMLElement>('ol > li');
    if (ansAttr && items.length > 0) {
      const rightIdx = parseInt(ansAttr, 10) - 1;
      items.forEach((li, idx) => {
        li.onclick = () => {
          items.forEach((x) => x.classList.remove('is-correct', 'is-wrong'));
          if (idx === rightIdx) {
            li.classList.add('is-correct');
          } else {
            li.classList.add('is-wrong');
            if (items[rightIdx]) items[rightIdx].classList.add('is-correct');
          }
          qz.classList.add('is-answered');
          // Mount any hidden charts inside .why now that .why has real width!
          const why = qz.querySelector('.why');
          if (why) {
            why.querySelectorAll<HTMLElement>('figure.cht[id]').forEach((f) => {
              delete f.dataset.mounted;
            });
            window.requestAnimationFrame(() => mountVisibleCharts(why));
          }
        };
      });
    } else if (!qz.querySelector('.qz-reveal-btn')) {
      const why = qz.querySelector('.why');
      if (why) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qz-reveal-btn';
        btn.textContent = '查看参考解析';
        btn.onclick = () => {
          const open = qz.classList.toggle('is-answered');
          btn.textContent = open ? '收起参考解析' : '查看参考解析';
        };
        qz.insertBefore(btn, why);
      }
    }
  });

  // 6. Interactive Homework Todos (ul.todo)
  root.querySelectorAll<HTMLElement>('ul.todo').forEach((ul, uIdx) => {
    const storageKey = `study:todo:${scopeKey}:${uIdx}`;
    let saved: boolean[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      saved = [];
    }
    const lis = ul.querySelectorAll<HTMLElement>('li');
    lis.forEach((li, lIdx) => {
      if (saved[lIdx]) li.classList.add('is-done');
      li.onclick = (e) => {
        if ((e.target as HTMLElement).closest('a')) return;
        saved[lIdx] = !saved[lIdx];
        li.classList.toggle('is-done', saved[lIdx]);
        try {
          localStorage.setItem(storageKey, JSON.stringify(saved));
        } catch {
          // ignore
        }
      };
    });
  });

  // 7. Intercept internal course/tool links
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href || /^(https?:|mailto:)/i.test(href)) {
      if (/^https?:/i.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      return;
    }
    e.preventDefault();
    onRouteHref(href);
  };
  root.addEventListener('click', onClick);
  cleanups.push(() => root.removeEventListener('click', onClick));

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
