import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  businessClimate,
  GOOD_CONTENT,
  GOODS,
  groupIndian,
  INDUSTRIES,
  INDUSTRY_CANCEL_REFUND,
  INDUSTRY_CONTENT,
  industryCost,
  industryJobs,
  MAX_INDUSTRY_ORDER,
  MAX_INDUSTRY_QUEUE,
  OPENING_SETTLEMENT,
  plantCount,
  plantProfit,
  REGIONS,
  validateCloseIndustry,
  validateIndustry,
  validateLicence,
  type GameState,
  type GoodId,
  type IndustryId,
  type RegionId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreFine, pct, signed } from '../format';
import { t as translate } from '../i18n';
import gameStyles from '../screens/game.module.css';
import { Bar } from './military/parts';
import { daysLeft, shareDone } from './military/progress';
import { qty } from './market/quantity';
import styles from './views.module.css';

function Tiles({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const last = game.industry.last;
  const climate = businessClimate(game);
  const imported = GOODS.reduce((s, g) => s + last.imports[g] * game.market.prices[g], 0);
  return (
    <div className={styles.tiles} style={{ marginBottom: 16 }}>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('industry.tiles.stateProfit')}</span>
        <span className={styles.tileValue}>
          {t('industry.tiles.perMonth', { value: formatCrore(last.stateProfit) })}
        </span>
        <span className={styles.tileNote}>
          {t('industry.tiles.sinceStart', {
            value: `${last.stateProfit >= OPENING_SETTLEMENT.stateProfit ? '+' : ''}${formatCrore(last.stateProfit - OPENING_SETTLEMENT.stateProfit)}`,
          })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('industry.tiles.climate')}</span>
        <span className={styles.tileValue} data-testid="business-climate">
          {pct(climate.total, 0)}{' '}
          <Tooltip label={t('common.why')}>
            <span className={gameStyles.breakdown}>
              {climate.drivers.map((d) => (
                <Fragment key={d.label}>
                  <span>{d.label}</span>
                  <span className={gameStyles.breakdownValue}>{signed(d.value * 100)}</span>
                </Fragment>
              ))}
            </span>
          </Tooltip>
        </span>
        <span className={styles.tileNote}>{t('industry.tiles.climateNote')}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('industry.tiles.jobs')}</span>
        <span className={styles.tileValue}>{groupIndian(industryJobs(game))}</span>
        <span className={styles.tileNote}>{t('industry.tiles.jobsNote')}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('industry.tiles.imports')}</span>
        <span className={styles.tileValue}>{formatCrore(imported)}</span>
        <span className={styles.tileNote}>{t('industry.tiles.importsNote')}</span>
      </div>
    </div>
  );
}

