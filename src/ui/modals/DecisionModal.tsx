import { pendingView } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { formatCrore } from '../format';
import styles from '../views/views.module.css';

/** A decision waiting in the inbox: the situation, then each choice with exactly what it will do. */
export function DecisionModal() {
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
        {view.daysLeft > 0
          ? `Decide within ${view.daysLeft} day${view.daysLeft === 1 ? '' : 's'}, or the default choice is applied and voters see you as indecisive.`
          : 'This decision expires today.'}
      </p>
      <div className={styles.choices}>
        {view.choices.map(({ choice, lines }) => (
          <div key={choice.id} className={styles.choice}>
            <div>
              <div className={styles.personName}>
                {choice.label}
                {choice.default && <span className={styles.tag}> default</span>}
              </div>
              <div className={styles.muted}>{choice.description}</div>
              <ul className={styles.effects} aria-label={`Effects of ${choice.label}`}>
                {choice.cost > 0 && <li data-tone="bad">Costs {formatCrore(choice.cost)}</li>}
                {lines.map((l, i) => (
                  <li key={i} data-tone={l.tone}>
                    {l.text}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              variant={choice.default ? 'secondary' : 'primary'}
              aria-label={`Choose: ${choice.label}`}
              onClick={() => choose(choice.id)}
            >
              Choose
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
