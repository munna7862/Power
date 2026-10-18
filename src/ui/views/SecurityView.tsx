import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allEfficiencies,
  BANKRUPTCY_DEBT_RATIO,
  BANKRUPTCY_MONTHS,
  COUP_RISK_THRESHOLD,
  coupRisk,
  debtToGdp,
  IMPEACHMENT_MONTHS,
  impeachmentThreshold,
  INVESTIGATION_COST,
  INVESTIGATION_DAYS,
  MAX_INVESTIGATIONS,
  MINISTRY_CONTENT,
  OPERATION_KINDS,
  OPERATIONS,
  presidentialSafety,
  REGIONS,
  RIOT_UNREST,
  TENSE_UNREST,
  terrorTarget,
  unrestTarget,
  validateInvestigation,
  operationBlocked,
  type GameState,
  type RegionId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Gauge, Panel, Tooltip } from '../design/primitives';
import { formatCrore, pct, signed } from '../format';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

const unrestColour = (v: number) =>
  v >= RIOT_UNREST ? 'var(--danger)' : v >= TENSE_UNREST ? 'var(--warning)' : 'var(--green)';
const unrestLevel = (v: number) => (v >= RIOT_UNREST ? 'riots' : v >= TENSE_UNREST ? 'tense' : 'calm');

/** Schematic tile map of the six macro-regions, coloured by unrest. Not to scale; it shows no borders. */
const TILES: Record<RegionId, { x: number; y: number; w: number; h: number }> = {
  north: { x: 0, y: 0, w: 190, h: 70 },
  northEast: { x: 200, y: 0, w: 100, h: 70 },
  west: { x: 0, y: 80, w: 95, h: 70 },
  central: { x: 100, y: 80, w: 95, h: 70 },
  east: { x: 205, y: 80, w: 95, h: 70 },
  south: { x: 100, y: 160, w: 95, h: 70 },
};

