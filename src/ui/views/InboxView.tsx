import { useState } from 'react';
import { EVENT_CATEGORIES, formatDate, pendingView, type LogCategory } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel } from '../design/primitives';
import styles from '../screens/game.module.css';
import viewStyles from './views.module.css';

type Filter = 'all' | 'unread' | 'decisions' | LogCategory;

const CATEGORY_LABELS: Record<LogCategory, string> = {
  general: 'General',
  economy: 'Economy',
  personal: 'Personal',
  disaster: 'Disasters',
  corruption: 'Corruption',
  unrest: 'Unrest',
  security: 'Security',
  terror: 'Terror',
  military: 'Military',
  diplomacy: 'Diplomacy',
};

export function InboxView() {
  const game = useGame((s) => s.game);
  const [filter, setFilter] = useState<Filter>('all');
  if (!game) return null;

  const { dispatch, openDecision } = gameStore.getState();
  const unread = game.log.filter((e) => !e.read).length;
  const waiting = game.events.pending.flatMap((p) => {
    const view = pendingView(game, p);
    return view ? [view] : [];
  });
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: `Unread (${unread})` },
    { id: 'decisions', label: `Decisions (${waiting.length})` },
    ...(['general', ...EVENT_CATEGORIES] as LogCategory[]).map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
  ];

  const entries = [...game.log].reverse().filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !e.read;
    if (filter === 'decisions') return e.pendingId !== null && game.events.pending.some((p) => p.id === e.pendingId);
    return e.category === filter;
  });

  return (
    <>
      <div className={styles.viewHeader}>
        <div>
          <h1 className={styles.viewTitle}>Inbox</h1>
          <p className={styles.viewSubtitle}>Briefings, crises and decisions for the President</p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" onClick={() => dispatch({ type: 'MARK_ALL_LOG_READ' })}>
            Mark all read
          </Button>
        )}
      </div>

      {waiting.length > 0 && (
        <Panel title={`Decisions waiting (${waiting.length})`}>
          <ul className={viewStyles.decisionList} aria-label="Decisions waiting">
            {waiting.map((w) => (
              <li key={w.pending.id} className={viewStyles.decisionRow} data-severity={w.def.severity}>
                <div>
                  <div className={viewStyles.personName}>{w.title}</div>
                  <div className={viewStyles.muted}>
                    {w.daysLeft} day{w.daysLeft === 1 ? '' : 's'} left
                  </div>
                </div>
                <Button variant="primary" aria-label={`Decide: ${w.title}`} onClick={() => openDecision(w.pending.id)}>
                  Decide
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className={viewStyles.filters} role="group" aria-label="Inbox filters">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={viewStyles.chip}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className={styles.inbox} style={{ maxHeight: 'none' }} aria-label="Inbox messages">
        {entries.length === 0 && <li className={styles.muted}>Nothing here.</li>}
        {entries.map((entry) => {
          const open = entry.pendingId !== null && game.events.pending.some((p) => p.id === entry.pendingId);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.inboxItem}
                data-severity={entry.severity}
                data-read={entry.read}
                onClick={() => {
                  if (!entry.read) dispatch({ type: 'MARK_LOG_READ', id: entry.id });
                  if (open && entry.pendingId) openDecision(entry.pendingId);
                }}
              >
                <span className={styles.inboxTitle}>
                  <span>
                    {entry.title}
                    {open && <span className={viewStyles.tag}> decision</span>}
                  </span>
                  <span className={styles.inboxDate}>{formatDate(entry.date)}</span>
                </span>
                <span className={styles.muted}>{entry.body}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
