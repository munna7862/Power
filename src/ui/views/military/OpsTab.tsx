import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allEfficiencies,
  directorCompetence,
  DRILL_KINDS,
  DRILLS,
  hostility,
  INTEL_OPS,
  MAX_DRILLS,
  MAX_INTEL_OPS,
  opSuccessChance,
  relationLevel,
  relationOf,
  RIVAL_CONTENT,
  RIVALS,
  strengthView,
  type DrillKind,
  type GameState,
  type RivalId,
  type StrengthView,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel, Tooltip } from '../../design/primitives';
import { formatCrore, signed } from '../../format';
import { t as translate } from '../../i18n';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar } from './parts';
import { daysLeft, shareDone } from './progress';

function describeStrength(view: StrengthView): string {
  switch (view.kind) {
    case 'unknown':
      return translate('ops.strength.unknown');
    case 'estimate':
      return view.high === 0
        ? translate('ops.strength.annexed')
        : translate('ops.strength.estimate', { low: view.low, high: view.high });
    case 'sighted':
      return translate('country.strength.sighted', { low: view.low, high: view.high, count: view.ageDays });
  }
}

export function OpsTab({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { military, clock } = game;
  const { dispatch } = gameStore.getState();
  const eff = allEfficiencies(game);
  const counterActive = military.intelOps.find((o) => o.kind === 'counterIntel');

  return (
    <div className={gameStyles.grid}>
      <Panel title={t('ops.drills')} className={gameStyles.span8}>
        <p className={styles.note}>{t('ops.drillsNote', { max: MAX_DRILLS })}</p>
        <div className={styles.opGrid}>
          {DRILL_KINDS.map((kind: DrillKind) => {
            const spec = DRILLS[kind];
            const active = military.drills.find((d) => d.kind === kind);
            const blocked = !!active || military.drills.length >= MAX_DRILLS || spec.cost > game.nation.treasury;
            const name = t(`ops.drillKinds.${kind}.label`);
            return (
              <div key={kind} className={styles.ministryCard}>
                <div className={styles.personName}>{name}</div>
                <p className={styles.muted}>{t(`ops.drillKinds.${kind}.summary`)}</p>
                <p className={styles.note}>
                  {t('ops.drillTerms', {
                    cost: formatCrore(spec.cost),
                    days: spec.days,
                    readiness: spec.readiness,
                    morale: spec.morale,
                    deterrence: spec.deterrence,
                  })}
                </p>
                {active ? (
                  <>
                    <Bar
                      value={shareDone(active.startedTick, active.endsTick, clock.tick)}
                      tone="accent"
                      label={t('ops.progress', { name })}
                    />
                    <span className={styles.muted}>
                      {t('inbox.daysLeft', { count: daysLeft(active.endsTick, clock.tick) })}
                    </span>
                  </>
                ) : (
                  <div className={styles.cardActions}>
                    <Button
                      variant="primary"
                      disabled={blocked}
                      title={blocked ? t('ops.drillBlocked') : undefined}
                      onClick={() => dispatch({ type: 'START_DRILL', kind })}
                    >
                      {t(`ops.drillKinds.${kind}.start`)}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={t('ops.reports')} className={gameStyles.span4}>
        {military.drillReports.length === 0 ? (
          <p className={styles.note}>{t('ops.noReports')}</p>
        ) : (
          <ul className={styles.riskList} aria-label={t('ops.reports')}>
            {military.drillReports.map((r, i) => (
              <li key={`${r.kind}-${i}`} className={styles.reportCard} data-danger={r.accident}>
                <div className={styles.personName}>
                  {t(`ops.drillKinds.${r.kind}.label`)} {r.accident ? t('ops.accident') : ''}
                </div>
                <div className={styles.muted}>
                  {t('ops.reportLine', {
                    readiness: signed(r.readiness, 1),
                    morale: signed(r.morale, 1),
                    deterrence: signed(r.deterrence, 1),
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t('ops.rivals')} className={gameStyles.span12}>
        <p className={styles.note}>
          {t('ops.rivalsNote', {
            efficiency: Math.round(eff.intelligence * 100),
            director: t('ops.director', { skill: Math.round(directorCompetence(game)) }),
            max: MAX_INTEL_OPS,
          })}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('diplomacy.columns.country')}</th>
                <th>{t('diplomacy.columns.relation')}</th>
                <th>{t('ops.armyStrength')}</th>
                <th className={styles.num}>{t('ops.hostility')}</th>
                <th>{t('ops.operations')}</th>
              </tr>
            </thead>
            <tbody>
              {RIVALS.map((id: RivalId) => {
                const rival = military.rivals[id];
                const content = RIVAL_CONTENT[id];
                const running = military.intelOps.filter((o) => o.target === id);
                const busy = military.intelOps.length >= MAX_INTEL_OPS;
                const relation = relationOf(game, id);
                return (
                  <tr key={id} data-testid={`rival-${id}`}>
                    <td>
                      <div className={styles.personName}>{content.name}</div>
                      <div className={styles.muted}>{content.summary}</div>
                    </td>
                    <td>
                      {Math.round(relation)} · {t(`world.relationLevels.${relationLevel(relation)}`)}
                    </td>
                    <td data-testid={`strength-${id}`}>{describeStrength(strengthView(game, id, eff.intelligence))}</td>
                    <td className={styles.num}>{Math.round(hostility(game, id))}</td>
                    <td>
                      {rival.annexed ? (
                        <span className={styles.tag}>{t('ops.strength.annexed')}</span>
                      ) : (
                        <div className={styles.cardActions}>
                          {(['recon', 'sabotage'] as const).map((kind) => {
                            const op = running.find((o) => o.kind === kind);
                            const opName = t(`ops.intel.${kind}.label`);
                            return op ? (
                              <span key={kind} className={styles.tag}>
                                {t('ops.running', { name: opName, count: daysLeft(op.endsTick, clock.tick) })}
                              </span>
                            ) : (
                              <Button
                                key={kind}
                                disabled={busy}
                                aria-label={t('ops.opLabel', { op: opName, country: content.name })}
                                title={busy ? t('ops.busy') : t(`ops.intel.${kind}.summary`)}
                                onClick={() => dispatch({ type: 'LAUNCH_INTEL_OP', kind, target: id })}
                              >
                                {opName}
                              </Button>
                            );
                          })}
                          <Tooltip label={t('ops.oddsFor', { country: content.name })}>
                            <span className={gameStyles.breakdown}>
                              {(['recon', 'sabotage'] as const).map((kind) => (
                                <Fragment key={kind}>
                                  <span>
                                    {t('ops.opCost', {
                                      op: t(`ops.intel.${kind}.label`),
                                      cost: formatCrore(INTEL_OPS[kind].cost),
                                    })}
                                  </span>
                                  <span className={gameStyles.breakdownValue}>
                                    {Math.round(opSuccessChance(game, kind, id) * 100)}%
                                  </span>
                                </Fragment>
                              ))}
                              <span>{t('ops.theirCounter')}</span>
                              <span className={gameStyles.breakdownValue}>{content.counterIntel}</span>
                              <span>{t('ops.yourDirector')}</span>
                              <span className={gameStyles.breakdownValue}>{Math.round(directorCompetence(game))}</span>
                            </span>
                          </Tooltip>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t('ops.intel.counterIntel.label')} className={gameStyles.span4}>
        <p className={styles.muted}>{t('ops.intel.counterIntel.summary')}</p>
        <p className={styles.note}>{t('ops.cover', { value: Math.round(military.counterIntel) })}</p>
        {counterActive ? (
          <span className={styles.tag}>
            {t('ops.sweepRunning', { count: daysLeft(counterActive.endsTick, clock.tick) })}
          </span>
        ) : (
          <Button
            variant="primary"
            disabled={military.intelOps.length >= MAX_INTEL_OPS}
            onClick={() => dispatch({ type: 'LAUNCH_INTEL_OP', kind: 'counterIntel', target: null })}
          >
            {t('ops.startSweep', { cost: formatCrore(INTEL_OPS.counterIntel.cost) })}
          </Button>
        )}
      </Panel>

      <Panel title={t('ops.inProgress')} className={gameStyles.span8}>
        {military.intelOps.length === 0 ? (
          <p className={styles.note}>{t('ops.noOps')}</p>
        ) : (
          <ul className={styles.riskList} aria-label={t('ops.intelLabel')}>
            {military.intelOps.map((op) => {
              const opName = t(`ops.intel.${op.kind}.label`);
              return (
                <li key={op.id} className={styles.reportCard}>
                  <div className={styles.personName}>
                    {op.target ? t('ops.opTarget', { op: opName, country: RIVAL_CONTENT[op.target].name }) : opName}
                  </div>
                  <Bar
                    value={shareDone(op.startedTick, op.endsTick, clock.tick)}
                    tone="accent"
                    label={t('ops.progress', { name: opName })}
                  />
                  <span className={styles.muted}>
                    {t('inbox.daysLeft', { count: daysLeft(op.endsTick, clock.tick) })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
