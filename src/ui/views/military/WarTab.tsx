import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  enemyFrontPower,
  strengthView,
  type GameState,
  type RivalId,
  type StrengthView,
  type War,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Modal, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import { t as translate } from '../../i18n';
import gameStyles from '../../screens/game.module.css';
import { placePhrase } from '../place';
import styles from '../views.module.css';
import { Bar, BarRow, CentreBar } from './parts';
import { daysLeft } from './progress';

function odds(mine: number, enemy: number | null): string {
  if (enemy === null) return translate('war.odds.unknown');
  if (enemy <= 0) return translate('war.odds.undefended');
  const ratio = mine / enemy;
  return translate(ratio >= 1.5 ? 'war.odds.favour' : ratio >= 0.85 ? 'war.odds.even' : 'war.odds.against');
}

function armyText(view: StrengthView): string {
  return view.kind === 'unknown'
    ? translate('war.army.unknown')
    : view.kind === 'estimate'
      ? translate('war.army.rough', { low: view.low, high: view.high })
      : translate('war.army.range', { low: view.low, high: view.high });
}

function WarCard({ game, war }: { game: GameState; war: War }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const content = RIVAL_CONTENT[war.rival];
  const score = warScore(war);
  const fronts = frontOdds(game, war);
  // Fog of war: the enemy is judged only by what intelligence can see (strengthView), never its true strength.
  const view = strengthView(game, war.rival, allEfficiencies(game).intelligence);
  const sighted = game.military.rivals[war.rival].sighting;
  const estimate =
    view.kind === 'unknown'
      ? null
      : { strength: (view.low + view.high) / 2, readiness: sighted?.readiness ?? 70, annexed: false };
  const enemyOn = (index: number): number | null => {
    const front = content.fronts[war.fronts[index]?.index ?? -1];
    return estimate && front ? enemyFrontPower(estimate, front) : null;
  };
  const trend =
    war.status === 'terms' ? 'capitulated' : score > 15 ? 'advancing' : score < -15 ? 'fallingBack' : 'stalemate';

  return (
    <article className={styles.warCard} data-status={war.status} aria-label={t('war.with', { country: content.name })}>
      <div className={styles.warTitle}>
        <span>
          {t('war.with', { country: content.name })}{' '}
          <span className={styles.muted}>
            {t('war.started', {
              by: t(war.declaredBy === 'india' ? 'war.byIndia' : 'war.byThem'),
              day: game.clock.tick - war.startedTick,
            })}
          </span>
        </span>
        <span className={styles.tag}>{t(`war.trend.${trend}`)}</span>
      </div>

      <BarRow label={t('war.score')} value={`${score > 0 ? '+' : ''}${score.toFixed(0)}`}>
        <CentreBar value={score} label={t('war.scoreAgainst', { country: content.name })} />
      </BarRow>

      <div className={styles.stack} role="list" aria-label={t('war.fronts')}>
        {fronts.map((f, i) => (
          <div key={f.name} className={styles.frontRow} role="listitem">
            <span>
              <div className={styles.personName}>{f.name}</div>
              <div className={styles.muted}>{t(`war.terrain.${f.terrain}`)}</div>
            </span>
            <CentreBar value={f.progress} label={t('war.frontProgress', { front: f.name })} />
            <span className={styles.muted}>{odds(f.mine, enemyOn(i))}</span>
          </div>
        ))}
      </div>

      <BarRow label={t('war.weariness')} value={`${Math.round(war.weariness)}%`}>
        <Bar
          value={war.weariness}
          tone={war.weariness > 60 ? 'danger' : war.weariness > 30 ? 'warning' : 'good'}
          label={t('war.weariness')}
        />
      </BarRow>
      <p className={styles.note}>{t('war.enemyArmy', { army: armyText(view) })}</p>

      <p className={styles.note}>
        {t('war.losses', {
          india: groupIndian(war.casualties.india),
          enemy: groupIndian(war.casualties.enemy),
          equipment: groupIndian(war.equipmentLost),
          cost: formatCrore(Math.round(WAR.costPerStrength * militaryStrength(game.military))),
        })}
      </p>
      {war.report && (
        <p className={styles.reportCard} aria-label={t('war.dailyReport')}>
          <strong>{t('war.dailyReportHeading')}</strong> {war.report.text}
        </p>
      )}

      {war.status === 'terms' ? (
        <div className={styles.stack}>
          <strong>
            {t('war.capitulated', {
              country: content.name,
              count: daysLeft(war.termsDeadlineTick ?? 0, game.clock.tick),
            })}
          </strong>
          <div className={styles.cardActions}>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'reparations' })}
            >
              {t('war.reparations', { value: formatCrore(reparationsFor(game, war.rival)) })}
            </Button>
            <Button onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'annex' })}>
              {t('war.annex', { country: content.name })}
            </Button>
            <Button onClick={() => dispatch({ type: 'SETTLE_WAR', warId: war.id, terms: 'whitePeace' })}>
              {t('war.whitePeace')}
            </Button>
          </div>
          <p className={styles.note}>
            {t('war.annexNote', {
              gdp: (content.gdpShare * 100).toFixed(1),
              population: (content.populationShare * 100).toFixed(1),
              region: placePhrase(game.meta.options.regions ? content.region : null),
            })}
          </p>
        </div>
      ) : (
        <div className={styles.cardActions}>
          {war.ceasefireOffered && (
            <Button variant="primary" onClick={() => dispatch({ type: 'ACCEPT_CEASEFIRE', warId: war.id })}>
              {t('war.ceasefire')}
            </Button>
          )}
          <Button onClick={() => dispatch({ type: 'SUE_FOR_PEACE', warId: war.id })}>
            {t('war.suePeace', { country: content.name })}
          </Button>
        </div>
      )}
    </article>
  );
}