function GoodsTable({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const last = game.industry.last;
  return (
    <Panel title={t('industry.goods')} className={gameStyles.span8}>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="goods-table">
          <thead>
            <tr>
              <th>{t('industry.columns.good')}</th>
              <th className={styles.num}>{t('industry.columns.made')}</th>
              <th className={styles.num}>{t('industry.columns.used')}</th>
              <th className={styles.num}>{t('industry.columns.demand')}</th>
              <th className={styles.num}>{t('industry.columns.imported')}</th>
              <th className={styles.num}>{t('industry.columns.stock')}</th>
              <th className={styles.num}>{t('industry.columns.short')}</th>
            </tr>
          </thead>
          <tbody>
            {GOODS.map((g) => (
              <tr key={g}>
                <td>
                  {GOOD_CONTENT[g].name}{' '}
                  <span className={styles.muted}>{t('industry.unitNote', { unit: GOOD_CONTENT[g].unit })}</span>
                </td>
                <td className={styles.num}>{qty(last.production[g])}</td>
                <td className={styles.num}>{qty(last.use[g])}</td>
                <td className={styles.num}>{qty(last.demand[g])}</td>
                <td className={styles.num}>{qty(last.imports[g])}</td>
                <td className={styles.num}>{qty(game.industry.stocks[g])}</td>
                <td
                  className={`${styles.num} ${styles.coverageCell}`}
                  data-tone={last.shortage[g] > 0 ? 'danger' : undefined}
                >
                  {qty(last.shortage[g])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Projects({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const { queue } = game.industry;
  return (
    <Panel title={t('industry.projects')} className={gameStyles.span4}>
      <p className={styles.note}>
        {t('industry.projectsNote', {
          queued: queue.length,
          max: MAX_INDUSTRY_QUEUE,
          refund: Math.round(INDUSTRY_CANCEL_REFUND * 100),
        })}
      </p>
      {queue.length === 0 ? (
        <p className={styles.note}>{t('industry.noProjects')}</p>
      ) : (
        <ul className={styles.riskList} aria-label={t('industry.projects')}>
          {queue.map((order) => {
            const name = INDUSTRY_CONTENT[order.industry].name;
            const region = t(`regions.${order.region}`);
            const refund = formatCrore(Math.round(order.cost * INDUSTRY_CANCEL_REFUND));
            return (
              <li key={order.id} className={styles.reportCard} data-testid="industry-order">
                <div className={styles.personName}>
                  {t('industry.project', {
                    count: order.quantity,
                    name,
                    owner: t(`industry.owners.${order.owner}`),
                    region,
                  })}
                </div>
                <Bar
                  value={shareDone(order.startedTick, order.endsTick, game.clock.tick)}
                  tone="accent"
                  label={t('industry.projectProgress', { name })}
                />
                <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                  <span className={styles.note}>
                    {t('industry.opensIn', { count: daysLeft(order.endsTick, game.clock.tick) })}
                  </span>
                  {order.owner === 'state' && (
                    <Button
                      variant="ghost"
                      aria-label={t('industry.cancelLabel', { name, region, refund })}
                      onClick={() => dispatch({ type: 'CANCEL_INDUSTRY', orderId: order.id })}
                    >
                      {t('industry.cancel', { refund })}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function flowText(flows: Partial<Record<GoodId, number>>) {
  const parts = Object.entries(flows).map(([g, q]) =>
    translate('industry.flow', {
      quantity: qty(q),
      unit: GOOD_CONTENT[g as GoodId].unit,
      good: GOOD_CONTENT[g as GoodId].name.toLowerCase(),
    }),
  );
  return parts.length > 0 ? parts.join(' + ') : translate('industry.noInputs');
}

function IndustryCard({ game, region, industry }: { game: GameState; region: RegionId; industry: IndustryId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [quantity, setQuantity] = useState(1);
  const c = INDUSTRY_CONTENT[industry];
  const here = game.industry.plants[region][industry];
  const regionName = t(`regions.${region}`);
  const cost = formatCrore(industryCost(industry, quantity));
  const fee = formatCrore(c.licenceFee);
  const buildProblem = validateIndustry(game, industry, region, quantity);
  const licenceProblem = validateLicence(game, industry, region);
  const closeProblem = validateCloseIndustry(game, industry, region, quantity);
  return (
    <div className={styles.facilityCard} data-testid={`industry-${industry}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>
          {c.summary} {t('industry.recipe', { inputs: flowText(c.inputs), outputs: flowText(c.outputs) })}
        </div>
        <div className={styles.facilityStats}>
          <span data-testid={`plants-${industry}`}>
            {t('industry.plantLine', {
              state: here.state,
              private: here.private,
              total: plantCount(game.industry.plants, industry),
              throughput: pct(game.industry.last.throughput[industry], 0),
            })}
          </span>
          <span>
            {t('industry.economics', {
              cost: formatCrore(c.cost),
              days: t('industry.days', { count: c.buildDays }),
              profit: formatCroreFine(plantProfit(game, industry)),
              power: c.power,
              jobs: groupIndian(c.jobs),
            })}
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_INDUSTRY_ORDER}
          step={1}
          value={quantity}
          aria-label={t('industry.quantityLabel', { name: c.name.toLowerCase() })}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(MAX_INDUSTRY_ORDER, Math.floor(Number(e.target.value) || 1))))
          }
        />
        <Button
          variant="primary"
          disabled={buildProblem !== null}
          title={buildProblem ?? undefined}
          aria-label={t('industry.buildLabel', { count: quantity, name: c.name, region: regionName, cost })}
          onClick={() => dispatch({ type: 'BUILD_INDUSTRY', industry, region, quantity })}
        >
          {t('industry.build', { cost })}
        </Button>
        <Button
          disabled={licenceProblem !== null}
          title={licenceProblem ?? undefined}
          aria-label={t('industry.licenseLabel', { name: c.name.toLowerCase(), region: regionName, fee })}
          onClick={() => dispatch({ type: 'LICENSE_PLANT', industry, region })}
        >
          {t('industry.license', { fee })}
        </Button>
        <Button
          variant="ghost"
          disabled={closeProblem !== null}
          title={closeProblem ?? undefined}
          aria-label={t('industry.closeLabel', { count: quantity, name: c.name.toLowerCase(), region: regionName })}
          onClick={() => dispatch({ type: 'CLOSE_INDUSTRY', industry, region, quantity })}
        >
          {t('industry.close')}
        </Button>
      </div>
    </div>
  );
}

export function IndustryView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [region, setRegion] = useState<RegionId>('north');
  if (!game) return null;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.industry')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('industry.subtitle')}</p>
        </div>
      </div>

      <Tiles game={game} />

      <div className={gameStyles.grid}>
        <GoodsTable game={game} />
        <Projects game={game} />

        <Panel
          title={t('industry.buildIn', { region: t(`regions.${region}`) })}
          className={gameStyles.span12}
          actions={
            <div
              className={`${styles.segmented} ${styles.segmentedWrap}`}
              role="group"
              aria-label={t('industry.region')}
            >
              {REGIONS.map((r) => (
                <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)}>
                  {t(`regions.${r}`)}
                </button>
              ))}
            </div>
          }
        >
          <div className={styles.facilityList} key={region}>
            {INDUSTRIES.map((i) => (
              <IndustryCard key={i} game={game} region={region} industry={i} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
