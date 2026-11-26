import React, { useEffect, useMemo, useState } from 'react';
import { ReplayLogItem } from './ReplayView';

const CHECKLISTS: Record<string, { title: string; desc: string; items: string[] }> = {
  pre: {
    title: '开仓前 10 条总清单（第 11、18 课）',
    desc: '10 条全部打勾才允许下单，有一条不满足立即放弃本笔。',
    items: [
      '周线和日线的方向我说得出来，这笔交易与日线顺向（或明确逆势减半仓位）。',
      '进场位置贴近明确的关键支撑、阻力或区间边界，不在半山腰追单。',
      '本笔属于交易计划里写明的打法，能一句话说出触发规则。',
      '止损价放在「交易理由不成立」的结构位外侧，并留了 ATR 缓冲。',
      '已用仓位计算器算好张数：打到止损只亏账户的 0.25%~1%。',
      '目标价距离进场价至少是止损距离的 2 倍（2R）。',
      '保证金模式为逐仓，杠杆 3~5 倍，强平价远在止损外侧。',
      '查过事件日历：未来 24 小时无议息、CPI、非农或重大公司财报。',
      '加上本笔，同向加密仓位合计总风险不超过账户的 2%。',
      '今日未亏满 2R、本周未亏满 4R，此刻情绪平静、不想翻本。',
    ],
  },
  alt: {
    title: '活跃山寨币专项清单（第 23~24 课）',
    desc: '做除 BTC、ETH 以外的任何活跃山寨合约前逐条核验。',
    items: [
      '流动性过关：24 小时合约成交额不少于 5,000 万 USDT，买一卖一点差不超过 0.03%，上线满 14 天。',
      '大盘脸色安全：BTC 日线与 4 小时线不在放量急跌破位中（大跌日不做多任何山寨）。',
      '品种有独立逻辑：做多只挑近 14 天跑赢 BTC 的龙头；做空只挑已走出更低高点且跌破颈线的退潮币。',
      '排雷通过：未来 48 小时无占流通盘 3% 以上的大额代币解锁或下架公告。',
      '防逼空核查：做空前确认资金费率高于 -0.05%，且看清结算周期（8 小时还是 4 小时）。',
      '合约面值核对：已看清 1 张等于多少枚币（如 DOGE 为 1,000 枚、ZEC 为 0.01 枚），确认 USDT 名义价值。',
      '信号已收盘：等 4 小时 K 线收盘确认后再进，不追盘中未收盘突破，止损宽度不超过 10%~12%。',
      '风控双降档：单笔风险降至 0.25%~0.5%，逐仓 2~3 倍杠杆，手上山寨仓位不超过 2 个。',
    ],
  },
  intra: {
    title: '美盘日内噪声突破清单（第 22 课）',
    desc: '形态一专用：北京时间 20:30~23:30 整点或半点检查。',
    items: [
      '盘前已标出昨日高低点、今日 08:00 开盘价与近期整数关口，查清今日事件禁开仓窗口。',
      '当前处于北京时间 20:30~23:30 之间，刚走完一根整点或半点的 15 分钟线。',
      '该根 15 分钟收盘价明确落在今日噪声包络线外侧，且与当日累计 VWAP 同侧。',
      '止损设在进场那一刻的 VWAP，双边手续费滑点占止损距离不超过 0.2R。',
      '止损单已挂入交易所，并设好 23:50 平仓闹钟，绝不把日内单拖过夜。',
    ],
  },
  daily: {
    title: '每日固定看盘与复盘流程（约 20 分钟）',
    desc: '固定在早 8 点日线收盘后与晚间美盘开盘前各看一次，其余时间关软件。',
    items: [
      '查事件日历：今天与明天有无重磅宏观数据或代币解锁。',
      '看 BTC、ETH、ANT 日线并过一遍选币漏斗，各写一句方向与位置描述。',
      '在 4 小时图上标出离现价最近的一道支撑带和阻力带。',
      '检查已有持仓：触发止损单是否挂好，是否到达移动止损条件。',
      '把今日交易（含「无信号不交易」）及下单情绪记入交易日志。',
    ],
  },
};

