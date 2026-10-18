import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deliveryDays,
  DOMAINS,
  fundingFor,
  MAX_ORDER_SIZE,
  MAX_QUEUE,
  militaryStrength,
  monthlyUpkeep,
  orderCost,
  previewForces,
  projectMonth,
  researchNode,
  TIER_POWER,
  UNIT_CONTENT,
  unitCost,
  unitGeneration,
  unitsIn,
  unitUpkeep,
  validateDecommissionUnits,
  validateOrder,
  type GameState,
  type UnitId,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar } from './parts';
import { daysLeft, shareDone } from './progress';

function UnitCard({ game, unit }: { game: GameState; unit: UnitId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [quantity, setQuantity] = useState(1);
  const { military } = game;
  const content = UNIT_CONTENT[unit];
  const tier = military.tech[content.domain];
  const cost = formatCrore(orderCost(game, unit, quantity));
  const orderProblem = validateOrder(game, unit, quantity);
  const decommissionProblem = validateDecommissionUnits(game, unit, quantity);
  const now = militaryStrength(military);
  const preview = previewForces(game, unit, quantity);
  const upkeep = monthlyUpkeep(military);
  return (
    <div className={styles.facilityCard} data-testid={`unit-${unit}`}>
      <div>
        <div className={styles.personName}>{content.name}</div>
        <div className={styles.muted}>{unitGeneration(unit, tier)}</div>
        <div className={styles.facilityStats}>
          <span>
            {t('armoury.inService')} <strong data-testid={`count-${unit}`}>{military.forces[unit]}</strong>
          </span>
          <span>
            {t('armoury.attack')} <strong>{content.attack}</strong>
          </span>
          <span>
            {t('armoury.defence')} <strong>{content.defence}</strong>
          </span>
          <span>
            {t('armoury.price')} <strong>{formatCrore(unitCost(unit, tier))}</strong>
          </span>
          <span>
            {t('armoury.upkeep')} <strong>{formatCrore(unitUpkeep(unit, tier))}</strong>
          </span>
          <span>
            {t('armoury.delivery')} <strong>{t('armoury.days', { count: deliveryDays(unit, quantity) })}</strong>
          </span>
        </div>
        <div className={styles.note} data-testid={`preview-${unit}`}>
          {t('armoury.preview', {
            count: quantity,
            from: now.toFixed(1),
            to: preview.strength.toFixed(1),
            upkeep: `${preview.upkeep >= upkeep ? '+' : '−'}${formatCrore(Math.abs(preview.upkeep - upkeep))}`,
          })}
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_ORDER_SIZE}
          step={1}
          value={quantity}
          aria-label={t('armoury.quantityLabel', { unit: content.name })}
          onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_ORDER_SIZE, Math.floor(Number(e.target.value) || 1))))}
        />
        <Button
          variant="primary"
          disabled={orderProblem !== null}
          title={orderProblem ?? undefined}
          aria-label={t('armoury.buyLabel', { count: quantity, unit: content.name, cost })}
          onClick={() => dispatch({ type: 'ORDER_UNITS', unit, quantity })}
        >
          {t('armoury.buy', { cost })}
        </Button>
        <Button
          variant="ghost"
          disabled={decommissionProblem !== null}
          title={decommissionProblem ?? undefined}
          aria-label={t('armoury.decommissionLabel', { count: quantity, unit: content.name })}
          onClick={() => dispatch({ type: 'DECOMMISSION_UNITS', unit, quantity })}
        >
          {t('armoury.decommission')}
        </Button>
      </div>
    </div>
  );
}

