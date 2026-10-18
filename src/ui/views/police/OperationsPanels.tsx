import { useTranslation } from 'react-i18next';
import {
  allEfficiencies,
  INVESTIGATION_COST,
  INVESTIGATION_DAYS,
  MAX_INVESTIGATIONS,
  MINISTRIES,
  MINISTRY_CONTENT,
  OPERATION_KINDS,
  OPERATIONS,
  operationBlocked,
  validateInvestigation,
  type GameState,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import { placeName } from '../place';
import styles from '../views.module.css';

const daysUntil = (game: GameState, tick: number) => Math.max(0, tick - game.clock.tick);

/** Live plots and the three counter-terror operations. */
export function OperationsPanel({ game, className }: { game: GameState; className?: string | undefined }) {
  const { t } = useTranslation();
  const { security } = game;
  const { dispatch } = gameStore.getState();
  return (
    <Panel title={t('security.operations')} className={className}>
      {security.plots.length > 0 && (
        <ul className={styles.riskList} aria-label={t('security.plotsLabel')}>
          {security.plots.map((p) => (
            <li key={p.id} className={styles.riskRow} data-danger="true">
              <span className={styles.personName}>{p.group}</span>
              <span>{placeName(game.meta.options.regions ? p.region : null)}</span>
              <span className={styles.muted}>{t('security.strikesIn', { count: daysUntil(game, p.strikeTick) })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.opGrid}>
        {OPERATION_KINDS.map((kind) => {
          const spec = OPERATIONS[kind];
          const active = security.operations.find((o) => o.kind === kind);
          const blocked = operationBlocked(game, kind);
          return (
            <div key={kind} className={styles.ministryCard}>
              <div className={styles.personName}>{t(`security.ops.${kind}.label`)}</div>
              <p className={styles.muted}>{t(`security.ops.${kind}.summary`)}</p>
              <p className={styles.note}>{t('decision.costs', { cost: formatCrore(spec.cost) })}</p>
              <div className={styles.cardActions}>
                {active ? (
                  <span className={styles.tag}>
                    {t(kind === 'raid' ? 'security.recovering' : 'security.active', {
                      count: daysUntil(game, active.endsTick),
                    })}
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    disabled={blocked !== null}
                    title={blocked ?? undefined}
                    onClick={() => dispatch({ type: 'LAUNCH_OPERATION', kind })}
                  >
                    {t(`security.ops.${kind}.label`)}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** Anti-corruption audits of each department. */
export function AuditsPanel({ game, className }: { game: GameState; className?: string | undefined }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const eff = allEfficiencies(game);
  return (
    <Panel title={t('security.inquiries')} className={className}>
      <p className={styles.note}>
        {t('security.inquiriesNote', {
          corruption: game.economy.corruption.toFixed(1),
          cost: formatCrore(INVESTIGATION_COST),
          days: INVESTIGATION_DAYS,
          max: MAX_INVESTIGATIONS,
        })}
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('security.ministry')}</th>
              <th className={styles.num}>{t('security.efficiency')}</th>
              <th>{t('security.inquiry')}</th>
            </tr>
          </thead>
          <tbody>
            {MINISTRIES.map((ministry) => {
              const inquiry = game.security.investigations.find((i) => i.department === ministry);
              const blocked = validateInvestigation(game, ministry);
              return (
                <tr key={ministry}>
                  <td>{MINISTRY_CONTENT[ministry].shortName}</td>
                  <td className={styles.num}>{Math.round(eff[ministry] * 100)}%</td>
                  <td>
                    {inquiry ? (
                      <span className={styles.tag}>
                        {t('security.reportsIn', { count: daysUntil(game, inquiry.resolvesTick) })}
                      </span>
                    ) : (
                      <Button
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                        aria-label={t('security.investigateName', { ministry: MINISTRY_CONTENT[ministry].shortName })}
                        onClick={() => dispatch({ type: 'LAUNCH_INVESTIGATION', department: ministry })}
                      >
                        {t('security.investigate')}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
