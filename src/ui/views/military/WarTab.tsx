import { useState } from 'react';
import {
  atWarWith,
  frontOdds,
  groupIndian,
  MAX_WARS,
  militaryStrength,
  reparationsFor,
  RIVAL_CONTENT,
  RIVALS,
  WAR,
  warScore,
  allEfficiencies,
  strengthView,
  type GameState,
  type RivalId,
  type War,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Modal, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar, BarRow, CentreBar } from './parts';
import { daysLeft } from './progress';

const TERRAIN_LABELS = { plains: 'Plains', desert: 'Desert', jungle: 'Jungle', mountains: 'Mountains', coast: 'Coast' };

function odds(mine: number, enemy: number): string {
  if (enemy <= 0) return 'Undefended';
  const ratio = mine / enemy;
  return ratio >= 1.5 ? 'Odds favour India' : ratio >= 0.85 ? 'Evenly matched' : 'Odds against India';
}

function WarCard({ game, war }: { game: GameState; war: War }) {
  const { dispatch } = gameStore.getState();
  const content = RIVAL_CONTENT[war.rival];
  const score = warScore(war);
  const fronts = frontOdds(game, war);
  const rival = game.military.rivals[war.rival];
  const left = rival.strength / war.enemyStartStrength;

  return (
    <article className={styles.warCard} data-status={war.status} aria-label={`War with ${content.name}`}>
      <div className={styles.warTitle}>
        <span>
          War with {content.name}{' '}
          <span className={styles.muted}>
            ({war.declaredBy === 'india' ? 'declared by India' : 'they attacked'} · day{' '}
            {game.clock.tick - war.startedTick})
          </span>
        </span>
        <span className={styles.tag}>
          {war.status === 'terms'
            ? 'Enemy capitulated'
            : score > 15
              ? 'India advancing'
              : score < -15
                ? 'India falling back'
                : 'Stalemate'}
        </span>
      </div>

      <BarRow label="War score" value={`${score > 0 ? '+' : ''}${score.toFixed(0)}`}>
        <CentreBar value={score} label={`War score against ${content.name}`} />
      </BarRow>

      <div className={styles.stack} role="list" aria-label="Fronts">
        {fronts.map((f) => (
          <div key={f.name} className={styles.frontRow} role="listitem">
            <span>
              <div className={styles.personName}>{f.name}</div>
              <div className={styles.muted}>{TERRAIN_LABELS[f.terrain]}</div>
            </span>
            <CentreBar value={f.progress} label={`${f.name} progress`} />
            <span className={styles.muted}>{odds(f.mine, f.enemy)}</span>
          </div>
        ))}
      </div>

      <BarRow label="War weariness" value={`${Math.round(war.weariness)}%`}>
        <Bar
          value={war.weariness}
          tone={war.weariness > 60 ? 'danger' : war.weariness > 30 ? 'warning' : 'good'}
          label="War weariness"
        />
      </BarRow>
      <BarRow label="Enemy army left" value={`${Math.round(left * 100)}%`}>
        <Bar value={left * 100} tone="danger" label="Share of the enemy army left" />
      </BarRow>

      <p className={styles.note}>
        Casualties so far: India {groupIndian(war.casualties.india)}, enemy {groupIndian(war.casualties.enemy)}.
        Equipment lost: {groupIndian(war.equipmentLost)} units. War costs about{' '}
        {formatCrore(Math.round(WAR.costPerStrength * militaryStrength(game.military)))} a day and weighs on approval
        and growth.
      </p>
      {war.report && (
        <p className={styles.reportCard} aria-label="Daily report">
          <strong>Daily report:</strong> {war.report.text}
        </p>
      )}

      {war.status === 'terms' ? (
        <div className={styles.stack}>
          <strong>
            {content.name} has capitulated. Choose the terms of peace (
            {daysLeft(war.termsDeadlineTick ?? 0, game.clock.tick)} days left; reparations apply by default).
          </strong>
          <div className={styles.cardActions}>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'reparations' })}
            >
              Reparations · {formatCrore(reparationsFor(game, war.rival))}
            </Button>
            <Button onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'annex' })}>
              Annex {content.name}
            </Button>
            <Button onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'whitePeace' })}>
              Magnanimous peace
            </Button>
          </div>
          <p className={styles.note}>
            Annexation adds {(content.gdpShare * 100).toFixed(1)}% to GDP and{' '}
            {(content.populationShare * 100).toFixed(1)}% to the population, but raises unrest in the {content.region}{' '}
            and brings three years of sanctions.
          </p>
        </div>
      ) : (
        <div className={styles.cardActions}>
          {war.ceasefireOffered && (
            <Button variant="primary" onClick={() => dispatch({ type: 'ACCEPT_CEASEFIRE', warId: war.id })}>
              Accept ceasefire
            </Button>
          )}
          <Button onClick={() => dispatch({ type: 'SUE_FOR_PEACE', warId: war.id })}>
            Sue for peace with {content.name}
          </Button>
        </div>
      )}
    </article>
  );
}

