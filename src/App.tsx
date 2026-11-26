import React, { useCallback, useEffect, useState } from 'react';
import { BarTuple } from './lib/market';
import { ChartBlob, GlossTuple } from './lib/enhanceLesson';
import { LessonData, LessonReader, PartData } from './components/LessonReader';
import { RoadmapView } from './components/RoadmapView';
import { CalculatorsView } from './components/CalculatorsView';
import { ReplayLogItem, ReplayView } from './components/ReplayView';
import { EventsPayload, EventsView } from './components/EventsView';
import { CheckJournalView } from './components/CheckJournalView';
import { GlossaryView } from './components/GlossaryView';

type ActiveView = 'roadmap' | 'lesson' | 'replay' | 'calc' | 'events' | 'check' | 'gloss';

const DONE_KEY = 'study:done:v1';
const LAST_LESSON_KEY = 'study:last-lesson:v1';
const THEME_KEY = 'study:theme:v1';

export const App: React.FC = () => {
  const [view, setView] = useState<ActiveView>('roadmap');
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [scrollPct, setScrollPct] = useState<number>(0);
  const [activeLessonId, setActiveLessonId] = useState<string>(
    () => localStorage.getItem(LAST_LESSON_KEY) || 'l01',
  );
  const [targetAnchor, setTargetAnchor] = useState<string | null>(null);
  const [subTarget, setSubTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem(THEME_KEY) === 'dark');

  const [parts, setParts] = useState<PartData[]>([]);
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [glossary, setGlossary] = useState<GlossTuple[]>([]);
  const [charts, setCharts] = useState<Record<string, ChartBlob>>({});
  const [seed, setSeed] = useState<Record<string, BarTuple[]>>({});
  const [eventsData, setEventsData] = useState<EventsPayload | null>(null);
  const [syncedReplayItem, setSyncedReplayItem] = useState<ReplayLogItem | null>(null);

  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 32);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 80 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [view, activeLessonId]);

  useEffect(() => {
    Promise.all([
      fetch('./data/curriculum.json').then((r) => r.json()),
      fetch('./data/lesson-charts.json').then((r) => r.json()),
      fetch('./data/market-seed.json').then((r) => r.json()),
      fetch('./data/events-data.json').then((r) => r.json()),
    ])
      .then(([curr, ch, sd, ev]) => {
        setParts(curr.parts || []);
        setLessons(curr.lessons || []);
        setGlossary(curr.glossary || []);
        setCharts(ch || {});
        setSeed(sd || {});
        setEventsData(ev || null);
      })
      .catch((err) => console.error('Failed loading study bundle:', err));
  }, []);

  const selectLesson = useCallback((id: string, anchor: string | null = null) => {
    setActiveLessonId(id);
    setTargetAnchor(anchor);
    setView('lesson');
    localStorage.setItem(LAST_LESSON_KEY, id);
  }, []);

  const toggleDone = useCallback((id: string) => {
    setDoneMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleRouteHref = useCallback(
    (href: string) => {
      const [filePart, hashPart] = href.split('#');
      const stem = filePart.replace(/\.html$/i, '');
      if (!stem) {
        if (hashPart) document.getElementById(hashPart)?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (/^l\d\d$/i.test(stem)) {
        selectLesson(stem.toLowerCase(), hashPart || null);
      } else if (stem === 'index') {
        setView('roadmap');
        window.scrollTo({ top: 0 });
      } else if (stem === 'calc') {
        setSubTarget(hashPart || 'size');
        setView('calc');
        window.scrollTo({ top: 0 });
      } else if (stem === 'replay') {
        setView('replay');
        window.scrollTo({ top: 0 });
      } else if (stem === 'events') {
        setSubTarget(hashPart || 'table');
        setView('events');
        window.scrollTo({ top: 0 });
      } else if (stem === 'journal') {
        setSubTarget('journal');
        setView('check');
        window.scrollTo({ top: 0 });
      } else if (stem === 'check') {
        setSubTarget(hashPart || 'pre');
        setView('check');
        window.scrollTo({ top: 0 });
      } else if (stem === 'gloss') {
        setView('gloss');
        window.scrollTo({ top: 0 });
      }
    },
    [selectLesson],
  );

  const doneCount = lessons.filter((l) => doneMap[l.id]).length;
  const overCover = view === 'roadmap';

  return (
    <>
      <header
        className={`top-bar ${overCover ? 'over-cover' : ''} ${scrolled ? 'is-scrolled' : ''}`}
      >
        <div className="top-bar-inner">
          <div className="brand-group">
            {view === 'lesson' && (
              <button
                type="button"
                className="drawer-toggle"
                onClick={() => setDrawerOpen((o) => !o)}
              >
                目录
              </button>
            )}
            <button
              type="button"
              className="brand-wordmark"
              onClick={() => {
                setView('roadmap');
                window.scrollTo({ top: 0 });
              }}
            >
              交易研习录<span style={{ color: 'var(--acc)' }}>·</span>
            </button>
          </div>

          <nav className="top-nav" role="tablist" aria-label="研习卷与演武工具">
            {(
              [
                ['roadmap', '总目画报'],
                ['lesson', '讲义精读 (24 讲)'],
                ['replay', '盲测沙盘'],
                ['calc', '风控与山寨算盘'],
                ['events', '事件演练'],
                ['check', '纪律与日志'],
                ['gloss', '术语索引'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                className="top-tab"
                aria-selected={view === k}
                onClick={() => {
                  setSubTarget(null);
                  setView(k);
                  window.scrollTo({ top: 0 });
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="top-tools">
            <span className="prog-stat">
              已读 {doneCount} / {lessons.length || 24} 讲
            </span>
            <button
              type="button"
              className="theme-switch"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? '日读纸页' : '夜读深林'}
            </button>
          </div>
        </div>
      </header>

      {view === 'lesson' && scrollPct > 1 && (
        <div className="reading-progress-line" style={{ width: `${scrollPct}%` }} />
      )}

      <main className={overCover ? '' : 'app-body-offset'}>
        {lessons.length === 0 ? (
          <div className="page-container">
            <p>正在展开二十四讲专著与历史行情图版…</p>
          </div>
        ) : view === 'roadmap' ? (
          <RoadmapView
            parts={parts}
            lessons={lessons}
            doneMap={doneMap}
            onOpenLesson={(id) => selectLesson(id, null)}
            onOpenTool={(t) => {
              setView(t);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : view === 'lesson' ? (
          <LessonReader
            parts={parts}
            lessons={lessons}
            charts={charts}
            glossary={glossary}
            activeLessonId={activeLessonId}
            targetAnchor={targetAnchor}
            doneMap={doneMap}
            drawerOpen={drawerOpen}
            onCloseDrawer={() => setDrawerOpen(false)}
            onSelectLesson={selectLesson}
            onToggleDone={toggleDone}
            onRouteHref={handleRouteHref}
          />
        ) : view === 'calc' ? (
          <CalculatorsView initialSubTool={subTarget} />
        ) : view === 'replay' ? (
          <ReplayView seed={seed} dark={dark} onSyncJournal={setSyncedReplayItem} />
        ) : view === 'events' ? (
          <EventsView
            data={eventsData}
            charts={charts}
            glossary={glossary}
            initialTab={subTarget}
            onRouteHref={handleRouteHref}
          />
        ) : view === 'check' ? (
          <CheckJournalView
            initialSection={subTarget}
            syncedReplayItem={syncedReplayItem}
          />
        ) : (
          <GlossaryView
            glossary={glossary}
            onOpenLesson={(id) => selectLesson(id, null)}
          />
        )}
      </main>

      <footer className="site-colophon">
        <div className="site-colophon-inner">
          <span>交易研习录 · 二十四讲实盘方法论与活跃山寨实战专著</span>
          <span>
            全书 89 幅行情图版均源自 OKX 公共实盘历史数据，仅供风险测算与历史盲测研习，不构成任何投资建议。
          </span>
        </div>
      </footer>
    </>
  );
};
