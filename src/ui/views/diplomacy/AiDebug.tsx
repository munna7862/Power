import { AI_ACTIONS, COUNTRY_CONTENT, FOCUS_IDS, UNAVAILABLE, type AiAction, type GameState } from '../../../sim';
import { Panel } from '../../design/primitives';
import { signed } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../../map/world.module.css';
import views from '../views.module.css';

const ACTION_LABELS: Record<AiAction, string> = {
  offerDeal: 'Offer a deal',
  seekPact: 'Seek a pact',
  threaten: 'Threaten',
  sanction: 'Sanction India',
  declareWar: 'Declare war',
  idle: 'Do nothing',
};

/**
 * Developer overlay: for each major nation, the inputs it weighed last month and the utility of every action.
 * Shown in development builds only.
 */
export function AiDebug({ game }: { game: GameState }) {
  return (
    <Panel title="AI debug: why each nation chose its action" className={gameStyles.span12}>
      <p className={views.note}>
        Utility = weighted relation, power ratio, ideology match and India’s deterrence, plus noise. The highest utility
        wins; a nation acts in only some months, and a rival’s war also needs the declaration roll.
      </p>
      <div data-testid="ai-debug">
        {FOCUS_IDS.map((id) => {
          const d = game.diplomacy.ai[id];
          return (
            <div key={id} className={styles.debugRow} data-testid={`ai-${id}`}>
              <div>
                <div className={views.personName}>{COUNTRY_CONTENT[id]?.name}</div>
                <div className={views.muted}>
                  {d
                    ? d.acted
                      ? `Acted: ${ACTION_LABELS[d.action]}`
                      : `Preferred: ${ACTION_LABELS[d.action]}`
                    : 'Not evaluated yet'}
                </div>
              </div>
              {d && (
                <div>
                  <div className={styles.utilities}>
                    {AI_ACTIONS.map((a) => (
                      <span key={a} className={a === d.action ? styles.chosen : undefined}>
                        {ACTION_LABELS[a]}: {d.utilities[a] <= UNAVAILABLE ? 'n/a' : signed(d.utilities[a], 2)}
                      </span>
                    ))}
                  </div>
                  <div className={views.muted}>
                    relation {signed(d.inputs.relation, 2)} · power ratio {signed(d.inputs.powerRatio, 2)} · ideology{' '}
                    {signed(d.inputs.ideology, 2)} · deterrence {d.inputs.deterrence.toFixed(2)} · noise{' '}
                    {signed(d.inputs.noise, 2)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
