import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EVENT_CATEGORIES, formatDate, pendingView, type LogCategory } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel } from '../design/primitives';
import styles from '../screens/game.module.css';
import viewStyles from './views.module.css';

type Filter = 'all' | 'unread' | 'decisions' | LogCategory;

export function InboxView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [filter, setFilter] = useState<Filter>('all');
  if (!game) return null;

  const { dispatch, openDecision } = gameStore.getState();
  const unread = game.log.filter((e) => !e.read).length;
  const waiting = game.events.pending.flatMap((p) => {
    const view = pendingView(game, p);
    return view ? [view] : [];
  });
  const filters: { id: Filter; text: string }[] = [
    { id: 'all', text: t('inbox.filters.all') },
    { id: 'unread', text: t('inbox.filters.unread', { count: unread }) },
    { id: 'decisions', text: t('inbox.filters.decisions', { count: waiting.length }) },
    ...(['general', ...EVENT_CATEGORIES] as LogCategory[]).map((c) => ({ id: c, text: t(`inbox.categories.${c}`) })),
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
          <h1 className={styles.viewTitle}>{t('nav.views.inbox')}</h1>
          <p className={styles.viewSubtitle}>{t('inbox.subtitle')}</p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" onClick={() => dispatch({ type: 'MARK_ALL_LOG_READ' })}>
            {t('inbox.markAll')}
          </Button>
        )}
      </div>

      {waiting.length > 0 && (
        <Panel title={t('inbox.waitingTitle', { count: waiting.length })}>
          <ul className={viewStyles.decisionList} aria-label={t('inbox.waitingLabel')}>
            {waiting.map((w) => (
              <li key={w.pending.id} className={viewStyles.decisionRow} data-severity={w.def.severity}>
                <div>
                  <div className={viewStyles.personName}>{w.title}</div>
                  <div className={viewStyles.muted}>{t('inbox.daysLeft', { count: w.daysLeft })}</div>
                </div>
                <Button
                  variant="primary"
                  aria-label={t('inbox.decideLabel', { title: w.title })}
                  onClick={() => openDecision(w.pending.id)}
                >
                  {t('inbox.decide')}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className={viewStyles.filters} role="group" aria-label={t('inbox.filtersLabel')}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={viewStyles.chip}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.text}
          </button>
        ))}
      </div>

      <ul className={styles.inbox} style={{ maxHeight: 'none' }} aria-label={t('inbox.messagesLabel')}>
        {entries.length === 0 && <li className={styles.muted}>{t('inbox.empty')}</li>}
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
                    {open && <span className={viewStyles.tag}> {t('inbox.decisionTag')}</span>}
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
