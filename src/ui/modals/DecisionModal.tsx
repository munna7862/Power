import { useTranslation } from 'react-i18next';
import { pendingView } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { formatCrore } from '../format';
import styles from '../views/views.module.css';

/** A decision waiting in the inbox: the situation, then each choice with exactly what it will do. */
export function DecisionModal() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const decisionId = useGame((s) => s.decisionId);
  const close = () => gameStore.getState().openDecision(null);
  const pending = game?.events.pending.find((p) => p.id === decisionId);
  const view = game && pending ? pendingView(game, pending) : null;
  if (!game || !view) return null;

  const choose = (choiceId: string) => {
    if (gameStore.getState().dispatch({ type: 'RESOLVE_EVENT', pendingId: view.pending.id, choiceId })) close();
  };

  return (
    <Modal title={view.title} onClose={close}>
      <p>{view.body}</p>
      <p className={styles.note}>
        {view.daysLeft > 0 ? t('decision.deadline', { count: view.daysLeft }) : t('decision.expiresToday')}
      </p>
      <div className={styles.choices}>
        {view.choices.map(({ choice, lines }) => (
          <div key={choice.id} className={styles.choice}>
            <div>
              <div className={styles.personName}>
                {choice.label}
                {choice.default && <span className={styles.tag}> {t('decision.default')}</span>}
              </div>
              <div className={styles.muted}>{choice.description}</div>
              <ul className={styles.effects} aria-label={t('decision.effectsOf', { choice: choice.label })}>
                {choice.cost > 0 && <li data-tone="bad">{t('decision.costs', { cost: formatCrore(choice.cost) })}</li>}
                {lines.map((l, i) => (
                  <li key={i} data-tone={l.tone}>
                    {l.text}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              variant={choice.default ? 'secondary' : 'primary'}
              aria-label={t('decision.chooseLabel', { choice: choice.label })}
              onClick={() => choose(choice.id)}
            >
              {t('decision.choose')}
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
