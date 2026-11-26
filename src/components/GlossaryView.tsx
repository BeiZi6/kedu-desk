import React, { useMemo, useState } from 'react';
import { GlossTuple } from '../lib/enhanceLesson';

interface Props {
  glossary: GlossTuple[];
  onOpenLesson: (lessonId: string) => void;
}

export const GlossaryView: React.FC<Props> = ({ glossary, onOpenLesson }) => {
  const [q, setQ] = useState<string>('');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return glossary;
    return glossary.filter(
      ([names, exp, lid]) =>
        names.toLowerCase().includes(kw) ||
        exp.toLowerCase().includes(kw) ||
        lid.toLowerCase().includes(kw),
    );
  }, [glossary, q]);

  return (
    <div className="page-container">
      <header className="page-head">
        <h1>全课术语词典（共 {glossary.length} 条）</h1>
        <p>
          收录第 1~24 课全部首次出现的交易、微观结构、宏观事件与活跃山寨币术语。在讲义正文里遇到带蓝色虚线的词，也可以直接点击查看解释。
        </p>

        <div style={{ marginTop: '16px', maxWidth: '380px' }}>
          <input
            type="search"
            className="rail-search"
            style={{ marginBottom: 0 }}
            placeholder="搜索术语或关键词（如：ATR、强平、FDV、逼空）…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </header>

      <div className="tool-tw">
        <table className="tool-table">
          <thead>
            <tr>
              <th>术语（含常见别名）</th>
              <th>白话解释</th>
              <th>首次细讲</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([names, exp, lid], idx) => (
              <tr key={idx}>
                <td>
                  <b>{names.split('|').join(' / ')}</b>
                </td>
                <td>{exp}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => onOpenLesson(lid)}
                  >
                    第 {parseInt(lid.slice(1), 10)} 课
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