function UnrestMap({ game }: { game: GameState }) {
  const { t } = useTranslation();
  return (
    <figure className={styles.mapFigure}>
      <svg viewBox="0 0 300 230" role="img" aria-label={t('security.mapLabel')}>
        {REGIONS.map((r) => {
          const tile = TILES[r];
          const v = game.security.unrest[r];
          return (
            <g key={r}>
              <rect
                x={tile.x}
                y={tile.y}
                width={tile.w}
                height={tile.h}
                rx={8}
                fill={unrestColour(v)}
                fillOpacity={0.28}
                stroke={unrestColour(v)}
                strokeWidth={2}
              />
              <text
                x={tile.x + tile.w / 2}
                y={tile.y + tile.h / 2 - 4}
                textAnchor="middle"
                fill="var(--text)"
                fontSize="13"
                fontWeight="700"
              >
                {t(`regions.${r}`)}
              </text>
              <text
                x={tile.x + tile.w / 2}
                y={tile.y + tile.h / 2 + 14}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="12"
              >
                {t('security.mapValue', { value: Math.round(v), level: t(`security.levels.${unrestLevel(v)}`) })}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.note}>{t('security.mapCaption')}</figcaption>
    </figure>
  );
}

function Risk({ name, value, detail, danger }: { name: string; value: string; detail: string; danger: boolean }) {
  return (
    <li className={styles.riskRow} data-danger={danger}>
      <span className={styles.personName}>{name}</span>
      <span>{value}</span>
      <span className={styles.muted}>{detail}</span>
    </li>
  );
}

export function SecurityView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  if (!game) return null;

  const { security, economy, nation, politics, cabinet, clock } = game;
  const eff = allEfficiencies(game);
  const safety = presidentialSafety(game, eff);
  const risk = coupRisk(game);
  const threat = terrorTarget(game, eff);
  const { dispatch, setView } = gameStore.getState();
  const debtRatio = debtToGdp(economy);
  const daysLeft = (tick: number) => Math.max(0, tick - clock.tick);
  const vacant = t('cabinet.vacant');

  const agencies = (['home', 'intelligence', 'disaster', 'antiCorruption'] as const).map((m) => ({
    id: m,
    name: MINISTRY_CONTENT[m].shortName,
    efficiency: eff[m],
    allocation: game.budget.allocations[m],
    minister: cabinet.ministers[m]?.name ?? vacant,
  }));

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.security')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('security.subtitle')}</p>
        </div>
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('security.terror')}</span>
          <span className={styles.tileValue} data-testid="terror-threat">
            {security.terrorThreat.toFixed(0)}/100
          </span>
          <span className={styles.tileNote}>
            {t('security.headingTo', { value: threat.total.toFixed(0) })}{' '}
            <Tooltip label={t('common.why')}>
              <span className={gameStyles.breakdown}>
                {threat.drivers.map((d) => (
                  <Fragment key={d.label}>
                    <span>{d.label}</span>
                    <span className={gameStyles.breakdownValue}>{signed(d.value)}</span>
                  </Fragment>
                ))}
              </span>
            </Tooltip>
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('security.border')}</span>
          <span className={styles.tileValue}>{security.borderTension.toFixed(0)}/100</span>
          <span className={styles.tileNote}>{t('security.borderNote')}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('security.armyLoyalty')}</span>
          <span className={styles.tileValue}>{security.militaryLoyalty.toFixed(0)}/100</span>
          <span className={styles.tileNote}>{t('security.plotsFoiled', { count: security.plotsFoiled })}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('security.attacks')}</span>
          <span className={styles.tileValue}>{security.attacksSuffered}</span>
          <span className={styles.tileNote}>{t('security.livePlots', { count: security.plots.length })}</span>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title={t('security.unrest')} className={gameStyles.span8}>
          <div className={styles.unrestLayout}>
            <UnrestMap game={game} />
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('security.region')}</th>
                    <th className={styles.num}>{t('security.unrestColumn')}</th>
                    <th className={styles.num}>{t('security.headingColumn')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r) => {
                    const target = unrestTarget(game, r, eff);
                    return (
                      <tr key={r}>
                        <td>{t(`regions.${r}`)}</td>
                        <td className={styles.num} style={{ color: unrestColour(security.unrest[r]) }}>
                          {security.unrest[r].toFixed(0)}
                        </td>
                        <td className={styles.num}>{target.total.toFixed(0)}</td>
                        <td>
                          <Tooltip label={t('security.whyRegion', { region: t(`regions.${r}`) })}>
                            <span className={gameStyles.breakdown}>
                              {target.drivers.map((d) => (
                                <Fragment key={d.label}>
                                  <span>{d.label}</span>
                                  <span className={gameStyles.breakdownValue}>{signed(d.value)}</span>
                                </Fragment>
                              ))}
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel title={t('security.safety')} className={gameStyles.span4}>
          <Gauge value={safety} label={t('security.safety')} />
          <p className={styles.note}>{t('security.safetyNote')}</p>
        </Panel>

        <Panel title={t('security.threats')} className={gameStyles.span12}>
          <ul className={styles.riskList} aria-label={t('security.threats')}>
            <Risk
              name={t('security.risks.impeachment')}
              value={t('security.risks.approvalValue', { value: nation.approval.toFixed(1) })}
              detail={t('security.risks.impeachmentNote', {
                months: IMPEACHMENT_MONTHS,
                threshold: impeachmentThreshold(game),
                count: politics.lowApprovalMonths,
              })}
              danger={politics.lowApprovalMonths > 0 || nation.approval < 25}
            />
            <Risk
              name={t('security.risks.coup')}
              value={t('security.risks.riskValue', { value: risk.toFixed(0) })}
              detail={t('security.risks.coupNote', { threshold: COUP_RISK_THRESHOLD })}
              danger={risk > COUP_RISK_THRESHOLD}
            />
            <Risk
              name={t('security.risks.assassination')}
              value={t('security.risks.safetyValue', { value: safety.toFixed(0) })}
              detail={t('security.risks.assassinationNote')}
              danger={safety < 35}
            />
            <Risk
              name={t('security.risks.bankruptcy')}
              value={t('security.risks.debtValue', { value: pct(debtRatio, 0) })}
              detail={t('security.risks.bankruptcyNote', {
                ratio: Math.round(BANKRUPTCY_DEBT_RATIO * 100),
                months: BANKRUPTCY_MONTHS,
                count: security.bankruptMonths,
              })}
              danger={debtRatio > BANKRUPTCY_DEBT_RATIO * 0.8}
            />
          </ul>
        </Panel>

        <Panel title={t('security.operations')} className={gameStyles.span8}>
          {security.plots.length > 0 && (
            <ul className={styles.riskList} aria-label={t('security.plotsLabel')}>
              {security.plots.map((p) => (
                <li key={p.id} className={styles.riskRow} data-danger="true">
                  <span className={styles.personName}>{p.group}</span>
                  <span>{t(`regions.${p.region}`)}</span>
                  <span className={styles.muted}>{t('security.strikesIn', { count: daysLeft(p.strikeTick) })}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.opGrid}>
            {OPERATION_KINDS.map((kind) => {
              const spec = OPERATIONS[kind];
              const active = security.operations.find((o) => o.kind === kind);
              return (
                <div key={kind} className={styles.ministryCard}>
                  <div className={styles.personName}>{t(`security.ops.${kind}.label`)}</div>
                  <p className={styles.muted}>{t(`security.ops.${kind}.summary`)}</p>
                  <p className={styles.note}>{t('decision.costs', { cost: formatCrore(spec.cost) })}</p>
                  <div className={styles.cardActions}>
                    {active ? (
                      <span className={styles.tag}>
                        {t(kind === 'raid' ? 'security.recovering' : 'security.active', {
                          count: daysLeft(active.endsTick),
                        })}
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={operationBlocked(game, kind) !== null}
                        title={operationBlocked(game, kind) ?? undefined}
                        onClick={() => dispatch({ type: 'LAUNCH_OPERATION', kind })}
                      >
                        {t(`security.ops.${kind}.label`)}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={t('security.agencies')} className={gameStyles.span4}>
          <ul className={styles.riskList} aria-label={t('security.agencies')}>
            {agencies.map((a) => (
              <li key={a.id} className={styles.riskRow}>
                <span className={styles.personName}>{a.name}</span>
                <span>{t('security.agencyEfficiency', { value: Math.round(a.efficiency * 100) })}</span>
                <span className={styles.muted}>
                  {t('security.agencyFunding', { share: (a.allocation * 100).toFixed(2), minister: a.minister })}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.cardActions}>
            <Button onClick={() => setView('budget')}>{t('security.adjustBudget')}</Button>
          </div>
        </Panel>

        <Panel title={t('security.inquiries')} className={gameStyles.span12}>
          <p className={styles.note}>
            {t('security.inquiriesNote', {
              corruption: economy.corruption.toFixed(1),
              cost: formatCrore(INVESTIGATION_COST),
              days: INVESTIGATION_DAYS,
              max: MAX_INVESTIGATIONS,
            })}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('security.ministry')}</th>
                <th>{t('security.minister')}</th>
                <th className={styles.num}>{t('cabinet.traits.corruption')}</th>
                <th>{t('security.inquiry')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cabinet.ministers).map(([id, minister]) => {
                const ministry = id as keyof typeof cabinet.ministers;
                const inquiry = security.investigations.find((i) => i.ministry === ministry);
                const blocked = validateInvestigation(game, ministry);
                return (
                  <tr key={id}>
                    <td>{MINISTRY_CONTENT[ministry].shortName}</td>
                    <td>{minister?.name ?? vacant}</td>
                    <td className={styles.num}>{minister ? Math.round(minister.corruption) : '–'}</td>
                    <td>
                      {inquiry ? (
                        <span className={styles.tag}>
                          {t('security.reportsIn', { count: daysLeft(inquiry.resolvesTick) })}
                        </span>
                      ) : (
                        <Button
                          disabled={blocked !== null}
                          title={blocked ?? undefined}
                          aria-label={t('security.investigateName', { ministry: MINISTRY_CONTENT[ministry].shortName })}
                          onClick={() => dispatch({ type: 'LAUNCH_INVESTIGATION', ministry })}
                        >
                          {t('security.investigate')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