const DEFAULT_PLAN = `我的交易计划（第 18、24 课一页纸模板）

1. 资金与时间边界
   交易专用资金上限：______ USDT（亏光不影响生活与学业）
   固定看盘时段：北京时间 08:15 与 21:00

2. 品种与工具
   主力品种：BTC、ETH（逐仓 3~5 倍，单笔风险 0.5%~1%）
   活跃山寨：仅限过四步漏斗的前 30 成交额品种（逐仓 2~3 倍，单笔风险 0.25%~0.5%，最多同时持 2 单）

3. 只做以下书面结构
   - 主流趋势回调 / 突破回踩（第 17 课）
   - 活跃山寨：强势龙头回踩、日线关键位插针收回、高潮退潮右侧破位（第 24 课）
   严禁：暴涨途中左侧摸顶做空、半山腰无日线支撑乱接下影线、负费率低于 -0.05% 时做空

4. 刹车线
   单日亏满 2R 当天停手；单周亏满 4R 本周停手；账户回撤达 10% 单笔风险减半。`;

export interface JournalRecord {
  id: string;
  date: string;
  sym: string;
  dir: 1 | -1;
  tag: string;
  r: number;
  planned: boolean;
  mood: string;
  why: string;
}

const JN_KEY = 'study:journal:v1';
const PLAN_KEY = 'study:plan:v1';

interface Props {
  initialSection?: string | null;
  syncedReplayItem: ReplayLogItem | null;
}

