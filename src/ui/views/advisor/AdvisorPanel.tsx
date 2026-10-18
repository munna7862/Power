import { useTranslation } from 'react-i18next';
import { advise, type GameState } from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel } from '../../design/primitives';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { adviceText, adviceView } from './topics';

const SHOWN = 4;

/** The advisor's most urgent warnings, each with a button to the screen that fixes it. */
export function AdvisorPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { setView } = gameStore.getState();
  const advice = advise(game).slice(0, SHOWN);
  return (
    <Panel title={t('advisor.title')} className={gameStyles.span12}>
      {advice.length === 0 ? (
        <p className={styles.note}>{t('advisor.quiet')}</p>
      ) : (
        <ul className={styles.riskList} aria-label={t('advisor.title')}>
          {advice.map((a, i) => {
            const text = adviceText(a);
            const view = adviceView(a);
            const screen = t(`nav.views.${view}`);
            return (
              <li key={`${a.topic}-${i}`} className={styles.reportCard} data-testid="advice" data-topic={a.topic}>
                <div className={styles.adviceRow}>
                  <span>{text}</span>
                  <Button
                    variant="ghost"
                    aria-label={t('advisor.openLabel', { screen, advice: text })}
                    onClick={() => setView(view)}
                  >
                    {t('advisor.open', { screen })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