export function WarTab({ game }: { game: GameState }) {
  const { military } = game;
  const { dispatch } = gameStore.getState();
  const [confirm, setConfirm] = useState<RivalId | null>(null);
  const eff = allEfficiencies(game);
  const mine = militaryStrength(military);

  const cannotDeclare = (id: RivalId): string | null => {
    if (military.rivals[id].annexed) return 'Annexed';
    if (atWarWith(game, id)) return 'Already at war';
    if (military.wars.length >= MAX_WARS) return `At most ${MAX_WARS} wars`;
    if (game.nation.treasury < WAR.mobilisation) return 'Cannot afford mobilisation';
    return null;
  };

  return (
    <div className={gameStyles.grid}>
      <div className={`${gameStyles.span12} ${styles.stack}`}>
        {military.wars.length === 0 ? (
          <Panel title="At peace">
            <p className={styles.note}>
              India is not at war. A rival may attack if your deterrence is weak; you can also declare war yourself, but
              voters dislike wars of choice.
            </p>
          </Panel>
        ) : (
          military.wars.map((war) => <WarCard key={war.id} game={game} war={war} />)
        )}
      </div>

      <Panel title="Declare war" className={gameStyles.span8}>
        <p className={styles.note}>
          Declaring war costs {formatCrore(WAR.mobilisation)} to mobilise, hurts approval for four months and sours
          relations with every other country. Fighting costs money and lives every day.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Country</th>
                <th>Their army</th>
                <th className={styles.num}>Fronts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {RIVALS.map((id) => {
                const content = RIVAL_CONTENT[id];
                const block = cannotDeclare(id);
                const view = strengthView(game, id, eff.intelligence);
                return (
                  <tr key={id}>
                    <td>{content.name}</td>
                    <td className={styles.muted}>
                      {view.kind === 'unknown'
                        ? 'Unknown: run recon'
                        : view.kind === 'estimate'
                          ? `~${view.low}–${view.high} (rough)`
                          : `${view.low}–${view.high}`}{' '}
                      vs India {Math.round(mine)}
                    </td>
                    <td className={styles.num}>{content.fronts.length}</td>
                    <td>
                      <Button
                        disabled={block !== null}
                        title={block ?? undefined}
                        aria-label={`Declare war on ${content.name}`}
                        onClick={() => setConfirm(id)}
                      >
                        Declare war
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Past wars" className={gameStyles.span4}>
        {military.warHistory.length === 0 ? (
          <p className={styles.note}>No wars fought yet.</p>
        ) : (
          <ul className={styles.riskList} aria-label="Past wars">
            {military.warHistory.map((w, i) => (
              <li key={`${w.rival}-${w.startedTick}-${i}`} className={styles.reportCard}>
                <div className={styles.personName}>
                  {RIVAL_CONTENT[w.rival].name}: {w.outcome}
                </div>
                <div className={styles.muted}>{w.settlement}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {confirm && (
        <Modal title={`Declare war on ${RIVAL_CONTENT[confirm].name}?`} onClose={() => setConfirm(null)}>
          <p>{RIVAL_CONTENT[confirm].summary}</p>
          <ul className={styles.effects}>
            <li data-tone="bad">Mobilisation costs {formatCrore(WAR.mobilisation)}</li>
            <li data-tone="bad">Approval −5 for four months, plus war weariness as the fighting drags on</li>
            <li data-tone="bad">Relations with every other country fall</li>
            <li data-tone="neutral">
              India’s strength {Math.round(mine)} against their{' '}
              {(() => {
                const v = strengthView(game, confirm, eff.intelligence);
                return v.kind === 'unknown' ? 'unknown army (run recon first)' : `${v.low}–${v.high}`;
              })()}
            </li>
          </ul>
          <div className={styles.actions}>
            <Button onClick={() => setConfirm(null)}>Not now</Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'DECLARE_WAR', rival: confirm });
                setConfirm(null);
              }}
            >
              Declare war
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
