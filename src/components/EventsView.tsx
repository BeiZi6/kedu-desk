import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChartBlob, GlossTuple, enhanceRichContainer } from '../lib/enhanceLesson';

export interface EventsPayload {
  table: [string, string, string, string, string, string, string, string][];
  cal: [string, string, string, string, string, string?][];
  cases: [string, string, string, string, number | null, number | null, number | null, number | null, string][];
  drillHtml: string;
}

interface Props {
  data: EventsPayload | null;
  charts: Record<string, ChartBlob>;
  glossary: GlossTuple[];
  initialTab?: string | null;
  onRouteHref: (href: string) => void;
}

export const EventsView: React.FC<Props> = ({
  data,
  charts,
  glossary,
  initialTab,
  onRouteHref,
}) => {
  const [tab, setTab] = useState<'table' | 'cal' | 'cases' | 'drill'>('table');
  const [cat, setCat] = useState<string>('全部');
  const [query, setQuery] = useState<string>('');
  const [caseCat, setCaseCat] = useState<string>('全部');
  const drillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab && ['table', 'cal', 'cases', 'drill'].includes(initialTab)) {
      setTab(initialTab as any);
    }
  }, [initialTab]);

  useEffect(() => {
    if (tab !== 'drill' || !drillRef.current || !data?.drillHtml) return;
    drillRef.current.innerHTML = data.drillHtml;
    return enhanceRichContainer({
      root: drillRef.current,
      scopeKey: 'events-drill',
      charts,
      glossary,
      onOpenTerm: () => {},
      onRouteHref,
    });
  }, [tab, data, charts, glossary, onRouteHref]);

  const categories = useMemo(() => {
    if (!data) return ['全部'];
    const s = new Set<string>(['全部']);
    data.table.forEach((r) => s.add(r[0]));
    return [...s];
  }, [data]);

  const caseCategories = useMemo(() => {
    if (!data) return ['全部'];
    const s = new Set<string>(['全部']);
    data.cases.forEach((r) => s.add(r[0]));
    return [...s];
  }, [data]);

  if (!data) {
    return (
      <div className="page-container">
        <p>正在加载外部事件库…</p>
      </div>
    );
  }

  const filteredRows = data.table.filter(
    (r) =>
      (cat === '全部' || r[0] === cat) &&
      (!query.trim() || r.join(' ').toLowerCase().includes(query.trim().toLowerCase())),
  );

  const fmtPct = (v: number | null) => {
    if (v === null || v === undefined) return <span className="mut">待统计</span>;
    return (
      <span className={v >= 0 ? 'up' : 'dn'}>
        {v >= 0 ? '+' : ''}
        {v.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="page-container">
      <header className="page-head">
        <h1>外部事件速查、宏观日历与预期差演练</h1>
        <p>
          所有利多利空方向均以「超出市场预期」为前提。已经被市场充分计价的消息落地后往往反向运行；看价格对消息的反应，永远比看新闻标题更可靠（详见第 12~16 课）。
        </p>

        <div style={{ marginTop: '18px' }}>
          <div className="seg-group" role="tablist">
            {(
              [
                ['table', `利多利空速查表 (${data.table.length})`],
                ['cal', '北京时间事件日历'],
                ['cases', `真实历史案例 (${data.cases.length})`],
                ['drill', '12 道预期差带图演练'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                className="seg-item"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === 'table' && (
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div className="seg-group" role="tablist">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={cat === c}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="rail-search"
              style={{ width: '240px', marginBottom: 0 }}
              placeholder="搜索：加息、ETF、解禁…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="tool-tw">
            <table className="tool-table">
              <thead>
                <tr>
                  <th>类别</th>
                  <th>事件（超预期时）</th>
                  <th>BTC</th>
                  <th>ETH</th>
                  <th>ANT</th>
                  <th>传导逻辑</th>
                  <th>什么时候会反过来</th>
                  <th>对应讲义</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r[0]}</td>
                    <td>
                      <b>{r[1]}</b>
                    </td>
                    <td className={r[2].includes('多') ? 'up' : r[2].includes('空') ? 'dn' : ''}>
                      {r[2]}
                    </td>
                    <td className={r[3].includes('多') ? 'up' : r[3].includes('空') ? 'dn' : ''}>
                      {r[3]}
                    </td>
                    <td className={r[4].includes('多') ? 'up' : r[4].includes('空') ? 'dn' : ''}>
                      {r[4]}
                    </td>
                    <td>{r[5]}</td>
                    <td>{r[6]}</td>
                    <td>
                      <button
                        type="button"
                        className="text-action"
                        onClick={() => onRouteHref(`${r[7]}.html`)}
                      >
                        第 {parseInt(r[7].slice(1), 10)} 课
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cal' && (
        <div className="tool-tw">
          <table className="tool-table">
            <thead>
              <tr>
                <th>北京时间</th>
                <th>事件</th>
                <th>主要影响</th>
                <th>日程状态</th>
                <th>操作与背景说明</th>
              </tr>
            </thead>
            <tbody>
              {data.cal.map((c, idx) => (
                <tr key={idx}>
                  <td>
                    <b>{c[5] || c[0]}</b>
                  </td>
                  <td>{c[1]}</td>
                  <td>{c[2]}</td>
                  <td>{c[3] === 'ok' ? '官方确认' : '暂定 / 估计'}</td>
                  <td>{c[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cases' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div className="seg-group" role="tablist">
              {caseCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  className="seg-item"
                  aria-selected={caseCat === c}
                  onClick={() => setCaseCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="tool-tw">
            <table className="tool-table">
              <thead>
                <tr>
                  <th>UTC 日期</th>
                  <th>品种</th>
                  <th>事件</th>
                  <th className="n">前 30 天</th>
                  <th className="n">当天</th>
                  <th className="n">后 7 天</th>
                  <th className="n">后 30 天</th>
                  <th>预期差复盘</th>
                </tr>
              </thead>
              <tbody>
                {data.cases
                  .filter((r) => caseCat === '全部' || r[0] === caseCat)
                  .map((r, idx) => (
                    <tr key={idx}>
                      <td>{r[2]}</td>
                      <td>
                        <b>{r[1]}</b>
                      </td>
                      <td>{r[3]}</td>
                      <td className="n">{fmtPct(r[4])}</td>
                      <td className="n">{fmtPct(r[5])}</td>
                      <td className="n">{fmtPct(r[6])}</td>
                      <td className="n">{fmtPct(r[7])}</td>
                      <td>{r[8]}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'drill' && (
        <div className="reading-article" style={{ margin: 0, maxWidth: '780px' }}>
          <div className="lesson-body" ref={drillRef} />
        </div>
      )}
    </div>
  );
};
