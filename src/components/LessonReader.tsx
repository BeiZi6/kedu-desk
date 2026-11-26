import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChartBlob, GlossTuple, enhanceRichContainer } from '../lib/enhanceLesson';

export interface LessonData {
  id: string;
  num: number;
  partId: string;
  partIndex: number;
  title: string;
  sub: string;
  min: number;
  must: boolean;
  goals: string[];
  sections: { id: string; title: string }[];
  html: string;
}

export interface PartData {
  id: string;
  index: number;
  title: string;
  desc: string;
  lessons: string[];
}

interface Props {
  parts: PartData[];
  lessons: LessonData[];
  charts: Record<string, ChartBlob>;
  glossary: GlossTuple[];
  activeLessonId: string;
  targetAnchor: string | null;
  doneMap: Record<string, boolean>;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  onSelectLesson: (id: string, anchor?: string | null) => void;
  onToggleDone: (id: string) => void;
  onRouteHref: (href: string) => void;
}

export const LessonReader: React.FC<Props> = ({
  parts,
  lessons,
  charts,
  glossary,
  activeLessonId,
  targetAnchor,
  doneMap,
  drawerOpen,
  onCloseDrawer,
  onSelectLesson,
  onToggleDone,
  onRouteHref,
}) => {
  const [railFilter, setRailFilter] = useState<string>('');
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [activeSec, setActiveSec] = useState<string>('');
  const [popover, setPopover] = useState<{
    title: string;
    exp: string;
    lessonId: string;
    top: number;
    left: number;
  } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const lessonById = useMemo(() => {
    const m: Record<string, LessonData> = {};
    lessons.forEach((l) => {
      m[l.id] = l;
    });
    return m;
  }, [lessons]);

  const lesson = lessonById[activeLessonId] || lessons[0];
  const part = parts.find((p) => p.id === lesson?.partId);
  const curOrderIdx = lessons.findIndex((l) => l.id === lesson?.id);
  const prevLesson = curOrderIdx > 0 ? lessons[curOrderIdx - 1] : null;
  const nextLesson =
    curOrderIdx >= 0 && curOrderIdx < lessons.length - 1 ? lessons[curOrderIdx + 1] : null;

  const doneCount = useMemo(
    () => lessons.filter((l) => doneMap[l.id]).length,
    [lessons, doneMap],
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !lesson) return;
    setPopover(null);
    el.innerHTML = lesson.html;
    const cleanup = enhanceRichContainer({
      root: el,
      scopeKey: lesson.id,
      charts,
      glossary,
      onOpenTerm: ({ title, exp, lessonId, rect }) => {
        const left = Math.max(12, Math.min(window.innerWidth - 376, rect.left));
        const below = rect.bottom + 8;
        const top = below + 160 > window.innerHeight ? Math.max(72, rect.top - 150) : below;
        setPopover({ title, exp, lessonId, top, left });
      },
      onRouteHref,
    });

    if (targetAnchor) {
      window.requestAnimationFrame(() => {
        const target = el.querySelector(`#${CSS.escape(targetAnchor)}`) as HTMLElement | null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0 });
      });
    } else {
      window.scrollTo({ top: 0 });
    }

    return cleanup;
  }, [lesson, charts, glossary, targetAnchor, onRouteHref]);

  useEffect(() => {
    if (!popover) return;
    const dismiss = () => setPopover(null);
    window.addEventListener('click', dismiss);
    window.addEventListener('scroll', dismiss, { passive: true });
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('scroll', dismiss);
    };
  }, [popover]);

  useEffect(() => {
    if (!lesson?.sections.length) return;
    setActiveSec(lesson.sections[0].id);
    const onScroll = () => {
      const root = bodyRef.current;
      if (!root) return;
      let cur = lesson.sections[0].id;
      for (const s of lesson.sections) {
        const secEl = root.querySelector(`#${CSS.escape(s.id)}`);
        if (secEl && secEl.getBoundingClientRect().top <= 135) {
          cur = s.id;
        }
      }
      setActiveSec(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lesson]);

  if (!lesson) return null;
  const isDone = !!doneMap[lesson.id];
  const q = railFilter.trim().toLowerCase();
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  return (
    <div className={`study-shell ${zenMode ? 'is-zen' : ''}`}>
      <div
        className={`drawer-backdrop ${drawerOpen ? 'is-open' : ''}`}
        onClick={onCloseDrawer}
      />

      {!zenMode && (
        <aside className={`curriculum-rail ${drawerOpen ? 'is-open' : ''}`} aria-label="专著目录">
          <input
            type="search"
            className="rail-search"
            placeholder="检索二十四讲标题或关键词…"
            value={railFilter}
            onChange={(e) => setRailFilter(e.target.value)}
          />

          <div className="rail-progress-bar" title={`已读完 ${doneCount} / ${lessons.length} 讲`}>
            <i style={{ width: `${lessons.length ? (doneCount / lessons.length) * 100 : 0}%` }} />
          </div>

          {parts.map((p) => {
            const pLessons = p.lessons
              .map((id) => lessonById[id])
              .filter(
                (l) =>
                  l &&
                  (!q ||
                    l.title.toLowerCase().includes(q) ||
                    l.sub.toLowerCase().includes(q) ||
                    `第${l.num}课`.includes(q)),
              );
            if (!pLessons.length) return null;
            return (
              <div className="rail-part" key={p.id}>
                <div className="rail-part-title">
                  卷 {p.index} · {p.title}
                </div>
                {pLessons.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`rail-lesson-btn ${l.id === lesson.id ? 'is-active' : ''}`}
                    onClick={() => {
                      onSelectLesson(l.id, null);
                      onCloseDrawer();
                    }}
                  >
                    <span>
                      {pad2(l.num)} · {l.title.split('：')[0]}
                    </span>
                    {doneMap[l.id] && <span className="rail-done-mark">✓</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>
      )}

      <div className="reading-pane">
        <article className="reading-article">
          <header className="lesson-header">
            <h1 className="lesson-h1">
              第 {lesson.num} 课 · {lesson.title}
            </h1>

            <div className="folio-meta-row">
              <span>
                卷 {part?.index ?? 0}：{part?.title} · 第 {pad2(lesson.num)} / 24 讲 ·{' '}
                {lesson.must ? '核心必读' : '进阶选读'} · 约 {lesson.min} 分钟
              </span>
              <button
                type="button"
                className="text-action zen-toggle-btn"
                onClick={() => setZenMode((z) => !z)}
              >
                {zenMode ? '展开左侧书脊' : '专注书页模式'}
              </button>
            </div>

            {lesson.sub && <p className="lesson-sub">{lesson.sub}</p>}

            {lesson.goals.length > 0 && (
              <div className="goals-folio">
                <div className="goals-folio-title">本章核心习得目标</div>
                <ul className="goals-grid">
                  {lesson.goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </header>

          <div className="lesson-body" ref={bodyRef} />

          <footer className="chapter-colophon">
            <div>
              {prevLesson ? (
                <button
                  type="button"
                  className="text-action"
                  onClick={() => onSelectLesson(prevLesson.id, null)}
                >
                  ← 上一讲：{pad2(prevLesson.num)} · {prevLesson.title.split('：')[0]}
                </button>
              ) : (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--forest-muted)' }}>
                  开篇第一讲
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!isDone) onToggleDone(lesson.id);
                  if (nextLesson) onSelectLesson(nextLesson.id, null);
                }}
              >
                {nextLesson
                  ? isDone
                    ? `翻至第 ${nextLesson.num} 课 →`
                    : `读毕本讲，翻至第 ${nextLesson.num} 课 →`
                  : isDone
                    ? '已读完全书二十四讲'
                    : '标记第 24 课读毕'}
              </button>

              {isDone && (
                <button
                  type="button"
                  className="text-action"
                  onClick={() => onToggleDone(lesson.id)}
                >
                  撤回已读标记
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>

      <aside className="outline-rail" aria-label="本章小节">
        <div className="outline-heading">本章脉络</div>
        <ul className="outline-list">
          {lesson.sections.map((s, idx) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`outline-link ${activeSec === s.id ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = bodyRef.current?.querySelector(`#${CSS.escape(s.id)}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {s.title === '自测' || s.title === '本课作业' ? s.title : `${idx + 1}. ${s.title}`}
              </a>
            </li>
          ))}
        </ul>

        <div className="outline-shortcuts">
          <div className="outline-heading">随堂演武沙盘</div>
          <button type="button" className="shortcut-link" onClick={() => onRouteHref('calc.html#size')}>
            仓位与强平算盘
          </button>
          <button type="button" className="shortcut-link" onClick={() => onRouteHref('replay.html')}>
            K 线历史盲测沙盘
          </button>
          <button type="button" className="shortcut-link" onClick={() => onRouteHref('events.html')}>
            外部事件与预期差演练
          </button>
          <button type="button" className="shortcut-link" onClick={() => onRouteHref('check.html#alt')}>
            开仓与活跃山寨清单
          </button>
        </div>
      </aside>

      {popover && (
        <div
          className="gloss-popover"
          style={{ top: `${popover.top}px`, left: `${popover.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="gloss-popover-head">
            <strong>{popover.title}</strong>
            <button
              type="button"
              className="text-action"
              style={{ color: 'var(--forest-ink)' }}
              onClick={() => {
                const lid = popover.lessonId;
                setPopover(null);
                onSelectLesson(lid, null);
              }}
            >
              出处：第 {parseInt(popover.lessonId.slice(1), 10)} 课
            </button>
          </div>
          <p>{popover.exp}</p>
        </div>
      )}
    </div>
  );
};