export function WarTab({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { military } = game;
  const { dispatch } = gameStore.getState();
  const [confirm, setConfirm] = useState<RivalId | null>(null);
  const eff = allEfficiencies(game);
  const mine = militaryStrength(military);
  const noWars = game.meta.options.noWars;

  const cannotDeclare = (id: RivalId): string | null => {
    if (noWars) return t('war.block.noWars');
    if (military.rivals[id].annexed) return t('war.block.annexed');
    if (atWarWith(game, id)) return t('war.block.atWar');
    if (military.wars.length >= MAX_WARS) return t('war.block.maxWars', { max: MAX_WARS });
    if (game.nation.treasury < WAR.mobilisation) return t('war.block.mobilisation');
    return null;
  };

  return (
    <div className={gameStyles.grid}>
      <div className={`${gameStyles.span12} ${styles.stack}`}>
        {military.wars.length === 0 ? (
          <Panel title={t('war.peace')}>
            <p className={styles.note}>{noWars ? t('war.peaceNoWars') : t('war.peaceNote')}</p>
          </Panel>
        ) : (
          military.wars.map((war) => <WarCard key={war.id} game={game} war={war} />)
        )}
      </div>

      <Panel title={t('war.declare')} className={gameStyles.span8}>
        <p className={styles.note}>{t('war.declareNote', { cost: formatCrore(WAR.mobilisation) })}</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('diplomacy.columns.country')}</th>
                <th>{t('war.theirArmy')}</th>
                <th className={styles.num}>{t('war.fronts')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {RIVALS.map((id) => {
                const content = RIVAL_CONTENT[id];
                const block = cannotDeclare(id);
                return (
                  <tr key={id}>
                    <td>{content.name}</td>
                    <td className={styles.muted}>
                      {t('war.versus', {
                        army: armyText(strengthView(game, id, eff.intelligence)),
                        india: Math.round(mine),
                      })}
                    </td>
                    <td className={styles.num}>{content.fronts.length}</td>
                    <td>
                      <Button
                        disabled={block !== null}
                        title={block ?? undefined}
                        aria-label={t('war.declareOn', { country: content.name })}
                        onClick={() => setConfirm(id)}
                      >
                        {t('war.declare')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t('war.past')} className={gameStyles.span4}>
        {military.warHistory.length === 0 ? (
          <p className={styles.note}>{t('war.noPast')}</p>
        ) : (
          <ul className={styles.riskList} aria-label={t('war.past')}>
            {military.warHistory.map((w, i) => (
              <li key={`${w.rival}-${w.startedTick}-${i}`} className={styles.reportCard}>
                <div className={styles.personName}>
                  {t('war.pastRow', { country: RIVAL_CONTENT[w.rival].name, outcome: t(`war.outcomes.${w.outcome}`) })}
                </div>
                <div className={styles.muted}>{w.settlement}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {confirm && (
        <Modal title={t('war.confirmTitle', { country: RIVAL_CONTENT[confirm].name })} onClose={() => setConfirm(null)}>
          <p>{RIVAL_CONTENT[confirm].summary}</p>
          <ul className={styles.effects}>
            <li data-tone="bad">{t('war.confirm.mobilisation', { cost: formatCrore(WAR.mobilisation) })}</li>
            <li data-tone="bad">{t('war.confirm.approval')}</li>
            <li data-tone="bad">{t('war.confirm.relations')}</li>
            <li data-tone="neutral">
              {(() => {
                const v = strengthView(game, confirm, eff.intelligence);
                return v.kind === 'unknown'
                  ? t('war.confirm.strengthUnknown', { india: Math.round(mine) })
                  : t('war.confirm.strength', { india: Math.round(mine), low: v.low, high: v.high });
              })()}
            </li>
          </ul>
          <div className={styles.actions}>
            <Button onClick={() => setConfirm(null)}>{t('war.notNow')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'DECLARE_WAR', rival: confirm });
                setConfirm(null);
              }}
            >
              {t('war.declare')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
