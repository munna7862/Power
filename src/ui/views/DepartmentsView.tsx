import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allEfficiencies,
  DEPARTMENT_CONTENT,
  departmentFunding,
  departmentQuality,
  IDEOLOGIES,
  IDEOLOGY_CONTENT,
  MAX_STARS,
  MINISTRIES,
  MINISTRY_CONTENT,
  policyCooldownDays,
  POLICY_CHANGE_COST,
  STRATEGIES,
  STRATEGY_CONTENT,
  UNDERFUNDED_BELOW,
  UNDERFUNDED_MONTHS,
  upgradeCost,
  validateUpgrade,
  type GameState,
  type IdeologyId,
  type MinistryId,
  type ServiceId,
  type StrategyId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore } from '../format';
import gameStyles from '../screens/game.module.css';
import { daysLeft } from './military/progress';
import styles from './views.module.css';

function Stars({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <span className={styles.stars} role="img" aria-label={t('departments.stars', { count, max: MAX_STARS })}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span key={i} className={i < count ? undefined : styles.starEmpty} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

function PolicyPicker<Id extends IdeologyId | StrategyId>({
  kind,
  ids,
  current,
  content,
}: {
  kind: 'ideology' | 'strategy';
  ids: readonly Id[];
  current: Id;
  content: Record<Id, { name: string; summary: string }>;
}) {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [choice, setChoice] = useState<Id>(current);
  if (!game) return null;
  const wait = policyCooldownDays(game, kind);
  const cost = POLICY_CHANGE_COST[kind];
  const apply = () =>
    gameStore
      .getState()
      .dispatch(
        kind === 'ideology'
          ? { type: 'SET_IDEOLOGY', ideology: choice as IdeologyId }
          : { type: 'SET_STRATEGY', strategy: choice as StrategyId },
      );
  const heading = kind === 'ideology' ? t('newGame.ideology') : t('newGame.strategy');
  return (
    <Panel title={heading}>
      <select
        className={styles.select}
        value={choice}
        aria-label={heading}
        onChange={(e) => setChoice(e.target.value as Id)}
      >
        {ids.map((id) => (
          <option key={id} value={id}>
            {id === current ? t('departments.current', { name: content[id].name }) : content[id].name}
          </option>
        ))}
      </select>
      <p className={styles.muted}>{content[choice].summary}</p>
      <div className={styles.actions}>
        <span className={styles.note}>
          {wait > 0
            ? t('departments.policyWait', { count: wait })
            : t('departments.policyCost', { cost: cost.value, months: Math.round(cost.days / 30) })}
        </span>
        <Button variant="primary" disabled={choice === current || wait > 0} onClick={apply}>
          {t('departments.adopt', { name: content[choice].name })}
        </Button>
      </div>
    </Panel>
  );
}

function DepartmentCard({
  game,
  department,
  efficiency,
}: {
  game: GameState;
  department: MinistryId;
  efficiency: number;
}) {
  const { t } = useTranslation();
  const funding = departmentFunding(game, department);
  const months = game.departments.underfundedMonths[department];
  const name = MINISTRY_CONTENT[department].shortName;
  return (
    <article className={styles.ministryCard} aria-label={name} data-testid={`department-${department}`}>
      <span className={styles.ministryName}>{MINISTRY_CONTENT[department].name}</span>
      <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
        <span className={styles.note}>
          {t('departments.efficiency')} <strong>{Math.round(efficiency * 100)}%</strong>{' '}
          <Tooltip label={t('common.why')}>{t('departments.efficiencyWhy')}</Tooltip>
        </span>
        <span className={styles.note}>
          {t('departments.quality', { value: Math.round(departmentQuality(game, department) * 100) })} ·{' '}
          {t('departments.funding', { value: Math.round(funding * 100) })}
        </span>
      </div>
      {funding < UNDERFUNDED_BELOW && months > 0 && (
        <p className={styles.note} data-tone="bad">
          {t('departments.underfunded', { count: months, limit: UNDERFUNDED_MONTHS })}
        </p>
      )}
      <div>
        {DEPARTMENT_CONTENT[department].services.map((service) => {
          const stars = game.departments.stars[department][service.id as ServiceId] ?? 1;
          const running = game.departments.upgrades.find(
            (u) => u.department === department && u.service === service.id,
          );
          const problem = validateUpgrade(game, department, service.id);
          const cost = formatCrore(upgradeCost(game, department, service.id));
          return (
            <div key={service.id} className={styles.serviceRow} data-testid={`service-${service.id}`}>
              <span>
                <div className={styles.personName}>{service.name}</div>
                <div className={styles.muted}>{service.summary}</div>
              </span>
              <Stars count={stars} />
              <span />
              {running ? (
                <span className={styles.tag}>
                  {t('departments.upgrading', { count: daysLeft(running.endsTick, game.clock.tick) })}
                </span>
              ) : stars >= MAX_STARS ? (
                <span className={styles.tag}>{t('departments.maxed')}</span>
              ) : (
                <Button
                  disabled={problem !== null}
                  title={problem ?? undefined}
                  aria-label={t('departments.upgradeLabel', { service: service.name, stars: stars + 1, cost })}
                  onClick={() =>
                    gameStore.getState().dispatch({ type: 'UPGRADE_SERVICE', department, service: service.id })
                  }
                >
                  {t('departments.upgrade', { cost })}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function DepartmentsView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  if (!game) return null;
  const efficiency = allEfficiencies(game);

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.departments')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('departments.subtitle')}</p>
        </div>
      </div>

      <div className={styles.programme} style={{ marginBottom: 16 }}>
        <PolicyPicker
          key={`ideology-${game.politics.ideology}`}
          kind="ideology"
          ids={IDEOLOGIES}
          current={game.politics.ideology}
          content={IDEOLOGY_CONTENT}
        />
        <PolicyPicker
          key={`strategy-${game.politics.strategy}`}
          kind="strategy"
          ids={STRATEGIES}
          current={game.politics.strategy}
          content={STRATEGY_CONTENT}
        />
      </div>

      <div className={styles.departmentGrid}>
        {MINISTRIES.map((m) => (
          <DepartmentCard key={m} game={game} department={m} efficiency={efficiency[m]} />
        ))}
      </div>
    </>
  );
}
