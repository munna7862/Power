import { useTranslation } from 'react-i18next';
import { AI_ACTIONS, COUNTRY_CONTENT, FOCUS_IDS, UNAVAILABLE, type GameState } from '../../../sim';
import { Panel } from '../../design/primitives';
import { signed } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../../map/world.module.css';
import views from '../views.module.css';

/**
 * Developer overlay: for each major nation, the inputs it weighed last month and the utility of every action.
 * Shown in development builds only.
 */
export function AiDebug({ game }: { game: GameState }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('aiDebug.title')} className={gameStyles.span12}>
      <p className={views.note}>{t('aiDebug.note')}</p>
      <div data-testid="ai-debug">
        {FOCUS_IDS.map((id) => {
          const d = game.diplomacy.ai[id];
          return (
            <div key={id} className={styles.debugRow} data-testid={`ai-${id}`}>
              <div>
                <div className={views.personName}>{COUNTRY_CONTENT[id]?.name}</div>
                <div className={views.muted}>
                  {d
                    ? t(d.acted ? 'aiDebug.acted' : 'aiDebug.preferred', { action: t(`aiDebug.actions.${d.action}`) })
                    : t('aiDebug.notYet')}
                </div>
              </div>
              {d && (
                <div>
                  <div className={styles.utilities}>
                    {AI_ACTIONS.map((a) => (
                      <span key={a} className={a === d.action ? styles.chosen : undefined}>
                        {t('aiDebug.utility', {
                          action: t(`aiDebug.actions.${a}`),
                          value: d.utilities[a] <= UNAVAILABLE ? t('aiDebug.na') : signed(d.utilities[a], 2),
                        })}
                      </span>
                    ))}
                  </div>
                  <div className={views.muted}>
                    {t('aiDebug.inputs', {
                      relation: signed(d.inputs.relation, 2),
                      power: signed(d.inputs.powerRatio, 2),
                      ideology: signed(d.inputs.ideology, 2),
                      deterrence: d.inputs.deterrence.toFixed(2),
                      noise: signed(d.inputs.noise, 2),
                    })}
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