export function ArmouryTab({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { military, clock } = game;
  const { dispatch, setView } = gameStore.getState();
  // Before the first settlement, this month's projected Defence spending.
  const spend = game.economy.lastMonth?.expenditure.defence ?? projectMonth(game, game.budget).expenditure.defence;
  const funding = fundingFor(military, spend);

  return (
    <div className={gameStyles.grid}>
      <Panel title={t('armoury.title')} className={gameStyles.span8}>
        <p className={styles.note}>
          {t('armoury.note', {
            treasury: formatCrore(game.nation.treasury),
            queued: military.queue.length,
            max: MAX_QUEUE,
          })}
        </p>
        {DOMAINS.map((domain) => {
          const tier = military.tech[domain];
          const next = tier < 3 ? researchNode(domain, (tier + 1) as 2 | 3) : null;
          const researching = military.research?.domain === domain ? military.research : null;
          const cannotAfford = next !== null && next.cost > game.nation.treasury;
          const domainName = t(`military.domains.${domain}`);
          return (
            <section key={domain} aria-label={t('armoury.domainForces', { domain: domainName })}>
              <div className={styles.domainHead}>
                <strong>
                  {t('armoury.domainTier', { domain: domainName, tier })}{' '}
                  <span className={styles.muted}>{t('armoury.tierPower', { power: TIER_POWER[tier] })}</span>
                </strong>
                {researching ? (
                  <span className={styles.tag}>
                    {t('armoury.researching', {
                      tier: researching.tier,
                      count: daysLeft(researching.endsTick, clock.tick),
                    })}
                  </span>
                ) : next ? (
                  <Button
                    disabled={military.research !== null || cannotAfford}
                    title={
                      military.research
                        ? t('armoury.researchBusy')
                        : cannotAfford
                          ? t('armoury.cannotAfford')
                          : t('armoury.researchNote', { name: next.name })
                    }
                    aria-label={t('armoury.researchLabel', { domain: domainName, tier: tier + 1 })}
                    onClick={() => dispatch({ type: 'START_RESEARCH', domain })}
                  >
                    {t('armoury.research', { tier: tier + 1, cost: formatCrore(next.cost), days: next.days })}
                  </Button>
                ) : (
                  <span className={styles.tag}>{t('armoury.highestTier')}</span>
                )}
              </div>
              <div className={styles.facilityList}>
                {unitsIn(domain).map((unit) => (
                  <UnitCard key={unit} game={game} unit={unit} />
                ))}
              </div>
            </section>
          );
        })}
      </Panel>

      <div className={`${gameStyles.span4} ${styles.stack}`}>
        <Panel title={t('armoury.funding')}>
          <div className={styles.stack}>
            <div>
              <div className={styles.tileLabel}>{t('armoury.budgetThisMonth')}</div>
              <div className={styles.tileValue}>{formatCrore(funding.spend)}</div>
            </div>
            <div>
              <div className={styles.tileLabel}>{t('armoury.upkeepTotal')}</div>
              <div className={styles.tileValue} data-testid="upkeep">
                {formatCrore(funding.upkeep)}
              </div>
            </div>
            <div>
              <div className={styles.tileLabel}>{t('armoury.covered')}</div>
              <Bar
                value={Math.min(funding.ratio, 1.5)}
                max={1.5}
                tone={funding.ratio >= 1 ? 'good' : funding.ratio >= 0.85 ? 'warning' : 'danger'}
                label={t('armoury.coveredLabel')}
              />
              <div className={styles.note}>
                {t('armoury.coveredShare', { value: Math.round(funding.ratio * 100) })}{' '}
                {funding.ratio < 1
                  ? t('armoury.underfunded')
                  : t('armoury.headroom', { value: formatCrore(funding.spend - funding.upkeep) })}
              </div>
            </div>
            <Button onClick={() => setView('budget')}>{t('armoury.adjust')}</Button>
          </div>
        </Panel>

        <Panel title={t('armoury.queue')}>
          {military.queue.length === 0 ? (
            <p className={styles.note}>{t('armoury.nothingOnOrder')}</p>
          ) : (
            <ul className={styles.riskList} aria-label={t('armoury.queue')}>
              {military.queue.map((order) => (
                <li key={order.id} className={styles.reportCard}>
                  <div className={styles.personName}>
                    {order.quantity} × {UNIT_CONTENT[order.unit].name}
                  </div>
                  <Bar
                    value={shareDone(order.startedTick, order.endsTick, clock.tick)}
                    tone="accent"
                    label={t('armoury.orderProgress', { unit: UNIT_CONTENT[order.unit].name })}
                  />
                  <div className={styles.cardActions}>
                    <span className={styles.muted}>
                      {t('inbox.daysLeft', { count: daysLeft(order.endsTick, clock.tick) })}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={t('armoury.cancelLabel', {
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
