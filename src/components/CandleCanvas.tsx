import React, { useEffect, useRef, useState } from 'react';
import { BarTuple, calcSma, fmtBarTime, fmtPrice } from '../lib/market';

export interface PriceLineSpec {
  price: number;
  label: string;
  tone: 'accent' | 'up' | 'dn' | 'muted';
  dashed?: boolean;
}

interface Props {
  bars: BarTuple[];
  intraday?: boolean;
  dark?: boolean;
  logScale?: boolean;
  showSma?: boolean;
  lines?: PriceLineSpec[];
  decimals?: number;
  blindScale?: boolean;
  onPickPrice?: (price: number) => void;
}

export const CandleCanvas: React.FC<Props> = ({
  bars,
  intraday = true,
  dark = false,
  logScale = false,
  showSma = true,
  lines = [],
  decimals,
  blindScale = false,
  onPickPrice,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 380 });
  const scaleRef = useRef({ mT: 28, ph: 260, lo: 0, hi: 1 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      setSize({
        w: Math.max(280, Math.floor(el.clientWidth)),
        h: Math.max(240, Math.floor(el.clientHeight)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !bars.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = size.w;
    const H = size.h;
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = dark ? '#12241d' : '#ffffff';
    const gridCol = dark ? '#21382f' : '#e4ebe6';
    const axisCol = dark ? '#8da299' : '#4b5d56';
    const upCol = dark ? '#24d193' : '#0b7a53';
    const dnCol = dark ? '#ff6568' : '#c82829';
    const accCol = dark ? '#f05438' : '#d9381e';
    const smaFastCol = dark ? '#4da3ff' : '#0b6bcb';
    const smaSlowCol = dark ? '#fbbf24' : '#c96a00';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const mL = 8;
    const mR = W < 500 ? 68 : 82;
    const mT = 28;
    const mB = 28;
    const pw = Math.max(120, W - mL - mR);
    const totalH = H - mT - mB;
    const volH = Math.round(totalH * 0.16);
    const ph = totalH - volH - 8;

    let lo = Infinity;
    let hi = -Infinity;
    let vmax = 0;
    for (const r of bars) {
      if (r[3] < lo) lo = r[3];
      if (r[2] > hi) hi = r[2];
      if (r[5] > vmax) vmax = r[5];
    }
    for (const ln of lines) {
      if (Number.isFinite(ln.price) && ln.price > 0) {
        if (ln.price < lo) lo = ln.price;
        if (ln.price > hi) hi = ln.price;
      }
    }
    if (!(hi > lo) || !(lo > 0)) {
      lo = Math.max(0.0001, lo * 0.95);
      hi = lo * 1.1;
    }

    const f = logScale ? (v: number) => Math.log(Math.max(v, 1e-9)) : (v: number) => v;
    const inv = logScale ? (v: number) => Math.exp(v) : (v: number) => v;
    const rawSpan = f(hi) - f(lo) || 1;
    const a0 = f(lo) - rawSpan * 0.08;
    const a1 = f(hi) + rawSpan * 0.1;
    scaleRef.current = { mT, ph, lo: inv(a0), hi: inv(a1) };

    const Y = (p: number) => mT + ph - ((f(p) - a0) / (a1 - a0)) * ph;
    const n = bars.length;
    const cw = pw / n;
    const bw = Math.max(1.2, Math.min(cw * 0.68, 12));
    const X = (i: number) => mL + (i + 0.5) * cw;

    ctx.font = "500 14px 'Noto Sans SC', sans-serif";
    ctx.textBaseline = 'middle';

    for (let t = 0; t <= 5; t++) {
      const val = inv(a0 + (a1 - a0) * (t / 5));
      const y = Y(val);
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(mL + pw, y);
      ctx.stroke();

      ctx.fillStyle = axisCol;
      ctx.textAlign = 'left';
      ctx.fillText(fmtPrice(val, decimals), mL + pw + 6, y);
    }

    for (let i = 0; i < n; i++) {
      const r = bars[i];
      const vh = vmax > 0 ? (r[5] / vmax) * volH : 0;
      ctx.fillStyle =
        r[4] >= r[1]
          ? dark
            ? 'rgba(34, 211, 151, 0.24)'
            : 'rgba(6, 122, 82, 0.20)'
          : dark
            ? 'rgba(255, 100, 108, 0.24)'
            : 'rgba(196, 35, 41, 0.20)';
      ctx.fillRect(X(i) - bw / 2, mT + totalH - vh, bw, Math.max(1, vh));
    }

    for (let i = 0; i < n; i++) {
      const r = bars[i];
      const up = r[4] >= r[1];
      const col = up ? upCol : dnCol;
      const x = X(i);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, Y(r[2]));
      ctx.lineTo(x, Y(r[3]));
      ctx.stroke();

      const yOpen = Y(r[1]);
      const yClose = Y(r[4]);
      ctx.fillStyle = col;
      ctx.fillRect(x - bw / 2, Math.min(yOpen, yClose), bw, Math.max(1.4, Math.abs(yClose - yOpen)));
    }

    if (showSma && bars.length >= 20) {
      const drawLine = (vals: (number | null)[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        let started = false;
        vals.forEach((v, idx) => {
          if (v === null) return;
          if (!started) {
            ctx.moveTo(X(idx), Y(v));
            started = true;
          } else {
            ctx.lineTo(X(idx), Y(v));
          }
        });
        ctx.stroke();
      };
      drawLine(calcSma(bars, 20), smaFastCol);
      drawLine(calcSma(bars, 50), smaSlowCol);
    }

    for (const ln of lines) {
      if (!Number.isFinite(ln.price) || ln.price <= 0) continue;
      const y = Y(ln.price);
      if (y < mT - 6 || y > mT + ph + 6) continue;
      const col =
        ln.tone === 'up' ? upCol : ln.tone === 'dn' ? dnCol : ln.tone === 'accent' ? accCol : axisCol;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      if (ln.dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(mL + pw, y);
      ctx.stroke();
      ctx.restore();

      const txt = `${ln.label} ${fmtPrice(ln.price, decimals)}`;
      const tw = ctx.measureText(txt).width + 12;
      const bx = mL + pw - tw - 6;
      const by = Math.max(mT + 2, Math.min(mT + ph - 22, y - 22));
      ctx.fillStyle = dark ? 'rgba(21, 35, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(bx, by, tw, 20);
      ctx.fillStyle = col;
      ctx.textAlign = 'left';
      ctx.fillText(txt, bx + 6, by + 10);
    }

    ctx.fillStyle = axisCol;
    const step = Math.max(1, Math.floor(n / (W < 520 ? 3 : 5)));
    for (let i = Math.floor(step / 2); i < n; i += step) {
      const label = blindScale
        ? `#${i + 1}`
        : fmtBarTime(bars[i][0], intraday).slice(intraday ? 5 : 0, intraday ? 16 : 10);
      ctx.textAlign = 'center';
      ctx.fillText(label, X(i), H - 11);
    }

    const active = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n ? hoverIdx : n - 1;
    const ar = bars[active];
    const prevC = active > 0 ? bars[active - 1][4] : ar[1];
    const chg = ((ar[4] / prevC - 1) * 100).toFixed(2);
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n) {
      ctx.save();
      ctx.strokeStyle = axisCol;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(hoverIdx), mT);
      ctx.lineTo(X(hoverIdx), mT + totalH);
      ctx.stroke();
      ctx.restore();
    }

    const compact = W < 520;
    const headText = compact
      ? `${blindScale ? `#${active + 1}` : fmtBarTime(ar[0], intraday).slice(5, 16)} 收 ${fmtPrice(ar[4], decimals)} (${Number(chg) >= 0 ? '+' : ''}${chg}%)`
      : `${blindScale ? `第 ${active + 1} 根` : fmtBarTime(ar[0], intraday)}  开 ${fmtPrice(ar[1], decimals)}  高 ${fmtPrice(ar[2], decimals)}  低 ${fmtPrice(ar[3], decimals)}  收 ${fmtPrice(ar[4], decimals)} (${Number(chg) >= 0 ? '+' : ''}${chg}%)`;
    ctx.fillStyle = axisCol;
    ctx.textAlign = 'left';
    ctx.fillText(headText, mL + 4, 13);
  }, [bars, intraday, dark, logScale, showSma, lines, decimals, blindScale, hoverIdx, size]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!bars.length || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mL = 8;
    const mR = size.w < 500 ? 68 : 82;
    const pw = Math.max(120, size.w - mL - mR);
    const idx = Math.floor(((x - mL) / pw) * bars.length);
    setHoverIdx(idx >= 0 && idx < bars.length ? idx : null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPickPrice || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { mT, ph, lo, hi } = scaleRef.current;
    const ratio = 1 - (y - mT) / ph;
    if (ratio < -0.05 || ratio > 1.05) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const price = logScale
      ? Math.exp(Math.log(lo) + clamped * (Math.log(hi) - Math.log(lo)))
      : lo + clamped * (hi - lo);
    if (Number.isFinite(price) && price > 0) onPickPrice(price);
  };

  return (
    <div className="canvas-frame" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        onClick={handleClick}
      />
    </div>
  );
};
