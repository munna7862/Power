import { Fragment } from 'react';
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
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar } from './parts';
import { daysLeft, shareDone } from './progress';

function describeStrength(view: StrengthView): string {
  switch (view.kind) {
    case 'unknown':
      return 'Unknown';
    case 'estimate':
      return view.high === 0 ? 'Annexed' : `~${view.low}–${view.high} (rough estimate)`;
    case 'sighted':
      return `${view.low}–${view.high} (recon ${view.ageDays} days old)`;
  }
}

const relationWord = (v: number) =>
  v >= 40 ? 'Friendly' : v >= 5 ? 'Cordial' : v > -20 ? 'Cool' : v > -50 ? 'Tense' : 'Hostile';

export function OpsTab({ game }: { game: GameState }) {
  const { military, clock } = game;
  const { dispatch } = gameStore.getState();
  const eff = allEfficiencies(game);
  const director = game.cabinet.ministers.intelligence;
  const counterActive = military.intelOps.find((o) => o.kind === 'counterIntel');

  return (
    <div className={gameStyles.grid}>
      <Panel title="Drills" className={gameStyles.span8}>
        <p className={styles.note}>
          Exercises cost money from the procurement fund and take time, then raise readiness, morale and deterrence. At
          most {MAX_DRILLS} at once; training accidents happen.
        </p>
        <div className={styles.opGrid}>
          {DRILL_KINDS.map((kind: DrillKind) => {
            const spec = DRILLS[kind];
            const active = military.drills.find((d) => d.kind === kind);
            const blocked = !!active || military.drills.length >= MAX_DRILLS || spec.cost > military.procurementFund;
            return (
              <div key={kind} className={styles.ministryCard}>
                <div className={styles.personName}>{spec.label}</div>
                <p className={styles.muted}>{spec.summary}</p>
                <p className={styles.note}>
                  {formatCrore(spec.cost)} · {spec.days} days · readiness +{spec.readiness}, morale +{spec.morale},
                  deterrence +{spec.deterrence}
                </p>
                {active ? (
                  <>
                    <Bar
                      value={shareDone(active.startedTick, active.endsTick, clock.tick)}
                      tone="accent"
                      label={`${spec.label} progress`}
                    />
                    <span className={styles.muted}>{daysLeft(active.endsTick, clock.tick)} days left</span>
                  </>
                ) : (
                  <div className={styles.cardActions}>
                    <Button
                      variant="primary"
                      disabled={blocked}
                      title={
                        blocked
                          ? 'Not available: an exercise is running, two are under way, or funds are short.'
                          : undefined
                      }
                      onClick={() => dispatch({ type: 'START_DRILL', kind })}
                    >
                      Start {spec.label.toLowerCase()}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Drill reports" className={gameStyles.span4}>
        {military.drillReports.length === 0 ? (
          <p className={styles.note}>No exercise has finished yet.</p>
        ) : (
          <ul className={styles.riskList} aria-label="Drill reports">
            {military.drillReports.map((r, i) => (
              <li key={`${r.kind}-${i}`} className={styles.reportCard} data-danger={r.accident}>
                <div className={styles.personName}>
                  {DRILLS[r.kind].label} {r.accident ? '(accident)' : ''}
                </div>
                <div className={styles.muted}>
                  Readiness {signed(r.readiness, 1)} · morale {signed(r.morale, 1)} · deterrence{' '}
                  {signed(r.deterrence, 1)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Rivals and intelligence" className={gameStyles.span12}>
        <p className={styles.note}>
          Rival armies are hidden until a recon operation reveals them; the picture then blurs as it ages. Success
          depends on intelligence funding ({Math.round(eff.intelligence * 100)}% efficiency), your Intelligence Director
          {director ? ` (${director.name}, competence ${Math.round(director.competence)})` : ' (post vacant)'} and the
          target’s counter-intelligence. A blown operation sours relations and causes a diplomatic incident. At most{' '}
          {MAX_INTEL_OPS} operations at once.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Country</th>
                <th>Relation</th>
                <th>Army strength</th>
                <th className={styles.num}>Hostility</th>
                <th>Operations</th>
              </tr>
            </thead>
            <tbody>
              {RIVALS.map((id: RivalId) => {
                const rival = military.rivals[id];
                const content = RIVAL_CONTENT[id];
                const running = military.intelOps.filter((o) => o.target === id);
                const busy = military.intelOps.length >= MAX_INTEL_OPS;
                return (
                  <tr key={id} data-testid={`rival-${id}`}>
                    <td>
                      <div className={styles.personName}>{content.name}</div>
                      <div className={styles.muted}>{content.summary}</div>
                    </td>
                    <td>
                      {Math.round(rival.relation)} · {relationWord(rival.relation)}
                    </td>
                    <td data-testid={`strength-${id}`}>{describeStrength(strengthView(game, id, eff.intelligence))}</td>
                    <td className={styles.num}>{Math.round(hostility(game, id))}</td>
                    <td>
                      {rival.annexed ? (
                        <span className={styles.tag}>Annexed</span>
                      ) : (
                        <div className={styles.cardActions}>
                          {(['recon', 'sabotage'] as const).map((kind) => {
                            const op = running.find((o) => o.kind === kind);
                            return op ? (
                              <span key={kind} className={styles.tag}>
                                {INTEL_OPS[kind].label}: {daysLeft(op.endsTick, clock.tick)} days
                              </span>
                            ) : (
                              <Button
                                key={kind}
                                disabled={busy}
                                aria-label={`${INTEL_OPS[kind].label} ${content.name}`}
                                title={busy ? 'All intelligence teams are busy.' : INTEL_OPS[kind].summary}
                                onClick={() => dispatch({ type: 'LAUNCH_INTEL_OP', kind, target: id })}
                              >
                                {INTEL_OPS[kind].label}
                              </Button>
                            );
                          })}
                          <Tooltip label={`Odds for ${content.name}`}>
                            <span className={gameStyles.breakdown}>
                              {(['recon', 'sabotage'] as const).map((kind) => (
                                <Fragment key={kind}>
                                  <span>
                                    {INTEL_OPS[kind].label} ({formatCrore(INTEL_OPS[kind].cost)})
                                  </span>
                                  <span className={gameStyles.breakdownValue}>
                                    {Math.round(opSuccessChance(game, kind, id) * 100)}%
                                  </span>
                                </Fragment>
                              ))}
                              <span>Their counter-intelligence</span>
                              <span className={gameStyles.breakdownValue}>{content.counterIntel}</span>
                              <span>Your Director</span>
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

      <Panel title="Counter-intelligence" className={gameStyles.span4}>
        <p className={styles.muted}>{INTEL_OPS.counterIntel.summary}</p>
        <p className={styles.note}>Current cover: {Math.round(military.counterIntel)}/100.</p>
        {counterActive ? (
          <span className={styles.tag}>Sweep running: {daysLeft(counterActive.endsTick, clock.tick)} days</span>
        ) : (
          <Button
            variant="primary"
            disabled={military.intelOps.length >= MAX_INTEL_OPS}
            onClick={() => dispatch({ type: 'LAUNCH_INTEL_OP', kind: 'counterIntel', target: null })}
          >
            Start counter-intelligence sweep · {formatCrore(INTEL_OPS.counterIntel.cost)}
          </Button>
        )}
      </Panel>

      <Panel title="Operations in progress" className={gameStyles.span8}>
        {military.intelOps.length === 0 ? (
          <p className={styles.note}>No operations under way.</p>
        ) : (
          <ul className={styles.riskList} aria-label="Intelligence operations">
            {military.intelOps.map((op) => (
              <li key={op.id} className={styles.reportCard}>
                <div className={styles.personName}>
                  {INTEL_OPS[op.kind].label}
                  {op.target ? `: ${RIVAL_CONTENT[op.target].name}` : ''}
                </div>
                <Bar
                  value={shareDone(op.startedTick, op.endsTick, clock.tick)}
                  tone="accent"
                  label={`${INTEL_OPS[op.kind].label} progress`}
                />
                <span className={styles.muted}>{daysLeft(op.endsTick, clock.tick)} days left</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
