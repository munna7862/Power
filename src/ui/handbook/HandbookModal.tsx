import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BANKRUPTCY_DEBT_RATIO,
  BANKRUPTCY_MONTHS,
  COUP_RISK_THRESHOLD,
  DIFFICULTY_RULES,
  ELECTION_SWING,
  FATIGUE_MAX_YEARS,
  IMPEACHMENT_MONTHS,
  MAX_REPEATS,
  MAX_TRADE_TREATIES,
  NO_RIOTS_UNREST_CAP,
  OFFER_DAYS,
  PACT_YEARS,
  RIOT_UNREST,
  TENSE_UNREST,
  TERM_YEARS,
} from '../../sim';
import { useGame } from '../../store';
import { Modal } from '../design/primitives';
import { SHORTCUTS } from '../shortcuts';
import { HANDBOOK } from './contents';
import styles from './handbook.module.css';

export function HandbookModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const difficulty = useGame((s) => s.game?.meta.difficulty ?? 'normal');
  const [query, setQuery] = useState('');
  const rules = DIFFICULTY_RULES[difficulty];

  const values = useMemo(
    () => ({
      termYears: TERM_YEARS,
      reelection: rules.reelectionApproval,
      swing: ELECTION_SWING,
      fatigue: rules.voterFatigue,
      fatigueYears: FATIGUE_MAX_YEARS,
      fatigueMax: rules.voterFatigue * FATIGUE_MAX_YEARS,
      impeachment: rules.impeachmentThreshold,
      impeachmentMonths: IMPEACHMENT_MONTHS,
      bankruptcy: Math.round(BANKRUPTCY_DEBT_RATIO * 100),
      bankruptcyMonths: BANKRUPTCY_MONTHS,
      coup: COUP_RISK_THRESHOLD,
      riot: RIOT_UNREST,
      tense: TENSE_UNREST,
      riotCap: NO_RIOTS_UNREST_CAP,
      repeats: MAX_REPEATS,
      maxTrade: MAX_TRADE_TREATIES,
      offerDays: OFFER_DAYS,
      pactYears: PACT_YEARS,
      difficulty: t(`difficulty.${difficulty}.title`),
    }),
    [rules, difficulty, t],
  );

  const needle = query.trim().toLowerCase();
  const sections = HANDBOOK.map((section) => ({
    id: section.id,
    entries: section.entries
      .map((id) => ({
        id,
        title: t(`handbook.entries.${id}.title`, values),
        body: t(`handbook.entries.${id}.body`, values),
      }))
      .filter((e) => !needle || `${e.title} ${e.body}`.toLowerCase().includes(needle)),
  })).filter((s) => s.entries.length > 0);

  return (
    <Modal title={t('handbook.title')} onClose={onClose}>
      <p className={styles.intro}>{t('handbook.intro', values)}</p>
      <input
        type="search"
        className={styles.search}
        value={query}
        placeholder={t('handbook.search')}
        aria-label={t('handbook.search')}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.body} data-testid="handbook">
        {sections.length === 0 && <p className={styles.empty}>{t('handbook.noMatch')}</p>}
        {sections.map((section) => (
          <section key={section.id} className={styles.section} aria-label={t(`handbook.sections.${section.id}`)}>
            <h3 className={styles.sectionTitle}>{t(`handbook.sections.${section.id}`)}</h3>
            {section.entries.map((entry) => (
              <article key={entry.id} className={styles.entry}>
                <h4 className={styles.entryTitle}>{entry.title}</h4>
                <p className={styles.entryBody}>{entry.body}</p>
                {entry.id === 'shortcuts' && (
                  <dl className={styles.keys}>
                    {SHORTCUTS.map((sc) => (
                      <div key={sc.id} className={styles.keyRow}>
                        <dt>
                          {sc.keys.map((k, i) => (k === '–' ? <span key={i}> – </span> : <kbd key={i}>{k}</kbd>))}
                        </dt>
                        <dd>{t(`shortcuts.${sc.id}`)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
