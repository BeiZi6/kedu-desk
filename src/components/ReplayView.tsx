import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarTuple, CONTRACTS, SymbolCode, fmtBarTime, fmtPrice } from '../lib/market';
import { CandleCanvas, PriceLineSpec } from './CandleCanvas';

export interface ReplayLogItem {
  id: string;
  ts: number;
  sym: SymbolCode;
  bar: string;
  dir: 1 | -1;
  tag: string;
  r: number;
  barsHeld: number;
  why: string;
}

interface Props {
  seed: Record<string, BarTuple[]>;
  dark: boolean;
  onSyncJournal: (item: ReplayLogItem) => void;
}

const RP_SYMS: SymbolCode[] = ['BTC', 'ETH', 'ANT', 'SOL', 'DOGE', 'ZEC'];
const RP_TAGS = [
  '趋势回调',
  '突破回踩',
  '区间高抛低吸',
  '强势龙头回踩',
  '关键位插针收回',
  '右侧破位做空',
];
const STORAGE_KEY = 'study:replay:log:v1';

export const ReplayView: React.FC<Props> = ({ seed, dark, onSyncJournal }) => {
  const [sym, setSym] = useState<SymbolCode>('SOL');
  const [tf, setTf] = useState<'4H' | '1D' | '1H'>('4H');
  const [blind, setBlind] = useState<boolean>(true);
  const [startIdx, setStartIdx] = useState<number>(80);
  const [curIdx, setCurIdx] = useState<number>(150);
  const [mult, setMult] = useState<number>(1.14);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);

  const [dir, setDir] = useState<1 | -1>(1);
  const [tag, setTag] = useState<string>(RP_TAGS[0]);
  const [stopStr, setStopStr] = useState<string>('');
  const [tgtStr, setTgtStr] = useState<string>('');
  const [pickField, setPickField] = useState<'stop' | 'tgt'>('stop');
  const [notice, setNotice] = useState<string>('先观察前 70 根 K 线找准方向与关键位，在图上点击定好止损后再下单。');

  const [pos, setPos] = useState<{
    dir: 1 | -1;
    entry: number;
    stop0: number;
    stop: number;
    tgt: number | null;
    tag: string;
    idxIn: number;
  } | null>(null);

  const [history, setHistory] = useState<ReplayLogItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const availTfs = useMemo(() => {
    const out: ('4H' | '1D' | '1H')[] = [];
    (['4H', '1D', '1H'] as const).forEach((b) => {
      if (seed[`${sym}_${b}`]?.length) out.push(b);
    });
    return out.length ? out : (['4H'] as ('4H' | '1D' | '1H')[]);
  }, [seed, sym]);

  const activeTf = availTfs.includes(tf) ? tf : availTfs[0];
  const rawRows = useMemo(() => seed[`${sym}_${activeTf}`] ?? [], [seed, sym, activeTf]);

  const resetRound = useCallback(
    (nextSym = sym, nextTf = activeTf, nextBlind = blind) => {
      const arr = seed[`${nextSym}_${nextTf}`] ?? [];
      const n = arr.length;
      const ctxLen = Math.min(70, Math.floor(n * 0.25));
      const fwd = Math.min(140, Math.floor(n * 0.4));
      const room = Math.max(1, n - ctxLen - fwd);
      const s0 = Math.floor(Math.random() * room);
      setStartIdx(s0);
      setCurIdx(Math.min(n - 1, s0 + ctxLen));
      setMult(nextBlind ? Number((0.65 + Math.random() * 0.9).toFixed(3)) : 1);
      setRevealed(false);
      setPlaying(false);
      setPos(null);
      setStopStr('');
      setTgtStr('');
      setNotice('新盲测轮次已生成：日期已隐藏，价格已随机缩放，请按客观结构操作。');
    },
    [seed, sym, activeTf, blind],
  );

  useEffect(() => {
    if (rawRows.length > 0 && curIdx >= rawRows.length) {
      resetRound(sym, activeTf, blind);
    }
  }, [rawRows, curIdx, sym, activeTf, blind, resetRound]);

  const viewBars = useMemo<BarTuple[]>(() => {
    if (!rawRows.length) return [];
    return rawRows
      .slice(startIdx, curIdx + 1)
      .slice(-115)
      .map((r) => [r[0], r[1] * mult, r[2] * mult, r[3] * mult, r[4] * mult, r[5]]);
  }, [rawRows, startIdx, curIdx, mult]);

  const curClose = viewBars.length ? viewBars[viewBars.length - 1][4] : 0;
  const dec = curClose >= 1000 ? 1 : curClose >= 10 ? 2 : curClose >= 1 ? 3 : curClose >= 0.1 ? 4 : 5;

  const closePos = useCallback(
    (exitPx: number, why: string, active: NonNullable<typeof pos>) => {
      const dist = Math.abs(active.entry - active.stop0);
      const feeR = ((active.entry + exitPx) * 0.0005) / dist;
      const netR = Number(((active.dir * (exitPx - active.entry)) / dist - feeR).toFixed(2));
      const rec: ReplayLogItem = {
        id: `rp-${Date.now()}`,
        ts: Date.now(),
        sym,
        bar: activeTf,
        dir: active.dir,
        tag: active.tag,
        r: netR,
        barsHeld: curIdx - active.idxIn,
        why,
      };
      setHistory((prev) => {
        const next = [rec, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      onSyncJournal(rec);
      setPos(null);
      setPlaying(false);
      setNotice(`平仓结算（${why}）：${netR >= 0 ? '+' : ''}${netR.toFixed(2)} R（已计入累计成绩与交易日志）`);
    },
    [sym, activeTf, curIdx, onSyncJournal],
  );

  const stepBar = useCallback(() => {
    if (!rawRows.length) return;
    if (curIdx >= rawRows.length - 1) {
      setPlaying(false);
      setRevealed(true);
      setNotice('本轮行情已走完，已揭晓真实品种与历史区间。');
      return;
    }
    const ni = curIdx + 1;
    const b = rawRows[ni];
    const bo = b[1] * mult;
    const bh = b[2] * mult;
    const bl = b[3] * mult;
    if (pos) {
      const L = pos.dir === 1;
      if (L ? bo <= pos.stop : bo >= pos.stop) {
        setCurIdx(ni);
        closePos(bo, '跳空触发止损', pos);
        return;
      }
      if (L ? bl <= pos.stop : bh >= pos.stop) {
        setCurIdx(ni);
        closePos(pos.stop, pos.stop === pos.stop0 ? '触及止损' : '触及移动止损', pos);
        return;
      }
      if (pos.tgt !== null && (L ? bh >= pos.tgt : bl <= pos.tgt)) {
        setCurIdx(ni);
        closePos(pos.tgt, '到达目标止盈', pos);
        return;
      }
    }
    setCurIdx(ni);
  }, [rawRows, curIdx, mult, pos, closePos]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(stepBar, 550);
    return () => window.clearInterval(id);
  }, [playing, stepBar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName || '')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepBar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepBar]);

  const lines = useMemo<PriceLineSpec[]>(() => {
    if (pos) {
      const arr: PriceLineSpec[] = [
        { price: pos.entry, label: '进场', tone: 'accent' },
        { price: pos.stop, label: '止损', tone: 'dn', dashed: true },
      ];
      if (pos.tgt) arr.push({ price: pos.tgt, label: '目标', tone: 'up', dashed: true });
      return arr;
    }
    const out: PriceLineSpec[] = [];
    if (parseFloat(stopStr) > 0)
      out.push({ price: parseFloat(stopStr), label: '草稿止损', tone: 'dn', dashed: true });
    if (parseFloat(tgtStr) > 0)
      out.push({ price: parseFloat(tgtStr), label: '草稿目标', tone: 'up', dashed: true });
    return out;
  }, [pos, stopStr, tgtStr]);

  const totalStats = useMemo(() => {
    const n = history.length;
    const wins = history.filter((x) => x.r > 0).length;
    const tot = history.reduce((s, x) => s + x.r, 0);
    return { n, wr: n ? (wins / n) * 100 : 0, ev: n ? tot / n : 0, tot };
  }, [history]);

  return (
    <div className="page-container">
      <header className="page-head">
        <h1>K 线历史盲测复盘台</h1>
        <p>
          把 BTC、ETH、ANT、SOL、DOGE、ZEC 的真实历史行情逐根放出来，遮蔽日期并随机缩放价格。目标：按第 17、24 课规则做满 100 笔样本，验证扣费后的真实正期望。
        </p>
      </header>

      <div className="tool-grid-2">
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            <div className="seg-group" role="tablist" aria-label="选择品种">
              {RP_SYMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={sym === s}
                  onClick={() => {
                    setSym(s);
                    const nextTf = seed[`${s}_${activeTf}`]?.length ? activeTf : '4H';
                    setTf(nextTf);
                    resetRound(s, nextTf, blind);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="seg-group" role="tablist" aria-label="选择周期">
              {availTfs.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={activeTf === b}
                  onClick={() => {
                    setTf(b);
                    resetRound(sym, b, blind);
                  }}
                >
                  {b === '1D' ? '日线' : b === '4H' ? '4 小时' : '1 小时'}
                </button>
              ))}
            </div>

            <div className="seg-group" role="tablist" aria-label="画布点选模式">
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={pickField === 'stop'}
                onClick={() => setPickField('stop')}
              >
                点图设止损
              </button>
              <button
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={pickField === 'tgt'}
                onClick={() => setPickField('tgt')}
              >
                点图设目标
              </button>
            </div>
          </div>

          <CandleCanvas
            bars={viewBars}
            intraday={activeTf !== '1D'}
            dark={dark}
            decimals={dec}
            blindScale={blind && !revealed}
            lines={lines}
            onPickPrice={(px) => {
              const v = String(Number(px.toFixed(dec)));
              if (pos) {
                if (
                  (pos.dir === 1 && px > pos.stop && px < curClose) ||
                  (pos.dir === -1 && px < pos.stop && px > curClose)
                ) {
                  setPos({ ...pos, stop: Number(v) });
                  setNotice(`已将止损往盈利方向移至 ${v}`);
                }
                return;
              }
              if (pickField === 'stop') setStopStr(v);
              else setTgtStr(v);
            }}
          />

          <div
            style={{
              marginTop: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={stepBar}>
                下一根 K 线 (→)
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? '暂停自动播放' : '自动连续播放'}
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  for (let i = 0; i < 5; i++) stepBar();
                }}
              >
                快进 5 根
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="text-action"
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? '隐藏真实日期' : '揭晓当前片段'}
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => resetRound(sym, activeTf, blind)}
              >
                换一段行情
              </button>
            </div>
          </div>

          <p style={{ marginTop: '10px', fontSize: 'var(--text-sm)', color: 'var(--ink3)' }}>
            {revealed && rawRows[startIdx] && rawRows[curIdx]
              ? `揭晓：${sym} ${activeTf}（${fmtBarTime(rawRows[startIdx][0], activeTf !== '1D')} 至 ${fmtBarTime(rawRows[curIdx][0], activeTf !== '1D')}） · `
              : ''}
            {notice}
          </p>
        </div>

        <div>
          {pos ? (
            <div className="lesson-body">
              <div className="ex" data-t={pos.dir === 1 ? '当前持有多单' : '当前持有空单'}>
                <p>
                  进场 <b>{fmtPrice(pos.entry, dec)}</b> · 当前止损{' '}
                  <b>{fmtPrice(pos.stop, dec)}</b> · 目标{' '}
                  <b>{pos.tgt ? fmtPrice(pos.tgt, dec) : '未设'}</b>
                </p>
                <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => closePos(curClose, '手动现价平仓', pos)}
                  >
                    按现价平仓
                  </button>
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      if (
                        (pos.dir === 1 && curClose > pos.entry) ||
                        (pos.dir === -1 && curClose < pos.entry)
                      ) {
                        setPos({ ...pos, stop: pos.entry });
                        setNotice('已推止损至进场价保本');
                      } else {
                        setNotice('浮亏状态下不允许移到进场价');
                      }
                    }}
                  >
                    移止损到进场价保本
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <div className="seg-group" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className="seg-item"
                    aria-selected={dir === 1}
                    onClick={() => setDir(1)}
                  >
                    做多
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="seg-item"
                    aria-selected={dir === -1}
                    onClick={() => setDir(-1)}
                  >
                    做空
                  </button>
                </div>
                <div className="seg-group" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className="seg-item"
                    aria-selected={blind}
                    onClick={() => {
                      setBlind(true);
                      resetRound(sym, activeTf, true);
                    }}
                  >
                    盲测模式
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="seg-item"
                    aria-selected={!blind}
                    onClick={() => {
                      setBlind(false);
                      resetRound(sym, activeTf, false);
                    }}
                  >
                    原价实盘轴
                  </button>
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="rp-s">止损价（必填）</label>
                  <input
                    id="rp-s"
                    type="number"
                    step="any"
                    placeholder="点左侧图拾取"
                    value={stopStr}
                    onChange={(e) => setStopStr(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rp-t">目标价</label>
                  <input
                    id="rp-t"
                    type="number"
                    step="any"
                    value={tgtStr}
                    onChange={(e) => setTgtStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="rp-tag">打法分类</label>
                <select id="rp-tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                  {RP_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const st = parseFloat(stopStr);
                    const tg = parseFloat(tgtStr);
                    if (!(st > 0)) {
                      setNotice('必须先填止损价（不设止损的单子不允许开仓）');
                      return;
                    }
                    if ((dir === 1 && st >= curClose) || (dir === -1 && st <= curClose)) {
                      setNotice('止损方向错误：做多止损应在现价下方，做空应在上方');
                      return;
                    }
                    const validTgt =
                      tg > 0 && (dir === 1 ? tg > curClose : tg < curClose) ? tg : null;
                    setPos({
                      dir,
                      entry: curClose,
                      stop0: st,
                      stop: st,
                      tgt: validTgt,
                      tag,
                      idxIn: curIdx,
                    });
                    setNotice(`已按收盘价 ${fmtPrice(curClose, dec)} 开仓`);
                  }}
                >
                  现价下单 ({fmtPrice(curClose, dec)})
                </button>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => {
                    const st = parseFloat(stopStr);
                    if (!(st > 0) || (dir === 1 ? st >= curClose : st <= curClose)) return;
                    const tg = curClose + dir * Math.abs(curClose - st) * 2;
                    setTgtStr(String(Number(tg.toFixed(dec))));
                  }}
                >
                  按 2R 自动填目标
                </button>
              </div>
            </div>
          )}

          <div className="kpi-row">
            <div className="kpi-box">
              <span>累计完成笔数</span>
              <strong>{totalStats.n} / 100</strong>
              <small>胜率 {totalStats.wr.toFixed(0)}%</small>
            </div>
            <div className="kpi-box">
              <span>累计净期望</span>
              <strong className={totalStats.ev >= 0 ? 'up' : 'dn'}>
                {totalStats.ev >= 0 ? '+' : ''}
                {totalStats.ev.toFixed(2)} R
              </strong>
              <small>
                总计 {totalStats.tot >= 0 ? '+' : ''}
                {totalStats.tot.toFixed(1)} R
              </small>
            </div>
          </div>

          {history.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink3)' }}>
                最近 {Math.min(6, history.length)} 笔盲测记录
              </span>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem(STORAGE_KEY);
                }}
              >
                清空盲测记录
              </button>
            </div>
          )}

          {history.length > 0 && (
            <div className="tool-tw">
              <table className="tool-table">
                <thead>
                  <tr>
                    <th>品种</th>
                    <th>打法</th>
                    <th className="n">净结果</th>
                    <th>出场原因</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 6).map((h) => (
                    <tr key={h.id}>
                      <td>
                        {h.sym} {h.dir === 1 ? '多' : '空'}
                      </td>
                      <td>{h.tag}</td>
                      <td className={`n ${h.r >= 0 ? 'up' : 'dn'}`}>
                        {h.r >= 0 ? '+' : ''}
                        {h.r.toFixed(2)} R
                      </td>
                      <td>{h.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
