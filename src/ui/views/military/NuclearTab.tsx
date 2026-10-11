import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NUCLEAR,
  nuclearDeterrence,
  nuclearStage,
  programStarted,
  RIVAL_CONTENT,
  type GameState,
  type NuclearDoctrine,
  type War,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Modal, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar, BarRow } from './parts';

const DOCTRINES: readonly NuclearDoctrine[] = ['noFirstUse', 'firstUse'];

export function NuclearTab({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const program = game.military.nuclear;
  const [strikeAt, setStrikeAt] = useState<War | null>(null);
  const started = programStarted(program);
  const stage = nuclearStage(program);
  const wars = game.military.wars.filter((w) => w.status === 'active');
  const canStrike = program.warheads > 0 && wars.length > 0;

  return (
    <div className={gameStyles.grid}>
      <Panel title={t('nuclear.program')} className={gameStyles.span8}>
        <p className={styles.note}>
          {t('nuclear.programNote', {
            research: NUCLEAR.researchMonths / 12,
            enrichment: NUCLEAR.enrichmentMonths / 12,
            months: NUCLEAR.monthsPerWarhead,
            warhead: formatCrore(NUCLEAR.warheadCost),
            monthly: formatCrore(NUCLEAR.monthlyCost),
          })}
        </p>
        <div className={styles.stack}>
          <BarRow label={t('nuclear.research')} value={`${Math.round(program.research)}%`}>
            <Bar value={program.research} tone="accent" label={t('nuclear.researchProgress')} />
          </BarRow>
          <BarRow label={t('nuclear.enrichment')} value={`${Math.round(program.enrichment)}%`}>
            <Bar value={program.enrichment} tone="accent" label={t('nuclear.enrichmentProgress')} />
          </BarRow>
          <p data-testid="nuclear-stage">
            {t('nuclear.stage')} <strong>{t(`nuclear.stages.${stage}`)}</strong> · {t('nuclear.warheads')}{' '}
            <strong data-testid="warheads">{program.warheads}</strong>
            {program.warheads > 0 && <> · {t('nuclear.bonus', { value: nuclearDeterrence(program).toFixed(0) })}</>}
          </p>
          <div className={styles.cardActions}>
            {!started ? (
              <Button
                variant="primary"
                disabled={game.nation.treasury < NUCLEAR.startCost}
                onClick={() => dispatch({ type: 'START_NUCLEAR_PROGRAM' })}
              >
                {t('nuclear.launch', { cost: formatCrore(NUCLEAR.startCost) })}
              </Button>
            ) : (
              <Button onClick={() => dispatch({ type: 'SET_NUCLEAR_PROGRAM', active: !program.active })}>
                {program.active ? t('nuclear.pause') : t('nuclear.resume')}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={t('nuclear.doctrine')} className={gameStyles.span4}>
        <div className={styles.stack} role="radiogroup" aria-label={t('nuclear.doctrineLabel')}>
          {DOCTRINES.map((d) => (
            <label key={d} className={styles.choice}>
              <input
                type="radio"
                name="doctrine"
                checked={program.doctrine === d}
                onChange={() => program.doctrine !== d && dispatch({ type: 'SET_NUCLEAR_DOCTRINE', doctrine: d })}
              />
              <span>
                <strong>{t(`nuclear.doctrines.${d}.label`)}</strong>
                <span className={styles.muted}> {t(`nuclear.doctrines.${d}.text`)}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title={t('nuclear.use')} className={gameStyles.span12}>
        <div className={styles.dangerZone}>
          <p>{t('nuclear.useNote')}</p>
          {wars.length === 0 ? (
            <p className={styles.muted}>{t('nuclear.onlyInWar')}</p>
          ) : program.warheads < 1 ? (
            <p className={styles.muted}>{t('nuclear.noWarheads')}</p>
          ) : program.doctrine === 'noFirstUse' ? (
            <p className={styles.muted}>{t('nuclear.changeDoctrine')}</p>
          ) : null}
          <div className={styles.cardActions}>
            {wars.map((war) => (
              <Button
                key={war.id}
                className={styles.dangerButton}
                disabled={!canStrike || program.doctrine === 'noFirstUse'}
                aria-label={t('nuclear.strikeAgainst', { country: RIVAL_CONTENT[war.rival].name })}
                onClick={() => setStrikeAt(war)}
              >
                {t('nuclear.strikeAgainst', { country: RIVAL_CONTENT[war.rival].name })}
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      {strikeAt && (
        <Modal title={t('nuclear.confirmTitle')} onClose={() => setStrikeAt(null)}>
          <p>{t('nuclear.confirmText', { country: RIVAL_CONTENT[strikeAt.rival].name })}</p>
          <ul className={styles.effects}>
            <li data-tone="bad">{t('nuclear.effects.sanctions')}</li>
            <li data-tone="bad">{t('nuclear.effects.approval')}</li>
            <li data-tone="bad">{t('nuclear.effects.relations')}</li>
            {game.meta.difficulty === 'hard' && <li data-tone="bad">{t('nuclear.effects.hard')}</li>}
            <li data-tone="good">{t('nuclear.effects.war')}</li>
          </ul>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => setStrikeAt(null)}>
              {t('nuclear.standDown')}
            </Button>
            <Button
              className={styles.dangerButton}
              onClick={() => {
                dispatch({ type: 'USE_NUCLEAR_WEAPON', warId: strikeAt.id });
                setStrikeAt(null);
              }}
            >
              {t('nuclear.confirmStrike')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
