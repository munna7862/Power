import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildCost,
  CANCEL_REFUND,
  COVERAGE_AREAS,
  coverage,
  explainCoverage,
  FACILITY_CONTENT,
  facilitiesForTarget,
  facilitiesIn,
  facilityUpkeep,
  groupIndian,
  MAX_BUILD_QUANTITY,
  MAX_BUILD_QUEUE,
  MINISTRIES,
  MINISTRY_CONTENT,
  REGIONS,
  validateBuild,
  validateDemolish,
  type CoverageArea,
  type FacilityId,
  type GameState,
  type RegionId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreFine, pct } from '../format';
import gameStyles from '../screens/game.module.css';
import { Bar } from './military/parts';
import { daysLeft, shareDone } from './military/progress';
import styles from './views.module.css';

const coverageTone = (value: number) => (value >= 0.9 ? 'good' : value >= 0.7 ? 'warning' : 'danger');

/** Every region against every area, so the gaps stand out; picking a row opens that region below. */
function Overview({ game, region, onSelect }: { game: GameState; region: RegionId; onSelect(r: RegionId): void }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('construction.overview')} className={gameStyles.span12}>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="coverage-overview">
          <thead>
            <tr>
              <th>{t('construction.regionColumn')}</th>
              {COVERAGE_AREAS.map((a) => (
                <th key={a} className={styles.num}>
                  {t(`construction.areas.${a}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGIONS.map((r) => (
              <tr key={r} className={r === region ? styles.selectedRow : undefined}>
                <td>
                  <Button
                    variant="ghost"
                    aria-pressed={r === region}
                    aria-label={t('construction.selectRegion', { region: t(`regions.${r}`) })}
                    onClick={() => onSelect(r)}
                  >
                    {t(`regions.${r}`)}
                  </Button>
                </td>
                {COVERAGE_AREAS.map((a) => {
                  const value = coverage(game, r, a);
                  return (
                    <td key={a} className={`${styles.num} ${styles.coverageCell}`} data-tone={coverageTone(value)}>
                      {pct(value, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{t('construction.overviewNote')}</p>
    </Panel>
  );
}

/** The "Why?" behind one area's coverage: who each facility type serves, against the people living there. */
function AreaWhy({ game, region, area }: { game: GameState; region: RegionId; area: CoverageArea }) {
  const { t } = useTranslation();
  const why = explainCoverage(game, region, area);
  return (
    <Tooltip label={t('common.why')}>
      <span className={gameStyles.breakdown}>
        {why.lines.map((l) => (
          <Fragment key={l.facility}>
            <span>
              {t('construction.whyLine', {
                name: FACILITY_CONTENT[l.facility].name,
                count: groupIndian(l.count),
                capacity: groupIndian(FACILITY_CONTENT[l.facility].capacity),
              })}
            </span>
            <span className={gameStyles.breakdownValue}>{groupIndian(l.served)}</span>
          </Fragment>
        ))}
        <span>{t('construction.whyPopulation')}</span>
        <span className={gameStyles.breakdownValue}>{groupIndian(Math.round(why.population))}</span>
        <span>{t('construction.whyCoverage')}</span>
        <span className={gameStyles.breakdownValue}>{pct(why.coverage)}</span>
        <span>{t('construction.whyCounted')}</span>
        <span className={gameStyles.breakdownValue}>{pct(why.counted)}</span>
      </span>
    </Tooltip>
  );
}

function FacilityRow({
  game,
  region,
  facility,
  quantity,
  onQuantity,
}: {
  game: GameState;
  region: RegionId;
  facility: FacilityId;
  quantity: number;
  onQuantity(n: number): void;
}) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const c = FACILITY_CONTENT[facility];
  const regionName = t(`regions.${region}`);
  const cost = formatCrore(buildCost(facility, quantity));
  const buildProblem = validateBuild(game, facility, region, quantity);
  const demolishProblem = validateDemolish(game, facility, region, quantity);
  const toFull = facilitiesForTarget(game, region, facility);
  return (
    <div className={styles.facilityCard} data-testid={`facility-${facility}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>
          {MINISTRY_CONTENT[c.department].shortName} · {c.summary}
        </div>
        <div className={styles.facilityStats}>
          <span>
            {t('construction.columns.inService')}{' '}
            <strong data-testid={`count-${facility}`}>
              {groupIndian(game.infrastructure.counts[region][facility])}
            </strong>
          </span>
          <span>
            {t('construction.columns.price')} <strong>{formatCroreFine(c.cost)}</strong>
          </span>
          <span>
            {t('construction.columns.upkeep')} <strong>{formatCroreFine(c.upkeep)}</strong>
          </span>
          <span>
            {t('construction.columns.buildTime')} <strong>{t('construction.days', { count: c.buildDays })}</strong>
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_BUILD_QUANTITY}
          step={1}
          value={quantity}
          aria-label={t('construction.quantityLabel', { name: c.name.toLowerCase() })}
          onChange={(e) =>
            onQuantity(Math.max(1, Math.min(MAX_BUILD_QUANTITY, Math.floor(Number(e.target.value) || 1))))
          }
        />
        {toFull > 0 && (
          <Button
            variant="ghost"
            aria-label={t('construction.toFullLabel', { name: c.name.toLowerCase(), region: regionName })}
            onClick={() => onQuantity(Math.min(MAX_BUILD_QUANTITY, toFull))}
          >
            {t('construction.toFull')}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={buildProblem !== null}
          title={buildProblem ?? undefined}
          aria-label={t('construction.buildLabel', { count: quantity, name: c.name, region: regionName, cost })}
          onClick={() => dispatch({ type: 'BUILD_FACILITY', facility, region, quantity })}
        >
          {t('construction.build', { cost })}
        </Button>
        <Button
          disabled={demolishProblem !== null}
          title={demolishProblem ?? undefined}
          aria-label={t('construction.demolishLabel', { count: quantity, name: c.name, region: regionName })}
          onClick={() => dispatch({ type: 'DEMOLISH_FACILITY', facility, region, quantity })}
        >
          {t('construction.demolish')}
        </Button>
      </div>
    </div>
  );
}

function BuildPanel({ game, region }: { game: GameState; region: RegionId }) {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const regionName = t(`regions.${region}`);
  return (
    <Panel title={t('construction.buildIn', { region: regionName })} className={gameStyles.span8}>
      {COVERAGE_AREAS.map((area) => {
        const value = coverage(game, region, area);
        const why = explainCoverage(game, region, area);
        const unserved = Math.max(0, why.population - why.lines.reduce((s, l) => s + l.served, 0));
        return (
          <section key={area} aria-label={t(`construction.areas.${area}`)} data-testid={`area-${area}`}>
            <div className={styles.areaHead}>
              <strong>
                {t('construction.coverageOf', { area: t(`construction.areas.${area}`), value: pct(value, 0) })}{' '}
                <AreaWhy game={game} region={region} area={area} />
              </strong>
              <span className={`${styles.note} ${styles.coverageCell}`} data-tone={coverageTone(value)}>
                {unserved > 0
                  ? t('construction.gap', { people: groupIndian(Math.round(unserved)) })
                  : t('construction.covered')}
              </span>
            </div>
            <Bar value={Math.min(value, 1.5)} max={1.5} label={t(`construction.areas.${area}`)} />
            <div className={styles.facilityList}>
              {facilitiesIn(area).map((f) => (
                <FacilityRow
                  key={f}
                  game={game}
                  region={region}
                  facility={f}
                  quantity={quantities[f] ?? 1}
                  onQuantity={(n) => setQuantities((q) => ({ ...q, [f]: n }))}
                />
              ))}
            </div>
          </section>
        );
      })}
    </Panel>
  );
}

function Projects({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const { queue } = game.infrastructure;
  return (
    <Panel title={t('construction.projects')}>
      <p className={styles.note}>
        {t('construction.projectsNote', {
          queued: queue.length,
          max: MAX_BUILD_QUEUE,
          refund: Math.round(CANCEL_REFUND * 100),
        })}
      </p>
      {queue.length === 0 ? (
        <p className={styles.note}>{t('construction.noProjects')}</p>
      ) : (
        <ul className={styles.riskList} aria-label={t('construction.projects')}>
          {queue.map((order) => {
            const name = FACILITY_CONTENT[order.facility].name;
            const region = t(`regions.${order.region}`);
            const refund = formatCrore(Math.round(order.cost * CANCEL_REFUND));
            return (
              <li key={order.id} className={styles.reportCard} data-testid="build-order">
                <div className={styles.personName}>
                  {t('construction.project', { count: groupIndian(order.quantity), name, region })}
                </div>
                <Bar
                  value={shareDone(order.startedTick, order.endsTick, game.clock.tick)}
                  tone="accent"
                  label={t('construction.projectProgress', { name })}
                />
                <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                  <span className={styles.note}>
                    {t('construction.opensIn', { count: daysLeft(order.endsTick, game.clock.tick) })}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={t('construction.cancelLabel', { name, region, refund })}
                    onClick={() => dispatch({ type: 'CANCEL_BUILD', orderId: order.id })}
                  >
                    {t('construction.cancel', { refund })}
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

function RunningCosts({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const upkeep = facilityUpkeep(game);
  const lines = MINISTRIES.filter((m) => upkeep[m] !== 0);
  return (
    <Panel title={t('construction.runningCosts')}>
      <p className={styles.note}>{t('construction.runningCostsNote')}</p>
      {lines.length === 0 ? (
        <p className={styles.note}>{t('construction.noRunningCosts')}</p>
      ) : (
        <table className={styles.table} data-testid="running-costs">
          <tbody>
            {lines.map((m) => (
              <tr key={m}>
                <td>{MINISTRY_CONTENT[m].shortName}</td>
                <td className={styles.num}>{t('construction.perMonth', { cost: formatCrore(upkeep[m]) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function ConstructionView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [region, setRegion] = useState<RegionId>('north');
  if (!game) return null;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.construction')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('construction.subtitle')}</p>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Overview game={game} region={region} onSelect={setRegion} />
        <BuildPanel key={region} game={game} region={region} />
        <div className={`${gameStyles.span4} ${styles.stack}`}>
          <Projects game={game} />
          <RunningCosts game={game} />
        </div>
      </div>
    </>
  );
}
