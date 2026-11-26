import React, { useMemo } from 'react';
import { LessonData, PartData } from './LessonReader';

interface Props {
  parts: PartData[];
  lessons: LessonData[];
  doneMap: Record<string, boolean>;
  onOpenLesson: (id: string) => void;
  onOpenTool: (tool: 'replay' | 'calc' | 'events' | 'check' | 'gloss') => void;
}

export const RoadmapView: React.FC<Props> = ({
  parts,
  lessons,
  doneMap,
  onOpenLesson,
  onOpenTool,
}) => {
  const lessonById = useMemo(() => {
    const m: Record<string, LessonData> = {};
    lessons.forEach((l) => {
      m[l.id] = l;
    });
    return m;
  }, [lessons]);

  const doneCount = lessons.filter((l) => doneMap[l.id]).length;
  const nextLesson = lessons.find((l) => !doneMap[l.id]) || lessons[0];

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  return (
    <div>
      <section className="cover-hero">
        <img
          className="cover-art"
          src="./media/monograph-hero.jpg"
          alt="深松黑石板、金属比例尺与朱砂红光学棱镜构成的几何静物"
        />
        <div className="cover-scrim" />

        <div className="cover-inner">
          <h1 className="cover-title">以数学与纪律，驾驭高波动市场</h1>
          <p className="cover-lead">
            二十四讲实盘数据方法论与六套交互演武沙盘，从合约强平底线一路推演到活跃山寨币实战。
          </p>
          <div className="cover-action">
            {nextLesson && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenLesson(nextLesson.id)}
              >
                {doneCount > 0
                  ? `继续精读：第 ${nextLesson.num} 课`
                  : '翻开第 1 课开始精读'}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="monograph-wrap">
        <section className="editorial-manifesto">
          <h2>不讲玄学喊单，只拆解能复算的生存算术</h2>
          <div>
            <p>
              公开实证数据里，坚持做短线的散户九成以上最终亏损。这部研习专著把零基础最容易踩空的全部环节拆成十卷二十四讲：前二十讲在 BTC、ETH、ANT 上立住仓位公式、结构止损与预期差框架；后四讲进入美盘日内噪声突破与活跃山寨币的选币漏斗、关键位插针收回及逼空防线。
            </p>
            <p style={{ marginTop: '14px' }}>
              全部 89 幅 K 线图均切自 OKX 真实历史行情，289 条专业术语随文点击即解。用真钱之前，先在盲测沙盘里做满一百笔样本验证自己的正期望。
            </p>
          </div>
        </section>

        {parts.map((p) => (
          <section className="volume-row" key={p.id}>
            <div className="volume-head">
              <h2>
                卷 {p.index} · {p.title}
              </h2>
              <p>{p.desc}</p>
            </div>

            <div className="chapter-table">
              {p.lessons.map((lid) => {
                const l = lessonById[lid];
                if (!l) return null;
                const [mainT, subT] = l.title.split('：');
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="chapter-row-btn"
                    onClick={() => onOpenLesson(l.id)}
                  >
                    <span className="chapter-num">{pad2(l.num)}</span>
                    <div className="chapter-main">
                      <h3>{mainT}</h3>
                      <p>{subT || l.sub}</p>
                    </div>
                    <span className="chapter-meta">
                      {doneMap[l.id] ? '✓ 已读 · ' : ''}
                      {l.must ? '核心' : '进阶'} · {l.min} 分钟
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="atelier-band">
        <div className="atelier-inner">
          <div>
            <h2>光看懂讲义不够，去六套演武工坊里练出肌肉记忆</h2>
            <p>
              读完任意一章，直接切进配套沙盘：手算合约面值与强平安全缓冲，拉动滑块看高 FDV 新币解锁稀释，或在遮住日期的真实 K 线里逐根盲测。
            </p>
          </div>

          <div className="atelier-links">
            <button type="button" className="atelier-item" onClick={() => onOpenTool('replay')}>
              <strong>K 线历史盲测沙盘</strong>
              <span>遮蔽日期并随机缩放 BTC / SOL / DOGE / ZEC 真实行情，按 R 记账</span>
            </button>
            <button type="button" className="atelier-item" onClick={() => onOpenTool('calc')}>
              <strong>仓位、强平与山寨稀释算盘</strong>
              <span>内置 8 种合约面值、百笔蒙特卡洛模拟与 OKX 实时 15m 噪声边界</span>
            </button>
            <button type="button" className="atelier-item" onClick={() => onOpenTool('events')}>
              <strong>外部事件与 12 道预期差演练</strong>
              <span>39 类宏观与加密事件传导表、北京时间日历与带图实战推演</span>
            </button>
            <button type="button" className="atelier-item" onClick={() => onOpenTool('check')}>
              <strong>开仓一票否决清单与 R 值账本</strong>
              <span>主流波段、活跃山寨、美盘日内三套闸门与百笔复盘 CSV 账本</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
