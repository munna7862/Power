import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reelectionApproval, electionYear } from '../../sim';
import { useGame } from '../../store';
import { Button } from '../design/primitives';
import styles from './tutorial.module.css';
import { stepDone, TUTORIAL_STEPS, type WaitingStepId } from './steps';
import { useTutorial } from './tutorialStore';

/**
 * The tutorial's coach panel: a non-modal card in the corner that explains one thing at a time and moves on
 * by itself once the player has done what it asks. The highlighted control pulses (data-tutorial).
 */
export function TutorialCoach() {
  const { t } = useTranslation();
  const active = useTutorial((s) => s.active);
  const index = useTutorial((s) => s.step);
  const next = useTutorial((s) => s.next);
  const end = useTutorial((s) => s.end);
  const game = useGame((s) => s.game);
  const view = useGame((s) => s.view);
  const speed = useGame((s) => s.speed);
  const step = TUTORIAL_STEPS[index];
  const done = !!(active && step && game && stepDone(step, { game, view, speed }));

  useEffect(() => {
    if (done) next();
  }, [done, next]);

  if (!active || !step || !game) return null;
  const values = { year: electionYear(game), approval: reelectionApproval(game), name: game.meta.presidentName };
  const last = index === TUTORIAL_STEPS.length - 1;
  const waits = step.advance.kind !== 'next';

  return (
    <aside className={styles.coach} aria-label={t('tutorial.label')} aria-live="polite" data-testid="tutorial">
      <div className={styles.progress}>{t('tutorial.progress', { step: index + 1, total: TUTORIAL_STEPS.length })}</div>
      <h2 className={styles.title}>{t(`tutorial.steps.${step.id}.title`, values)}</h2>
      <p className={styles.body}>{t(`tutorial.steps.${step.id}.body`, values)}</p>
      {waits && <p className={styles.hint}>{t(`tutorial.steps.${step.id as WaitingStepId}.hint`, values)}</p>}
      <div className={styles.actions}>
        {!last && (
          <Button variant="ghost" onClick={end}>
            {t('tutorial.skip')}
          </Button>
        )}
        {!waits && (
          <Button variant="primary" onClick={next}>
            {last ? t('tutorial.finish') : t('tutorial.next')}
          </Button>
        )}
      </div>
    </aside>
  );
}