export const CheckJournalView: React.FC<Props> = ({ initialSection, syncedReplayItem }) => {
  const [mode, setMode] = useState<'check' | 'journal' | 'plan'>('check');
  const [ckKey, setCkKey] = useState<string>('pre');
  const [ckState, setCkState] = useState<Record<string, boolean>>({});
  const [planText, setPlanText] = useState<string>(() => localStorage.getItem(PLAN_KEY) || DEFAULT_PLAN);

  const [records, setRecords] = useState<JournalRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(JN_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [fSym, setFSym] = useState<string>('SOL');
  const [fDir, setFDir] = useState<1 | -1>(1);
  const [fTag, setFTag] = useState<string>('强势龙头回踩');
  const [fR, setFR] = useState<string>('2.0');
  const [fPlan, setFPlan] = useState<boolean>(true);
  const [fMood, setFMood] = useState<string>('平静');
  const [fWhy, setFWhy] = useState<string>('');

  useEffect(() => {
    if (initialSection === 'journal') setMode('journal');
    else if (initialSection === 'mine' || initialSection === 'plan') setMode('plan');
    else if (initialSection && CHECKLISTS[initialSection]) {
      setMode('check');
      setCkKey(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (!syncedReplayItem) return;
    const rec: JournalRecord = {
      id: syncedReplayItem.id,
      date: new Date(syncedReplayItem.ts).toISOString().slice(0, 10),
      sym: syncedReplayItem.sym,
      dir: syncedReplayItem.dir,
      tag: syncedReplayItem.tag,
      r: syncedReplayItem.r,
      planned: true,
      mood: '盲测训练',
      why: `盲测回放（${syncedReplayItem.bar}）：${syncedReplayItem.why}`,
    };
    setRecords((prev) => {
      if (prev.some((x) => x.id === rec.id)) return prev;
      const next = [rec, ...prev];
      try {
        localStorage.setItem(JN_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [syncedReplayItem]);

  const curChecklist = CHECKLISTS[ckKey] || CHECKLISTS.pre;
  const checkedCount = curChecklist.items.filter((_, i) => ckState[`${ckKey}:${i}`]).length;

  const jnStats = useMemo(() => {
    const n = records.length;
    if (!n) return { n: 0, wr: 0, ev: 0, tot: 0, planEv: 0, offEv: 0 };
    const wins = records.filter((x) => x.r > 0).length;
    const tot = records.reduce((s, x) => s + x.r, 0);
    const pl = records.filter((x) => x.planned);
    const off = records.filter((x) => !x.planned);
    return {
      n,
      wr: (wins / n) * 100,
      ev: tot / n,
      tot,
      planEv: pl.length ? pl.reduce((s, x) => s + x.r, 0) / pl.length : 0,
      offEv: off.length ? off.reduce((s, x) => s + x.r, 0) / off.length : 0,
    };
  }, [records]);

  return (
    <div className="page-container">
      <header className="page-head">
        <h1>纪律清单、交易计划与 R 值日志</h1>
        <p>
          纪律靠清单，不靠意志力；自己到底有没有优势，靠满 100 笔交易日志说话。所有勾选、计划与日志均保存在本机浏览器并支持一键导出备份。
        </p>

        <div style={{ marginTop: '18px' }}>
          <div className="seg-group" role="tablist">
            <button
              type="button"
              role="tab"
              className="seg-item"
              aria-selected={mode === 'check'}
              onClick={() => setMode('check')}
            >
              开仓与日常清单
            </button>
            <button
              type="button"
              role="tab"
              className="seg-item"
              aria-selected={mode === 'journal'}
              onClick={() => setMode('journal')}
            >
              R 值交易日志 ({records.length})
            </button>
            <button
              type="button"
              role="tab"
              className="seg-item"
              aria-selected={mode === 'plan'}
              onClick={() => setMode('plan')}
            >
              我的书面交易计划
            </button>
          </div>
        </div>
      </header>

      {mode === 'check' && (
        <div className="reading-article" style={{ margin: 0 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <div className="seg-group" role="tablist">
              {(
                [
                  ['pre', '开仓前总清单'],
                  ['alt', '活跃山寨清单'],
                  ['intra', '美盘日内清单'],
                  ['daily', '每日流程'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={ckKey === k}
                  onClick={() => setCkKey(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-action"
              onClick={() => setCkState({})}
            >
              清空当前勾选
            </button>
          </div>

          <div className="lesson-body">
            <h2>{curChecklist.title}</h2>
            <p className="mut">{curChecklist.desc}</p>
            <ul className="todo">
              {curChecklist.items.map((item, idx) => {
                const k = `${ckKey}:${idx}`;
                const done = !!ckState[k];
                return (
                  <li
                    key={k}
                    className={done ? 'is-done' : ''}
                    onClick={() => setCkState((prev) => ({ ...prev, [k]: !done }))}
                  >
                    {item}
                  </li>
                );
              })}
            </ul>
            <div className={checkedCount === curChecklist.items.length ? 'key' : 'ex'}>
              <p>
                {checkedCount === curChecklist.items.length
                  ? `全部 ${curChecklist.items.length} 项核验通过，可按计划挂入进场单与止损单。`
                  : `已核验 ${checkedCount} / ${curChecklist.items.length} 项：全部打勾前严禁手动开仓。`}
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'journal' && (
        <div>
          <div className="kpi-row">
            <div className="kpi-box">
              <span>累计记录</span>
              <strong>{jnStats.n} 笔</strong>
              <small>胜率 {jnStats.wr.toFixed(0)}%</small>
            </div>
            <div className="kpi-box">
              <span>平均每笔期望</span>
              <strong className={jnStats.ev >= 0 ? 'up' : 'dn'}>
                {jnStats.ev >= 0 ? '+' : ''}
                {jnStats.ev.toFixed(2)} R
              </strong>
              <small>
                累计 {jnStats.tot >= 0 ? '+' : ''}
                {jnStats.tot.toFixed(2)} R
              </small>
            </div>
            <div className="kpi-box">
              <span>按计划单期望</span>
              <strong className={jnStats.planEv >= 0 ? 'up' : 'dn'}>
                {jnStats.planEv >= 0 ? '+' : ''}
                {jnStats.planEv.toFixed(2)} R
              </strong>
              <small>违例改动单平均 {jnStats.offEv.toFixed(2)} R</small>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const rv = parseFloat(fR);
              if (!Number.isFinite(rv) || !fWhy.trim()) return;
              const rec: JournalRecord = {
                id: `jn-${Date.now()}`,
                date: new Date().toISOString().slice(0, 10),
                sym: fSym,
                dir: fDir,
                tag: fTag,
                r: Number(rv.toFixed(2)),
                planned: fPlan,
                mood: fMood,
                why: fWhy.trim(),
              };
              const next = [rec, ...records];
              setRecords(next);
              localStorage.setItem(JN_KEY, JSON.stringify(next));
              setFWhy('');
            }}
            style={{ marginBottom: '24px' }}
          >
            <div className="field-grid">
              <div className="field">
                <label htmlFor="jf-sym">品种与方向</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select id="jf-sym" value={fSym} onChange={(e) => setFSym(e.target.value)}>
                    {['BTC', 'ETH', 'ANT', 'SOL', 'DOGE', 'ZEC', 'PEPE', '其他山寨'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="方向"
                    value={fDir}
                    onChange={(e) => setFDir(Number(e.target.value) as 1 | -1)}
                  >
                    <option value={1}>做多</option>
                    <option value={-1}>做空</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="jf-tag">采用打法</label>
                <select id="jf-tag" value={fTag} onChange={(e) => setFTag(e.target.value)}>
                  {[
                    '强势龙头回踩',
                    '关键位插针收回',
                    '右侧破位做空',
                    '趋势回调',
                    '突破回踩',
                    '区间高抛低吸',
                    '日内噪声突破',
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="jf-r">本笔净结果 (单位 R，止损填 -1)</label>
                <input
                  id="jf-r"
                  type="number"
                  step="0.05"
                  value={fR}
                  onChange={(e) => setFR(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="jf-plan">是否按计划与情绪</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select
                    id="jf-plan"
                    value={fPlan ? '1' : '0'}
                    onChange={(e) => setFPlan(e.target.value === '1')}
                  >
                    <option value="1">按计划执行</option>
                    <option value="0">盘中违例改动</option>
                  </select>
                  <select
                    aria-label="情绪"
                    value={fMood}
                    onChange={(e) => setFMood(e.target.value)}
                  >
                    {['平静', '怕错过着急', '想翻本', '犹豫害怕', '过度自信'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="field" style={{ marginTop: '12px' }}>
              <label htmlFor="jf-why">进场理由与事后复盘（必填）</label>
              <input
                id="jf-why"
                type="text"
                placeholder="写出位置、哪条规则、哪里做对或做错"
                value={fWhy}
                onChange={(e) => setFWhy(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <button type="submit" className="btn-primary">
                保存日志记录
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  if (!records.length) return;
                  const csv =
                    '\uFEFF日期,品种,方向,打法,结果R,按计划,情绪,理由复盘\n' +
                    records
                      .map(
                        (r) =>
                          `${r.date},${r.sym},${r.dir === 1 ? '多' : '空'},${r.tag},${r.r},${r.planned ? '是' : '否'},${r.mood},"${r.why.replace(/"/g, '""')}"`,
                      )
                      .join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = '交易日志.csv';
                  a.click();
                }}
              >
                导出 CSV
              </button>
            </div>
          </form>

          <div className="tool-tw">
            <table className="tool-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>品种</th>
                  <th>打法</th>
                  <th className="n">结果</th>
                  <th>按计划</th>
                  <th>情绪</th>
                  <th>理由与复盘</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="mut">
                      暂无记录。在盲测复盘台平仓会自动同步到这里，也可以在上方手动登记。
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>
                        <b>{r.sym}</b> {r.dir === 1 ? '多' : '空'}
                      </td>
                      <td>{r.tag}</td>
                      <td className={`n ${r.r >= 0 ? 'up' : 'dn'}`}>
                        {r.r >= 0 ? '+' : ''}
                        {r.r.toFixed(2)} R
                      </td>
                      <td className={r.planned ? '' : 'dn'}>{r.planned ? '是' : '否'}</td>
                      <td>{r.mood}</td>
                      <td>{r.why}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'plan' && (
        <div className="reading-article" style={{ margin: 0 }}>
          <div className="field">
            <label htmlFor="plan-box">书面交易计划（修改后自动保存在本机）</label>
            <textarea
              id="plan-box"
              rows={20}
              value={planText}
              onChange={(e) => {
                setPlanText(e.target.value);
                localStorage.setItem(PLAN_KEY, e.target.value);
              }}
            />
          </div>
          <div style={{ marginTop: '14px', display: 'flex', gap: '16px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([planText], { type: 'text/plain' }));
                a.download = '我的交易计划.txt';
                a.click();
              }}
            >
              下载为 TXT 文本
            </button>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setPlanText(DEFAULT_PLAN);
                localStorage.setItem(PLAN_KEY, DEFAULT_PLAN);
              }}
            >
              恢复默认模板
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
