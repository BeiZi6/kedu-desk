import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONTRACTS, SymbolCode, calcIsolatedLiq, fmtPrice } from '../lib/market';

type SubTool = 'size' | 'liq' | 'fund' | 'sim' | 'noise' | 'alt';

interface Props {
  initialSubTool?: string | null;
}

const CALC_SYMS: SymbolCode[] = ['BTC', 'ETH', 'ANT', 'SOL', 'DOGE', 'ZEC', 'PEPE'];
const NOISE_SYMS: ('BTC' | 'ETH' | 'SOL' | 'DOGE')[] = ['BTC', 'ETH', 'SOL', 'DOGE'];

export const CalculatorsView: React.FC<Props> = ({ initialSubTool }) => {
  const [sub, setSub] = useState<SubTool>('size');

  useEffect(() => {
    if (
      initialSubTool &&
      ['size', 'liq', 'fund', 'sim', 'noise', 'alt'].includes(initialSubTool)
    ) {
      setSub(initialSubTool as SubTool);
    }
  }, [initialSubTool]);

  // 1. Position size state
  const [sym, setSym] = useState<SymbolCode>('BTC');
  const spec = CONTRACTS[sym];
  const [accStr, setAccStr] = useState<string>('2000');
  const [riskStr, setRiskStr] = useState<string>('1');
  const [entryStr, setEntryStr] = useState<string>('62000');
  const [stopStr, setStopStr] = useState<string>('60500');
  const [tgtStr, setTgtStr] = useState<string>('65000');
  const [feeRate, setFeeRate] = useState<number>(0.0005);

  const switchSym = (next: SymbolCode) => {
    setSym(next);
    const s = CONTRACTS[next];
    setRiskStr(String(s.recRiskPct));
    setEntryStr(String(s.defaultSetup[0]));
    setStopStr(String(s.defaultSetup[1]));
    setTgtStr(String(s.defaultSetup[2]));
  };

  const sizeCalc = useMemo(() => {
    const acc = parseFloat(accStr);
    const rPct = parseFloat(riskStr);
    const e = parseFloat(entryStr);
    const s = parseFloat(stopStr);
    const t = parseFloat(tgtStr);
    if (!(acc > 0 && rPct > 0 && e > 0 && s > 0) || e === s) return null;
    const isLong = s < e;
    const dist = Math.abs(e - s);
    const R = (acc * rPct) / 100;
    const rawQty = R / dist;
    const lots = Math.floor(rawQty / spec.ctVal / spec.lotSz + 1e-9) * spec.lotSz;
    const coins = lots * spec.ctVal;
    const notional = coins * e;
    const effLev = notional / acc;
    const fees = notional * feeRate + coins * s * feeRate;
    const lossWithFee = coins * dist + fees;
    const rr = t > 0 && (isLong ? t > e : t < e) ? Math.abs(t - e) / dist : null;
    const liqPx = calcIsolatedLiq(e, spec.recLev, spec.mmr, isLong);
    const okLiq = isLong ? liqPx < s : liqPx > s;
    return { isLong, dist, R, lots, coins, notional, effLev, fees, lossWithFee, rr, liqPx, okLiq };
  }, [accStr, riskStr, entryStr, stopStr, tgtStr, feeRate, spec]);

  // 2. Liquidation calculator
  const [lqSym, setLqSym] = useState<SymbolCode>('SOL');
  const [lqLong, setLqLong] = useState<boolean>(true);
  const [lqEntry, setLqEntry] = useState<string>('70');
  const [lqLev, setLqLev] = useState<string>('5');
  const [lqStop, setLqStop] = useState<string>('65.5');

  // 3. Funding calculator
  const [fdLong, setFdLong] = useState<boolean>(true);
  const [fdNotional, setFdNotional] = useState<string>('2000');
  const [fdRate, setFdRate] = useState<string>('0.01');
  const [fdDays, setFdDays] = useState<string>('14');
  const [fdInterval, setFdInterval] = useState<number>(8);

  // 4. Expectancy Monte Carlo simulator
  const [smWin, setSmWin] = useState<string>('40');
  const [smRr, setSmRr] = useState<string>('2.0');
  const [smRisk, setSmRisk] = useState<string>('1.0');
  const [smCost, setSmCost] = useState<string>('0.06');
  const [smTrades, setSmTrades] = useState<string>('100');
  const [smSeed, setSmSeed] = useState<number>(1);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);

  const simResult = useMemo(() => {
    const w = parseFloat(smWin) / 100;
    const rr = parseFloat(smRr);
    const k = parseFloat(smRisk) / 100;
    const c = parseFloat(smCost) || 0;
    const n = Math.min(300, Math.max(20, Math.round(parseFloat(smTrades) || 100)));
    if (!(w > 0 && w < 1 && rr > 0 && k > 0)) return null;

    let s = smSeed * 98765 + Math.round(w * 1000) * 31 + Math.round(rr * 100);
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const ends: number[] = [];
    const mdds: number[] = [];
    const streaks: number[] = [];
    const samplePaths: number[][] = [];

    for (let runIdx = 0; runIdx < 800; runIdx++) {
      let eq = 100;
      let peak = 100;
      let mdd = 0;
      let curL = 0;
      let maxL = 0;
      const path = runIdx < 26 ? [100] : null;
      for (let i = 0; i < n; i++) {
        const win = rnd() < w;
        const r = (win ? rr : -1) - c;
        eq *= Math.max(0, 1 + r * k);
        if (path) path.push(eq);
        if (eq > peak) peak = eq;
        const dd = peak > 0 ? 1 - eq / peak : 0;
        if (dd > mdd) mdd = dd;
        if (win) curL = 0;
        else {
          curL++;
          if (curL > maxL) maxL = curL;
        }
      }
      ends.push(eq);
      mdds.push(mdd);
      streaks.push(maxL);
      if (path) samplePaths.push(path);
    }

    ends.sort((a, b) => a - b);
    mdds.sort((a, b) => a - b);
    streaks.sort((a, b) => a - b);
    const evR = w * rr - (1 - w) - c;

    return {
      evR,
      p10: ends[Math.floor(ends.length * 0.1)],
      p50: ends[Math.floor(ends.length * 0.5)],
      p90: ends[Math.floor(ends.length * 0.9)],
      medMdd: mdds[Math.floor(mdds.length * 0.5)] * 100,
      medStreak: streaks[Math.floor(streaks.length * 0.5)],
      samplePaths,
      n,
    };
  }, [smWin, smRr, smRisk, smCost, smTrades, smSeed]);

  useEffect(() => {
    if (sub !== 'sim' || !simResult || !simCanvasRef.current) return;
    const cvs = simCanvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(280, cvs.parentElement?.clientWidth ?? 700);
    const H = 260;
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = dark ? '#12241d' : '#ffffff';
    ctx.fillRect(0, 0, W, H);

    let lo = 80;
    let hi = 120;
    simResult.samplePaths.forEach((p) =>
      p.forEach((v) => {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }),
    );
    const mL = 10;
    const mR = 64;
    const mT = 16;
    const mB = 26;
    const pw = W - mL - mR;
    const ph = H - mT - mB;
    const X = (i: number) => mL + (i / simResult.n) * pw;
    const Y = (v: number) => mT + ph - ((v - lo) / (hi - lo || 1)) * ph;

    ctx.strokeStyle = dark ? '#21382f' : '#d4dcd6';
    ctx.beginPath();
    ctx.moveTo(mL, Y(100));
    ctx.lineTo(mL + pw, Y(100));
    ctx.stroke();

    simResult.samplePaths.forEach((p, idx) => {
      ctx.strokeStyle =
        idx === 0
          ? dark
            ? '#f05438'
            : '#d9381e'
          : dark
            ? 'rgba(36, 209, 147, 0.20)'
            : 'rgba(11, 122, 83, 0.18)';
      ctx.lineWidth = idx === 0 ? 2.2 : 1;
      ctx.beginPath();
      p.forEach((v, i) => {
        if (i === 0) ctx.moveTo(X(i), Y(v));
        else ctx.lineTo(X(i), Y(v));
      });
      ctx.stroke();
    });

    ctx.font = "500 14px 'Noto Sans SC', sans-serif";
    ctx.fillStyle = dark ? '#8da299' : '#4b5d56';
    ctx.fillText('起点 100', mL + pw + 6, Y(100) + 4);
    ctx.fillText(`${hi.toFixed(0)}`, mL + pw + 6, mT + 8);
    ctx.fillText(`${lo.toFixed(0)}`, mL + pw + 6, mT + ph);
  }, [sub, simResult]);

  // 5. Intraday Noise Area (OKX live fetch)
  const [nzSym, setNzSym] = useState<'BTC' | 'ETH' | 'SOL' | 'DOGE'>('BTC');
  const [nzState, setNzState] = useState<{
    loading: boolean;
    err?: string;
    open8?: number;
    last?: number;
    upper?: number;
    lower?: number;
    vwap?: number;
    status?: string;
  }>({ loading: false });

  const fetchNoise = (targetSym = nzSym) => {
    setNzState({ loading: true });
    fetch(`https://www.okx.com/api/v5/market/candles?instId=${targetSym}-USDT&bar=15m&limit=100`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.code !== '0' || !Array.isArray(j.data) || j.data.length < 20) {
          throw new Error('接口返回不足');
        }
        const rows = j.data
          .map((d: any) => [+d[0], +d[1], +d[2], +d[3], +d[4], +d[5]])
          .sort((a: number[], b: number[]) => a[0] - b[0]);
        const DAY = 86400000;
        const today0 = Math.floor(rows[rows.length - 1][0] / DAY) * DAY;
        const todayBars = rows.filter((r: number[]) => r[0] >= today0);
        if (!todayBars.length) throw new Error('今日 08:00 K 线尚未生成');
        const open8 = todayBars[0][1];
        let pv = 0;
        let vv = 0;
        todayBars.forEach((r: number[]) => {
          pv += ((r[2] + r[3] + r[4]) / 3) * r[5];
          vv += r[5];
        });
        const vwap = vv > 0 ? pv / vv : open8;
        const last = todayBars[todayBars.length - 1][4];
        const prevBars = rows.filter((r: number[]) => r[0] < today0);
        const avgMove = prevBars.length
          ? prevBars.reduce((s: number, r: number[]) => s + Math.abs(r[2] - r[3]) / r[1], 0) /
            prevBars.length
          : 0.004;
        const sig = avgMove * Math.sqrt(todayBars.length) * 0.85;
        const upper = open8 * (1 + sig);
        const lower = open8 * (1 - sig);
        const status =
          last > upper ? '已突破上边界（多头趋势候选）' : last < lower ? '已跌破下边界（空头趋势候选）' : '处于日内噪声包络内（观望不开仓）';
        setNzState({ loading: false, open8, last, upper, lower, vwap, status });
      })
      .catch(() => {
        setNzState({
          loading: false,
          err: '当前网络未能直连 www.okx.com 公共行情接口。第 22 课形态一公式：以上海/北京时间 08:00 开盘价为基准，前 14 日同一钟点绝对涨跌幅均值构成上下噪声边界，收盘走出边界且与 VWAP 同侧时方可入场。',
        });
      });
  };

  useEffect(() => {
    if (sub === 'noise') fetchNoise(nzSym);
  }, [sub, nzSym]);

  // 6. Altcoin FDV dilution sliders
  const [initFloat, setInitFloat] = useState<number>(8);
  const [endFloat, setEndFloat] = useState<number>(55);
  const [mcapDelta, setMcapDelta] = useState<number>(0);

  return (
    <div className="page-container">
      <header className="page-head">
        <h1>风控、期望值与活跃山寨算盘</h1>
        <p>
          下单前先算清三个硬数字：按止损距离该开多少张、逐仓强平价离止损有多远、手续费与资金费吃掉多少 R。已内置 BTC、ETH、ANT 及 SOL、DOGE、ZEC、PEPE 真实合约面值。
        </p>

        <div style={{ marginTop: '18px' }}>
          <div className="seg-group" role="tablist" aria-label="切换计算器">
            {(
              [
                ['size', '仓位计算器'],
                ['liq', '逐仓强平价'],
                ['fund', '资金费测算'],
                ['sim', '百笔期望模拟器'],
                ['noise', '今日噪声边界'],
                ['alt', '山寨规格与稀释推演'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={sub === k}
                onClick={() => setSub(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {sub === 'size' && (
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <div className="seg-group" role="tablist" aria-label="选择合约品种">
              {CALC_SYMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={sym === s}
                  onClick={() => switchSym(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink3)' }}>
              OKX 合约规格：1 张 = {spec.ctVal.toLocaleString('en-US')} {spec.unit} · 最小下单{' '}
              {spec.lotSz} 张 · 第一档维持保证金率 {(spec.mmr * 100).toFixed(2)}%
            </span>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="sz-acc">账户总资金 (USDT)</label>
              <input
                id="sz-acc"
                type="number"
                value={accStr}
                onChange={(e) => setAccStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sz-risk">单笔风险比例 (% 账户，山寨建议 0.25~0.5)</label>
              <input
                id="sz-risk"
                type="number"
                step="0.05"
                value={riskStr}
                onChange={(e) => setRiskStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sz-entry">计划进场价</label>
              <input
                id="sz-entry"
                type="number"
                step="any"
                value={entryStr}
                onChange={(e) => setEntryStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sz-stop">结构止损价（低于进场=做多，高于=做空）</label>
              <input
                id="sz-stop"
                type="number"
                step="any"
                value={stopStr}
                onChange={(e) => setStopStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sz-tgt">计划目标价</label>
              <input
                id="sz-tgt"
                type="number"
                step="any"
                value={tgtStr}
                onChange={(e) => setTgtStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sz-fee">单边手续费档位</label>
              <select
                id="sz-fee"
                value={feeRate}
                onChange={(e) => setFeeRate(parseFloat(e.target.value))}
              >
                <option value={0.0005}>永续合约吃单 0.05%</option>
                <option value={0.0002}>永续合约挂单 0.02%</option>
                <option value={0.001}>现货吃单 0.10%</option>
              </select>
            </div>
          </div>

          {sizeCalc && (
            <>
              <div className="kpi-row">
                <div className="kpi-box">
                  <span>应下张数 ({ sizeCalc.isLong ? '做多' : '做空' })</span>
                  <strong>{sizeCalc.lots.toFixed(spec.lotSz < 0.01 ? 3 : 2)} 张</strong>
                  <small>
                    = {sizeCalc.coins.toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                    {spec.unit}
                  </small>
                </div>
                <div className="kpi-box">
                  <span>单笔风险金额 (1R)</span>
                  <strong>{sizeCalc.R.toFixed(2)} U</strong>
                  <small>含双边费实亏 {sizeCalc.lossWithFee.toFixed(2)} U</small>
                </div>
                <div className="kpi-box">
                  <span>仓位名义价值</span>
                  <strong>{sizeCalc.notional.toFixed(1)} U</strong>
                  <small className={sizeCalc.effLev > 3 ? 'dn' : 'up'}>
                    实际杠杆 {sizeCalc.effLev.toFixed(2)} 倍
                  </small>
                </div>
                <div className="kpi-box">
                  <span>逐仓 {spec.recLev} 倍强平价</span>
                  <strong className={sizeCalc.okLiq ? 'up' : 'dn'}>
                    {fmtPrice(sizeCalc.liqPx, spec.decimals)}
                  </strong>
                  <small>
                    {sizeCalc.rr !== null ? `计划盈亏比 ${sizeCalc.rr.toFixed(2)} R` : '未设有效目标'}
                  </small>
                </div>
              </div>

              <div className="lesson-body">
                <div className={sizeCalc.okLiq && sizeCalc.effLev <= 3 ? 'key' : 'warn'}>
                  <p>
                    {!sizeCalc.okLiq
                      ? `危险：逐仓 ${spec.recLev} 倍下强平价比止损更近，请立即下调杠杆倍数或放宽保证金。`
                      : sizeCalc.effLev > 3
                        ? `实际杠杆已达 ${sizeCalc.effLev.toFixed(2)} 倍（超过 3 倍上限），说明止损距离过窄，极易被正常波动扫损。`
                        : `校验通过：推荐设置逐仓 ${spec.recLev} 倍杠杆，强平价位于止损外侧，进场时务必同步挂好触发止损单。`}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'liq' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div className="seg-group" role="tablist">
              {CALC_SYMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={lqSym === s}
                  onClick={() => {
                    setLqSym(s);
                    setLqEntry(String(CONTRACTS[s].defaultSetup[0]));
                    setLqStop(String(CONTRACTS[s].defaultSetup[1]));
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="seg-group" role="tablist">
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={lqLong}
                onClick={() => setLqLong(true)}
              >
                做多
              </button>
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={!lqLong}
                onClick={() => setLqLong(false)}
              >
                做空
              </button>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="lq-e">开仓均价</label>
              <input
                id="lq-e"
                type="number"
                step="any"
                value={lqEntry}
                onChange={(e) => setLqEntry(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lq-l">逐仓杠杆倍数</label>
              <input
                id="lq-l"
                type="number"
                min={1}
                max={CONTRACTS[lqSym].maxLev}
                value={lqLev}
                onChange={(e) => setLqLev(e.target.value)}
              />
            </div>
          </div>

          {parseFloat(lqEntry) > 0 && parseFloat(lqLev) >= 1 && (
            <div className="tool-tw">
              <table className="tool-table">
                <thead>
                  <tr>
                    <th>逐仓倍数</th>
                    {[2, 3, 5, 10, 20, 50]
                      .filter((x) => x <= CONTRACTS[lqSym].maxLev)
                      .map((x) => (
                        <th key={x} className="n">
                          {x} 倍
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>预估强平价</td>
                    {[2, 3, 5, 10, 20, 50]
                      .filter((x) => x <= CONTRACTS[lqSym].maxLev)
                      .map((x) => {
                        const p = calcIsolatedLiq(
                          parseFloat(lqEntry),
                          x,
                          CONTRACTS[lqSym].mmr,
                          lqLong,
                        );
                        return (
                          <td key={x} className="n">
                            {fmtPrice(p, CONTRACTS[lqSym].decimals)}
                          </td>
                        );
                      })}
                  </tr>
                  <tr>
                    <td>距开仓价缓冲</td>
                    {[2, 3, 5, 10, 20, 50]
                      .filter((x) => x <= CONTRACTS[lqSym].maxLev)
                      .map((x) => {
                        const p = calcIsolatedLiq(
                          parseFloat(lqEntry),
                          x,
                          CONTRACTS[lqSym].mmr,
                          lqLong,
                        );
                        const d = Math.abs(p / parseFloat(lqEntry) - 1) * 100;
                        return (
                          <td key={x} className={`n ${d < 6 ? 'dn' : d < 15 ? '' : 'up'}`}>
                            {d.toFixed(2)}%
                          </td>
                        );
                      })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sub === 'fund' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div className="seg-group" role="tablist">
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={fdLong}
                onClick={() => setFdLong(true)}
              >
                持有多单
              </button>
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={!fdLong}
                onClick={() => setFdLong(false)}
              >
                持有空单
              </button>
            </div>
            <div className="seg-group" role="tablist">
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={fdInterval === 8}
                onClick={() => setFdInterval(8)}
              >
                标准 8 小时结算
              </button>
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={fdInterval === 4}
                onClick={() => setFdInterval(4)}
              >
                活跃热币 4 小时结算
              </button>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="fd-n">仓位名义价值 (USDT)</label>
              <input
                id="fd-n"
                type="number"
                value={fdNotional}
                onChange={(e) => setFdNotional(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fd-r">单期资金费率 (% ，负费率填负数)</label>
              <input
                id="fd-r"
                type="number"
                step="0.005"
                value={fdRate}
                onChange={(e) => setFdRate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fd-d">预计持有天数</label>
              <input
                id="fd-d"
                type="number"
                value={fdDays}
                onChange={(e) => setFdDays(e.target.value)}
              />
            </div>
          </div>

          {(() => {
            const n = parseFloat(fdNotional);
            const r = parseFloat(fdRate);
            const d = parseFloat(fdDays);
            if (!(n > 0 && d > 0) || !Number.isFinite(r)) return null;
            const perDayTimes = 24 / fdInterval;
            const perTerm = ((fdLong ? 1 : -1) * (n * r)) / 100;
            const total = perTerm * perDayTimes * d;
            return (
              <div className="kpi-row">
                <div className="kpi-box">
                  <span>每 {fdInterval} 小时收支</span>
                  <strong className={perTerm > 0 ? 'dn' : 'up'}>
                    {perTerm > 0 ? '支付 ' : '收取 '}
                    {Math.abs(perTerm).toFixed(2)} U
                  </strong>
                </div>
                <div className="kpi-box">
                  <span>每日合计 ({perDayTimes} 次)</span>
                  <strong className={perTerm > 0 ? 'dn' : 'up'}>
                    {perTerm > 0 ? '支付 ' : '收取 '}
                    {Math.abs(perTerm * perDayTimes).toFixed(2)} U
                  </strong>
                </div>
                <div className="kpi-box">
                  <span>{d} 天累计资金费</span>
                  <strong className={total > 0 ? 'dn' : 'up'}>
                    {total > 0 ? '支付 ' : '收取 '}
                    {Math.abs(total).toFixed(2)} U
                  </strong>
                  <small>折合年化费率 {Math.abs(r * perDayTimes * 365).toFixed(1)}%</small>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {sub === 'sim' && (
        <div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="sm-w">系统真实胜率 (%)</label>
              <input
                id="sm-w"
                type="number"
                value={smWin}
                onChange={(e) => setSmWin(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sm-r">盈利单平均盈亏比 (R)</label>
              <input
                id="sm-r"
                type="number"
                step="0.1"
                value={smRr}
                onChange={(e) => setSmRr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sm-k">每笔风险占账户 (%)</label>
              <input
                id="sm-k"
                type="number"
                step="0.1"
                value={smRisk}
                onChange={(e) => setSmRisk(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sm-c">每笔手续费与滑点损耗 (R)</label>
              <input
                id="sm-c"
                type="number"
                step="0.01"
                value={smCost}
                onChange={(e) => setSmCost(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setSmSeed((x) => x + 1)}
            >
              重新随机模拟 800 组样本
            </button>
          </div>

          {simResult && (
            <>
              <div className="kpi-row">
                <div className="kpi-box">
                  <span>扣费后单笔期望</span>
                  <strong className={simResult.evR >= 0 ? 'up' : 'dn'}>
                    {simResult.evR >= 0 ? '+' : ''}
                    {simResult.evR.toFixed(2)} R
                  </strong>
                </div>
                <div className="kpi-box">
                  <span>期末权益中位数 (起点 100)</span>
                  <strong>{simResult.p50.toFixed(1)}</strong>
                  <small>
                    差运气 10% 分位 {simResult.p10.toFixed(0)} · 好运气 {simResult.p90.toFixed(0)}
                  </small>
                </div>
                <div className="kpi-box">
                  <span>中位最大回撤</span>
                  <strong className="dn">{simResult.medMdd.toFixed(1)}%</strong>
                  <small>中位最长连亏 {simResult.medStreak} 笔</small>
                </div>
              </div>
              <div className="canvas-frame" style={{ height: '260px' }}>
                <canvas ref={simCanvasRef} />
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'noise' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <div className="seg-group" role="tablist">
              {NOISE_SYMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={nzSym === s}
                  onClick={() => setNzSym(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button type="button" className="text-action" onClick={() => fetchNoise(nzSym)}>
              刷新 OKX 15m 实时边界
            </button>
          </div>

          {nzState.loading ? (
            <p>正在读取 OKX 公共 15 分钟行情…</p>
          ) : nzState.err ? (
            <div className="lesson-body">
              <div className="ex" data-t="离线说明">
                <p>{nzState.err}</p>
              </div>
            </div>
          ) : (
            <div className="kpi-row">
              <div className="kpi-box">
                <span>今日 08:00 开盘价</span>
                <strong>{fmtPrice(nzState.open8 ?? 0, CONTRACTS[nzSym].decimals)}</strong>
              </div>
              <div className="kpi-box">
                <span>当前最新收盘</span>
                <strong>{fmtPrice(nzState.last ?? 0, CONTRACTS[nzSym].decimals)}</strong>
                <small>{nzState.status}</small>
              </div>
              <div className="kpi-box">
                <span>上 / 下噪声边界</span>
                <strong>
                  {fmtPrice(nzState.upper ?? 0, CONTRACTS[nzSym].decimals)} /{' '}
                  {fmtPrice(nzState.lower ?? 0, CONTRACTS[nzSym].decimals)}
                </strong>
              </div>
              <div className="kpi-box">
                <span>当日累计 VWAP</span>
                <strong>{fmtPrice(nzState.vwap ?? 0, CONTRACTS[nzSym].decimals)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {sub === 'alt' && (
        <div>
          <div className="tool-tw">
            <table className="tool-table">
              <thead>
                <tr>
                  <th>合约代码</th>
                  <th>1 张面值</th>
                  <th className="n">日均 ATR%</th>
                  <th className="n">第一档维持保证金</th>
                  <th className="n">流通比例</th>
                  <th className="n">建议单笔风险 / 逐仓上限</th>
                </tr>
              </thead>
              <tbody>
                {(['SOL', 'DOGE', 'ZEC', 'PEPE', 'WLD', 'ANT'] as SymbolCode[]).map((s) => {
                  const c = CONTRACTS[s];
                  return (
                    <tr key={s}>
                      <td>
                        <b>{c.instId}</b>
                      </td>
                      <td>
                        {c.ctVal.toLocaleString('en-US')} {c.unit}
                      </td>
                      <td className="n">{c.fallbackAtrPct.toFixed(1)}%</td>
                      <td className="n">{(c.mmr * 100).toFixed(2)}%</td>
                      <td className={`n ${c.floatRatioPct < 25 ? 'dn' : ''}`}>
                        {c.floatRatioPct.toFixed(1)}%
                      </td>
                      <td className="n">
                        {c.recRiskPct}% / {c.recLev} 倍
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lesson-body" style={{ marginTop: '24px' }}>
            <div className="ex" data-t="高 FDV 新币解锁稀释推演（上线单价 2.00 U，总发行量 100 亿枚）">
              <div className="field-grid" style={{ marginTop: '10px' }}>
                <div className="field">
                  <label htmlFor="dl-i">上线初始流通比例：{initFloat}%</label>
                  <input
                    id="dl-i"
                    type="range"
                    min={3}
                    max={40}
                    value={initFloat}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setInitFloat(v);
                      if (endFloat < v) setEndFloat(v);
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dl-e">两年解锁后流通比例：{endFloat}%</label>
                  <input
                    id="dl-e"
                    type="range"
                    min={10}
                    max={100}
                    value={endFloat}
                    onChange={(e) => setEndFloat(Math.max(initFloat, Number(e.target.value)))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dl-m">期间项目流通总市值变化：{mcapDelta}%</label>
                  <input
                    id="dl-m"
                    type="range"
                    min={-50}
                    max={100}
                    step={5}
                    value={mcapDelta}
                    onChange={(e) => setMcapDelta(Number(e.target.value))}
                  />
                </div>
              </div>
              {(() => {
                const startMcap = ((10 * initFloat) / 100) * 2.0;
                const endCirc = (10 * Math.max(initFloat, endFloat)) / 100;
                const finalPx = (startMcap * (1 + mcapDelta / 100)) / endCirc;
                const chg = (finalPx / 2.0 - 1) * 100;
                return (
                  <p style={{ marginTop: '14px' }}>
                    表面初始流通市值 <b>{startMcap.toFixed(1)} 亿 U</b>（真实 FDV{' '}
                    <b>200 亿 U</b>）→ 解锁稀释后理论单价 <b>{finalPx.toFixed(3)} U</b>（被动涨跌幅{' '}
                    <b className={chg < 0 ? 'dn' : 'up'}>
                      {chg >= 0 ? '+' : ''}
                      {chg.toFixed(1)}%
                    </b>
                    ）。
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
