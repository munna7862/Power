import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DOMAINS,
  fundingFor,
  MAX_QUEUE,
  monthlyUpkeep,
  orderCost,
  researchNode,
  TIER_POWER,
  UNIT_CONTENT,
  unitCost,
  unitGeneration,
  unitsIn,
  unitUpkeep,
  type GameState,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar } from './parts';
import { daysLeft, shareDone } from './progress';

const ORDER_SIZES = [1, 2, 5, 10] as const;

export function ForcesTab({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<number>(1);
  const { military, clock } = game;
  const { dispatch, setView } = gameStore.getState();
  const spend = game.economy.lastMonth?.expenditure.defence ?? 0;
  const funding = fundingFor(military, spend);

  return (
    <div className={gameStyles.grid}>
      <Panel title={t('forces.byDomain')} className={gameStyles.span8}>
        <div className={styles.orderBar}>
          <label htmlFor="order-size">{t('forces.orderSize')}</label>
          <select
            id="order-size"
            className={styles.select}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {ORDER_SIZES.map((n) => (
              <option key={n} value={n}>
                {t('forces.units', { count: n })}
              </option>
            ))}
          </select>
          <span className={styles.note}>
            {t('forces.fundNote', {
              fund: formatCrore(military.procurementFund),
              queued: military.queue.length,
              max: MAX_QUEUE,
            })}
          </span>
        </div>

        {DOMAINS.map((domain) => {
          const tier = military.tech[domain];
          const next = tier < 3 ? researchNode(domain, (tier + 1) as 2 | 3) : null;
          const researching = military.research?.domain === domain ? military.research : null;
          const blocked = military.research !== null || (next !== null && next.cost > military.procurementFund);
          const domainName = t(`military.domains.${domain}`);
          return (
            <section key={domain} aria-label={t('forces.domainForces', { domain: domainName })}>
              <div className={styles.domainHead}>
                <strong>
                  {t('forces.domainTier', { domain: domainName, tier })}{' '}
                  <span className={styles.muted}>{t('forces.tierPower', { power: TIER_POWER[tier] })}</span>
                </strong>
                {researching ? (
                  <span className={styles.tag}>
                    {t('forces.researching', {
                      tier: researching.tier,
                      count: daysLeft(researching.endsTick, clock.tick),
                    })}
                  </span>
                ) : next ? (
                  <Button
                    disabled={blocked}
                    title={
                      military.research
                        ? t('forces.researchBusy')
                        : next.cost > military.procurementFund
                          ? t('forces.cannotAfford')
                          : next.name
                    }
                    aria-label={t('forces.researchLabel', { domain: domainName, tier: tier + 1 })}
                    onClick={() => dispatch({ type: 'START_RESEARCH', domain })}
                  >
                    {t('forces.research', { tier: tier + 1, cost: formatCrore(next.cost), days: next.days })}
                  </Button>
                ) : (
                  <span className={styles.tag}>{t('forces.highestTier')}</span>
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('forces.columns.unit')}</th>
                      <th className={styles.num}>{t('forces.columns.inService')}</th>
                      <th className={styles.num}>{t('forces.columns.attackDefence')}</th>
                      <th className={styles.num}>{t('forces.columns.upkeep')}</th>
                      <th className={styles.num}>{t('forces.columns.price')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {unitsIn(domain).map((unit) => {
                      const content = UNIT_CONTENT[unit];
                      const cost = orderCost(game, unit, size);
                      const cannot = cost > military.procurementFund || military.queue.length >= MAX_QUEUE;
                      return (
                        <tr key={unit}>
                          <td>
                            <div className={styles.personName}>{content.name}</div>
                            <div className={styles.muted}>{unitGeneration(unit, tier)}</div>
                          </td>
                          <td className={styles.num} data-testid={`count-${unit}`}>
                            {military.forces[unit]}
                          </td>
                          <td className={styles.num}>
                            {content.attack} / {content.defence}
                          </td>
                          <td className={styles.num}>{formatCrore(unitUpkeep(unit, tier))}</td>
                          <td className={styles.num}>{formatCrore(unitCost(unit, tier))}</td>
                          <td>
                            <Button
                              disabled={cannot}
                              title={cannot ? t('forces.cannotOrder') : undefined}
                              aria-label={t('forces.orderLabel', { size, unit: content.name })}
                              onClick={() => dispatch({ type: 'ORDER_UNITS', unit, quantity: size })}
                            >
                              {t('forces.order', { size })}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </Panel>

      <div className={`${gameStyles.span4} ${styles.stack}`}>
        <Panel title={t('forces.funding')}>
          <div className={styles.stack}>
            <div>
              <div className={styles.tileLabel}>{t('forces.budgetThisMonth')}</div>
              <div className={styles.tileValue}>{formatCrore(funding.spend)}</div>
            </div>
            <div>
              <div className={styles.tileLabel}>{t('forces.upkeep')}</div>
              <div className={styles.tileValue} data-testid="upkeep">
                {formatCrore(monthlyUpkeep(military))}
              </div>
            </div>
            <div>
              <div className={styles.tileLabel}>{t('forces.covered')}</div>
              <Bar
                value={Math.min(funding.ratio, 1.5)}
                max={1.5}
                tone={funding.ratio >= 1 ? 'good' : funding.ratio >= 0.85 ? 'warning' : 'danger'}
                label={t('forces.coveredLabel')}
              />
              <div className={styles.note}>
                {t('forces.coveredShare', { value: Math.round(funding.ratio * 100) })}{' '}
                {funding.ratio < 1 ? t('forces.underfunded') : t('forces.surplus')}
              </div>
            </div>
            <div>
              <div className={styles.tileLabel}>{t('forces.fund')}</div>
              <div className={styles.tileValue} data-testid="procurement-fund">
                {formatCrore(military.procurementFund)}
              </div>
            </div>
            <Button onClick={() => setView('budget')}>{t('forces.adjust')}</Button>
          </div>
        </Panel>

        <Panel title={t('forces.queue')}>
          {military.queue.length === 0 ? (
            <p className={styles.note}>{t('forces.nothingOnOrder')}</p>
          ) : (
            <ul className={styles.riskList} aria-label={t('forces.queue')}>
              {military.queue.map((order) => (
                <li key={order.id} className={styles.reportCard}>
                  <div className={styles.personName}>
                    {order.quantity} × {UNIT_CONTENT[order.unit].name}
                  </div>
                  <Bar
                    value={shareDone(order.startedTick, order.endsTick, clock.tick)}
                    tone="accent"
                    label={t('forces.orderProgress', { unit: UNIT_CONTENT[order.unit].name })}
                  />
                  <div className={styles.cardActions}>
                    <span className={styles.muted}>
                      {t('inbox.daysLeft', { count: daysLeft(order.endsTick, clock.tick) })}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={t('forces.cancelLabel', {
                        quantity: order.quantity,
                        unit: UNIT_CONTENT[order.unit].name,
                      })}
                      onClick={() => dispatch({ type: 'CANCEL_ORDER', orderId: order.id })}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
