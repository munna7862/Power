import { useState } from 'react';
import {
  DOMAIN_LABELS,
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
  const [size, setSize] = useState<number>(1);
  const { military, clock } = game;
  const { dispatch, setView } = gameStore.getState();
  const spend = game.economy.lastMonth?.expenditure.defence ?? 0;
  const funding = fundingFor(military, spend);

  return (
    <div className={gameStyles.grid}>
      <Panel title="Forces by domain" className={gameStyles.span8}>
        <div className={styles.orderBar}>
          <label htmlFor="order-size">Order size</label>
          <select
            id="order-size"
            className={styles.select}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {ORDER_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'unit' : 'units'}
              </option>
            ))}
          </select>
          <span className={styles.note}>
            Paid from the procurement fund ({formatCrore(military.procurementFund)}). Queue {military.queue.length}/
            {MAX_QUEUE}.
          </span>
        </div>

        {DOMAINS.map((domain) => {
          const tier = military.tech[domain];
          const next = tier < 3 ? researchNode(domain, (tier + 1) as 2 | 3) : null;
          const researching = military.research?.domain === domain ? military.research : null;
          const blocked = military.research !== null || (next !== null && next.cost > military.procurementFund);
          return (
            <section key={domain} aria-label={`${DOMAIN_LABELS[domain]} forces`}>
              <div className={styles.domainHead}>
                <strong>
                  {DOMAIN_LABELS[domain]} · tier {tier}{' '}
                  <span className={styles.muted}>(strength ×{TIER_POWER[tier]})</span>
                </strong>
                {researching ? (
                  <span className={styles.tag}>
                    Researching tier {researching.tier}: {daysLeft(researching.endsTick, clock.tick)} days left
                  </span>
                ) : next ? (
                  <Button
                    disabled={blocked}
                    title={
                      military.research
                        ? 'Another research project is under way.'
                        : next.cost > military.procurementFund
                          ? 'The procurement fund cannot cover this.'
                          : next.name
                    }
                    aria-label={`Research ${DOMAIN_LABELS[domain]} tier ${tier + 1}`}
                    onClick={() => dispatch({ type: 'START_RESEARCH', domain })}
                  >
                    Research tier {tier + 1} · {formatCrore(next.cost)} · {next.days} days
                  </Button>
                ) : (
                  <span className={styles.tag}>Highest tier</span>
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th className={styles.num}>In service</th>
                      <th className={styles.num}>Atk / Def</th>
                      <th className={styles.num}>Upkeep / mo</th>
                      <th className={styles.num}>Price</th>
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
                              title={cannot ? 'Not enough in the procurement fund, or the queue is full.' : undefined}
                              aria-label={`Order ${size} ${content.name}`}
                              onClick={() => dispatch({ type: 'ORDER_UNITS', unit, quantity: size })}
                            >
                              Order {size}
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
        <Panel title="Defence funding">
          <div className={styles.stack}>
            <div>
              <div className={styles.tileLabel}>Defence budget this month</div>
              <div className={styles.tileValue}>{formatCrore(funding.spend)}</div>
            </div>
            <div>
              <div className={styles.tileLabel}>Upkeep of the forces</div>
              <div className={styles.tileValue} data-testid="upkeep">
                {formatCrore(monthlyUpkeep(military))}
              </div>
            </div>
            <div>
              <div className={styles.tileLabel}>Covered</div>
              <Bar
                value={Math.min(funding.ratio, 1.5)}
                max={1.5}
                tone={funding.ratio >= 1 ? 'good' : funding.ratio >= 0.85 ? 'warning' : 'danger'}
                label="Share of upkeep covered by the Defence budget"
              />
              <div className={styles.note}>
                {Math.round(funding.ratio * 100)}% of upkeep.{' '}
                {funding.ratio < 1
                  ? 'Underfunded: readiness and morale will decay.'
                  : 'The surplus goes into the procurement fund.'}
              </div>
            </div>
            <div>
              <div className={styles.tileLabel}>Procurement fund</div>
              <div className={styles.tileValue} data-testid="procurement-fund">
                {formatCrore(military.procurementFund)}
              </div>
            </div>
            <Button onClick={() => setView('budget')}>Adjust Defence in Budget</Button>
          </div>
        </Panel>

        <Panel title="Production queue">
          {military.queue.length === 0 ? (
            <p className={styles.note}>Nothing on order.</p>
          ) : (
            <ul className={styles.riskList} aria-label="Production queue">
              {military.queue.map((order) => (
                <li key={order.id} className={styles.reportCard}>
                  <div className={styles.personName}>
                    {order.quantity} × {UNIT_CONTENT[order.unit].name}
                  </div>
                  <Bar
                    value={shareDone(order.startedTick, order.endsTick, clock.tick)}
                    tone="accent"
                    label={`${UNIT_CONTENT[order.unit].name} order progress`}
                  />
                  <div className={styles.cardActions}>
                    <span className={styles.muted}>{daysLeft(order.endsTick, clock.tick)} days left</span>
                    <Button
                      variant="ghost"
                      aria-label={`Cancel order of ${order.quantity} ${UNIT_CONTENT[order.unit].name}`}
                      onClick={() => dispatch({ type: 'CANCEL_ORDER', orderId: order.id })}
                    >
                      Cancel
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
