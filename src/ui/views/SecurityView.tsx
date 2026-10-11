import { Fragment } from 'react';
import {
  allEfficiencies,
  BANKRUPTCY_DEBT_RATIO,
  BANKRUPTCY_MONTHS,
  COUP_RISK_THRESHOLD,
  coupRisk,
  debtToGdp,
  IMPEACHMENT_MONTHS,
  IMPEACHMENT_THRESHOLD,
  INVESTIGATION_COST,
  INVESTIGATION_DAYS,
  MAX_INVESTIGATIONS,
  MINISTRY_CONTENT,
  OPERATION_KINDS,
  OPERATIONS,
  presidentialSafety,
  REGION_LABELS,
  REGIONS,
  RIOT_UNREST,
  TENSE_UNREST,
  terrorTarget,
  unrestTarget,
  validateInvestigation,
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
const unrestWord = (v: number) => (v >= RIOT_UNREST ? 'Riots' : v >= TENSE_UNREST ? 'Tense' : 'Calm');

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
  return (
    <figure className={styles.mapFigure}>
      <svg viewBox="0 0 300 230" role="img" aria-label="Unrest by region (schematic map)">
        {REGIONS.map((r) => {
          const t = TILES[r];
          const v = game.security.unrest[r];
          return (
            <g key={r}>
              <rect
                x={t.x}
                y={t.y}
                width={t.w}
                height={t.h}
                rx={8}
                fill={unrestColour(v)}
                fillOpacity={0.28}
                stroke={unrestColour(v)}
                strokeWidth={2}
              />
              <text
                x={t.x + t.w / 2}
                y={t.y + t.h / 2 - 4}
                textAnchor="middle"
                fill="var(--text)"
                fontSize="13"
                fontWeight="700"
              >
                {REGION_LABELS[r]}
              </text>
              <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="12">
                {Math.round(v)} · {unrestWord(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.note}>
        Schematic map: regions are not to scale and no borders are drawn. Unrest here is caused by jobs, prices,
        corruption, approval and policing: never by religion or caste.
      </figcaption>
    </figure>
  );
}

function Risk({ label, value, note, danger }: { label: string; value: string; note: string; danger: boolean }) {
  return (
    <li className={styles.riskRow} data-danger={danger}>
      <span className={styles.personName}>{label}</span>
      <span>{value}</span>
      <span className={styles.muted}>{note}</span>
    </li>
  );
}

export function SecurityView() {
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

  const agencies = (['home', 'intelligence', 'disaster', 'antiCorruption'] as const).map((m) => ({
    id: m,
    name: MINISTRY_CONTENT[m].shortName,
    efficiency: eff[m],
    allocation: game.budget.allocations[m],
    minister: cabinet.ministers[m]?.name ?? 'Vacant',
  }));

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Security</h1>
          <p className={gameStyles.viewSubtitle}>Unrest, terror, corruption and threats to your presidency</p>
        </div>
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Terror threat</span>
          <span className={styles.tileValue} data-testid="terror-threat">
            {security.terrorThreat.toFixed(0)}/100
          </span>
          <span className={styles.tileNote}>
            Heading to {threat.total.toFixed(0)}{' '}
            <Tooltip label="Why?">
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
          <span className={styles.tileLabel}>Border tension</span>
          <span className={styles.tileValue}>{security.borderTension.toFixed(0)}/100</span>
          <span className={styles.tileNote}>Diplomacy takes this over in Phase 5</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Army loyalty</span>
          <span className={styles.tileValue}>{security.militaryLoyalty.toFixed(0)}/100</span>
          <span className={styles.tileNote}>Plots foiled: {security.plotsFoiled}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Attacks suffered</span>
          <span className={styles.tileValue}>{security.attacksSuffered}</span>
          <span className={styles.tileNote}>
            {security.plots.length} plot{security.plots.length === 1 ? '' : 's'} live
          </span>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title="Regional unrest" className={gameStyles.span8}>
          <div className={styles.unrestLayout}>
            <UnrestMap game={game} />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Region</th>
                  <th className={styles.num}>Unrest</th>
                  <th className={styles.num}>Heading to</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => {
                  const target = unrestTarget(game, r, eff);
                  return (
                    <tr key={r}>
                      <td>{REGION_LABELS[r]}</td>
                      <td className={styles.num} style={{ color: unrestColour(security.unrest[r]) }}>
                        {security.unrest[r].toFixed(0)}
                      </td>
                      <td className={styles.num}>{target.total.toFixed(0)}</td>
                      <td>
                        <Tooltip label={`Why ${REGION_LABELS[r]}?`}>
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
        </Panel>

        <Panel title="Presidential safety" className={gameStyles.span4}>
          <Gauge value={safety} label="Presidential safety" />
          <p className={styles.note}>
            Rises with police and intelligence funding and loyal Home, Defence and Intelligence ministers; falls with
            the terror threat.
          </p>
        </Panel>

        <Panel title="Threats to your presidency" className={gameStyles.span12}>
          <ul className={styles.riskList} aria-label="Threats to your presidency">
            <Risk
              label="Impeachment"
              value={`Approval ${nation.approval.toFixed(1)}%`}
              note={`Parliament acts after ${IMPEACHMENT_MONTHS} months below ${IMPEACHMENT_THRESHOLD}% (${politics.lowApprovalMonths} so far)`}
              danger={politics.lowApprovalMonths > 0 || nation.approval < 25}
            />
            <Risk
              label="Coup"
              value={`Risk ${risk.toFixed(0)}/100`}
              note={`Generals become restless above ${COUP_RISK_THRESHOLD}. Keep the defence minister loyal and approval high.`}
              danger={risk > COUP_RISK_THRESHOLD}
            />
            <Risk
              label="Assassination"
              value={`Safety ${safety.toFixed(0)}/100`}
              note="Attempts follow the terror threat; funding and loyal guards decide whether they succeed."
              danger={safety < 35}
            />
            <Risk
              label="Bankruptcy"
              value={`Debt ${pct(debtRatio, 0)} of GDP`}
              note={`Default if debt stays above ${Math.round(BANKRUPTCY_DEBT_RATIO * 100)}% for ${BANKRUPTCY_MONTHS} months (${security.bankruptMonths} so far)`}
              danger={debtRatio > BANKRUPTCY_DEBT_RATIO * 0.8}
            />
          </ul>
        </Panel>

        <Panel title="Counter-terror operations" className={gameStyles.span8}>
          {security.plots.length > 0 && (
            <ul className={styles.riskList} aria-label="Live plots">
              {security.plots.map((p) => (
                <li key={p.id} className={styles.riskRow} data-danger="true">
                  <span className={styles.personName}>{p.group}</span>
                  <span>{REGION_LABELS[p.region]}</span>
                  <span className={styles.muted}>Expected to strike in about {daysLeft(p.strikeTick)} days</span>
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
                  <div className={styles.personName}>{spec.label}</div>
                  <p className={styles.muted}>{spec.summary}</p>
                  <p className={styles.note}>Costs {formatCrore(spec.cost)}</p>
                  <div className={styles.cardActions}>
                    {active ? (
                      <span className={styles.tag}>
                        {kind === 'raid' ? 'Recovering' : 'Active'}: {daysLeft(active.endsTick)} days
                      </span>
                    ) : (
                      <Button variant="primary" onClick={() => dispatch({ type: 'LAUNCH_OPERATION', kind })}>
                        {spec.label}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Agencies" className={gameStyles.span4}>
          <ul className={styles.riskList} aria-label="Agencies">
            {agencies.map((a) => (
              <li key={a.id} className={styles.riskRow}>
                <span className={styles.personName}>{a.name}</span>
                <span>{Math.round(a.efficiency * 100)}% efficiency</span>
                <span className={styles.muted}>
                  {(a.allocation * 100).toFixed(2)}% of GDP · {a.minister}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.cardActions}>
            <Button onClick={() => setView('budget')}>Adjust in Budget</Button>
          </div>
        </Panel>

        <Panel title="Anti-corruption inquiries" className={gameStyles.span12}>
          <p className={styles.note}>
            National corruption index {economy.corruption.toFixed(1)}/100. An inquiry costs{' '}
            {formatCrore(INVESTIGATION_COST)}, takes about {INVESTIGATION_DAYS} days and may expose a minister; the
            agency runs up to {MAX_INVESTIGATIONS} at a time. A better-funded Anti-corruption ministry finds more.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ministry</th>
                <th>Minister</th>
                <th className={styles.num}>Corruption</th>
                <th>Inquiry</th>
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
                    <td>{minister?.name ?? 'Vacant'}</td>
                    <td className={styles.num}>{minister ? Math.round(minister.corruption) : '–'}</td>
                    <td>
                      {inquiry ? (
                        <span className={styles.tag}>Reports in {daysLeft(inquiry.resolvesTick)} days</span>
                      ) : (
                        <Button
                          disabled={blocked !== null}
                          title={blocked ?? undefined}
                          aria-label={`Investigate ${MINISTRY_CONTENT[ministry].shortName}`}
                          onClick={() => dispatch({ type: 'LAUNCH_INVESTIGATION', ministry })}
                        >
                          Investigate
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
