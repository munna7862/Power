import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  consumption,
  demand,
  disasterFactor,
  emissionsIndex,
  exportedPower,
  exportRevenue,
  GOOD_CONTENT,
  gridApprovalLines,
  groupIndian,
  MAX_PLANT_ORDER,
  MAX_PLANT_QUEUE,
  PLANT_CANCEL_REFUND,
  PLANT_CONTENT,
  plantCost,
  plantOutput,
  plantsForMargin,
  plantsOf,
  PLANTS,
  plantUpkeep,
  production,
  productionBy,
  REGIONS,
  shortfall,
  shortfallGrowth,
  validateDecommission,
  validatePlant,
  type DemandSource,
  type GameState,
  type PlantId,
  type RegionId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, pct, pts, signed } from '../format';
import gameStyles from '../screens/game.module.css';
import { Bar } from './military/parts';
import { daysLeft, shareDone } from './military/progress';
import styles from './views.module.css';

const SOURCES: readonly DemandSource[] = ['homes', 'industry', 'services', 'public'];
const gw = (value: number) => value.toFixed(1);

function Tiles({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const supply = production(game);
  const need = consumption(game);
  const balance = supply - need;
  const short = shortfall(game);
  return (
    <div className={styles.tiles} style={{ marginBottom: 16 }}>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('energy.tiles.production')}</span>
        <span className={styles.tileValue} data-testid="power-production">
          {t('energy.tiles.gw', { value: gw(supply) })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('energy.tiles.demand')}</span>
        <span className={styles.tileValue}>{t('energy.tiles.gw', { value: gw(need) })}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('energy.tiles.balance')}</span>
        <span
          className={`${styles.tileValue} ${styles.coverageCell}`}
          data-tone={short > 0 ? 'danger' : 'good'}
          data-testid="power-balance"
        >
          {t('energy.tiles.gw', { value: signed(balance) })}
        </span>
        <span className={styles.tileNote}>
          {short > 0
            ? t('energy.tiles.short', { value: pct(short) })
            : t('energy.tiles.margin', { value: pct(balance / need) })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('energy.tiles.air')}</span>
        <span className={styles.tileValue}>{pct(emissionsIndex(game), 0)}</span>
        <span className={styles.tileNote}>{t('energy.tiles.airNote')}</span>
      </div>
    </div>
  );
}

function SupplyPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const need = demand(game);
  const total = production(game);
  const lines = gridApprovalLines(game);
  const exported = exportedPower(game);
  return (
    <Panel title={t('energy.supply')} className={gameStyles.span8}>
      <div className={styles.stack}>
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={t('energy.demandBy')}>
            <thead>
              <tr>
                <th>
                  {t('energy.demandBy')} <Tooltip label={t('common.why')}>{t('energy.whyDemand')}</Tooltip>
                </th>
                <th className={styles.num}>{t('energy.columns.demand')}</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s}>
                  <td>{t(`energy.sources.${s}`)}</td>
                  <td className={styles.num}>{t('energy.tiles.gw', { value: gw(need[s]) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={t('energy.productionBy')}>
            <thead>
              <tr>
                <th>{t('energy.productionBy')}</th>
                <th className={styles.num}>{t('energy.columns.plants')}</th>
                <th className={styles.num}>{t('energy.columns.output')}</th>
                <th className={styles.num}>{t('energy.columns.share')}</th>
              </tr>
            </thead>
            <tbody>
              {PLANTS.map((p) => (
                <tr key={p}>
                  <td>{PLANT_CONTENT[p].name}</td>
                  <td className={styles.num}>{groupIndian(plantsOf(game, p))}</td>
                  <td className={styles.num}>{t('energy.tiles.gw', { value: gw(productionBy(game, p)) })}</td>
                  <td className={styles.num}>{pct(productionBy(game, p) / total, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <h3 className={styles.personName}>{t('energy.effects')}</h3>
      <ul className={styles.riskList} aria-label={t('energy.effects')} data-testid="grid-effects">
        <li className={styles.riskRow} data-danger={shortfall(game) > 0}>
          <span>{t('energy.growthEffect')}</span>
          <span>{pts(shortfallGrowth(game))}</span>
          <span />
        </li>
        {lines.map((l) => (
          <li key={l.label} className={styles.riskRow} data-danger={l.value < 0}>
            <span>{l.label === 'Power cuts' ? t('energy.approvalEffect') : t('energy.pollutionEffect')}</span>
            <span>{signed(l.value)}</span>
            <span />
          </li>
        ))}
        <li className={styles.riskRow}>
          <span>{t('energy.disasters')}</span>
          <span>{t('energy.disastersValue', { value: disasterFactor(game).toFixed(2) })}</span>
          <span />
        </li>
        <li className={styles.riskRow}>
          <span>{t('energy.exports')}</span>
          <span>{t('energy.exportsValue', { gw: gw(exported), revenue: formatCrore(exportRevenue(game)) })}</span>
          <span />
        </li>
      </ul>
    </Panel>
  );
}

function Projects({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const { queue } = game.energy;
  const upkeep = plantUpkeep(game).industry;
  return (
    <div className={`${gameStyles.span4} ${styles.stack}`}>
      <Panel title={t('energy.projects')}>
        <p className={styles.note}>
          {t('energy.projectsNote', {
            queued: queue.length,
            max: MAX_PLANT_QUEUE,
            refund: Math.round(PLANT_CANCEL_REFUND * 100),
          })}
        </p>
        {queue.length === 0 ? (
          <p className={styles.note}>{t('energy.noProjects')}</p>
        ) : (
          <ul className={styles.riskList} aria-label={t('energy.projects')}>
            {queue.map((order) => {
              const name = PLANT_CONTENT[order.plant].name;
              const region = t(`regions.${order.region}`);
              const refund = formatCrore(Math.round(order.cost * PLANT_CANCEL_REFUND));
              return (
                <li key={order.id} className={styles.reportCard} data-testid="plant-order">
                  <div className={styles.personName}>
                    {t('energy.project', { count: order.quantity, name, region })}
                  </div>
                  <div className={styles.note}>
                    {t('energy.projectAdds', { gw: gw(order.quantity * plantOutput(order.plant)) })}
                  </div>
                  <Bar
                    value={shareDone(order.startedTick, order.endsTick, game.clock.tick)}
                    tone="accent"
                    label={t('energy.projectProgress', { name })}
                  />
                  <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                    <span className={styles.note}>
                      {t('energy.connectsIn', { count: daysLeft(order.endsTick, game.clock.tick) })}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={t('energy.cancelLabel', { name, region, refund })}
                      onClick={() => dispatch({ type: 'CANCEL_PLANT', orderId: order.id })}
                    >
                      {t('energy.cancel', { refund })}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.note} data-testid="plant-running-costs">
          {t('energy.runningCosts', { cost: formatCrore(upkeep) })}
        </p>
        <p className={styles.note}>{t('energy.runningCostsNote')}</p>
      </Panel>
    </div>
  );
}

function PlantCard({ game, region, plant }: { game: GameState; region: RegionId; plant: PlantId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [quantity, setQuantity] = useState(1);
  const c = PLANT_CONTENT[plant];
  const regionName = t(`regions.${region}`);
  const cost = formatCrore(plantCost(plant, quantity));
  const buildProblem = validatePlant(game, plant, region, quantity);
  const closeProblem = validateDecommission(game, plant, region, quantity);
  const gap = plantsForMargin(game, plant);
  return (
    <div className={styles.facilityCard} data-testid={`plant-${plant}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>{c.summary}</div>
        <div className={styles.facilityStats}>
          <span data-testid={`plants-${plant}`}>
            {t('energy.plantLine', {
              inRegion: groupIndian(game.energy.plants[region][plant]),
              total: groupIndian(plantsOf(game, plant)),
              output: plantOutput(plant).toFixed(2),
            })}
          </span>
          <span>
            {t('energy.plantCosts', {
              cost: formatCrore(c.cost),
              days: t('energy.days', { count: c.buildDays }),
              upkeep: formatCrore(c.upkeep),
            })}
          </span>
          {c.fuel && (
            <span>
              {t('energy.plantFuel', {
                fuel: GOOD_CONTENT[c.fuel].name.toLowerCase(),
                quantity: c.fuelUse,
                unit: GOOD_CONTENT[c.fuel].unit,
              })}
            </span>
          )}
          <span>{c.emissions > 0 ? t('energy.emissions', { value: c.emissions }) : t('energy.clean')}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_PLANT_ORDER}
          step={1}
          value={quantity}
          aria-label={t('energy.quantityLabel', { name: c.name.toLowerCase() })}
          onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_PLANT_ORDER, Math.floor(Number(e.target.value) || 1))))}
        />
        {gap > 0 && (
          <Button
            variant="ghost"
            aria-label={t('energy.toMarginLabel', { name: c.name.toLowerCase() })}
            onClick={() => setQuantity(Math.min(MAX_PLANT_ORDER, gap))}
          >
            {t('energy.toMargin')}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={buildProblem !== null}
          title={buildProblem ?? undefined}
          aria-label={t('energy.buildLabel', { count: quantity, name: c.name, region: regionName, cost })}
          onClick={() => dispatch({ type: 'BUILD_PLANT', plant, region, quantity })}
        >
          {t('energy.build', { cost })}
        </Button>
        <Button
          disabled={closeProblem !== null}
          title={closeProblem ?? undefined}
          aria-label={t('energy.decommissionLabel', { count: quantity, name: c.name, region: regionName })}
          onClick={() => dispatch({ type: 'DECOMMISSION_PLANT', plant, region, quantity })}
        >
          {t('energy.decommission')}
        </Button>
      </div>
    </div>
  );
}

export function EnergyView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [region, setRegion] = useState<RegionId>('north');
  if (!game) return null;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.energy')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('energy.subtitle')}</p>
        </div>
      </div>

      <Tiles game={game} />

      <div className={gameStyles.grid}>
        <SupplyPanel game={game} />
        <Projects game={game} />

        <Panel
          title={t('energy.buildIn', { region: t(`regions.${region}`) })}
          className={gameStyles.span12}
          actions={
            <div className={`${styles.segmented} ${styles.segmentedWrap}`} role="group" aria-label={t('energy.region')}>
              {REGIONS.map((r) => (
                <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)}>
                  {t(`regions.${r}`)}
                </button>
              ))}
            </div>
          }
        >
          <div className={styles.facilityList} key={region}>
            {PLANTS.map((p) => (
              <PlantCard key={p} game={game} region={region} plant={p} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
