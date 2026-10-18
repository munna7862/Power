import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AGENCIES,
  AGENCY_CONTENT,
  agencyCost,
  civilLibertiesCost,
  EQUIPMENT_CONTENT,
  groupIndian,
  headcountRatio,
  MAX_RECRUIT,
  MAX_UNIT_ORDER,
  MINISTRIES,
  MINISTRY_CONTENT,
  nextEquipment,
  officersForRatio,
  officersPer100k,
  POLICE_UNIT_CONTENT,
  POLICE_UNITS,
  policeRatio,
  policeUnitCost,
  policeUpkeep,
  recruitCost,
  REGIONS,
  START_CRIME,
  stationCapacity,
  stationCost,
  stationsNeeded,
  unitRatio,
  validateAgency,
  validateEquipment,
  validateRecruit,
  validateStations,
  validateUnit,
  type AgencyId,
  type GameState,
  type PoliceUnitId,
  type RegionId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreFine, pct } from '../format';
import gameStyles from '../screens/game.module.css';
import { Bar } from './military/parts';
import { AuditsPanel, OperationsPanel } from './police/OperationsPanels';
import styles from './views.module.css';

const clampQuantity = (value: string, max: number) => Math.max(1, Math.min(max, Math.floor(Number(value) || 1)));
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

function Tiles({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const officers = REGIONS.reduce((s, r) => s + game.police.officers[r], 0);
  const liberties = civilLibertiesCost(game);
  const tier = EQUIPMENT_CONTENT[game.police.equipment - 1];
  return (
    <div className={styles.tiles} style={{ marginBottom: 16 }}>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('police.tiles.officers')}</span>
        <span className={styles.tileValue} data-testid="police-officers">
          {groupIndian(officers)}
        </span>
        <span className={styles.tileNote}>
          {t('police.tiles.per100k', { value: Math.round((officers / game.nation.population) * 1e5) })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('police.tiles.crime')}</span>
        <span className={styles.tileValue}>{average(REGIONS.map((r) => game.security.crime[r])).toFixed(0)}</span>
        <span className={styles.tileNote}>
          {t('police.tiles.crimeNote', { value: average(REGIONS.map((r) => START_CRIME[r])).toFixed(0) })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('police.tiles.liberties')}</span>
        <span className={styles.tileValue} data-testid="civil-liberties">
          {liberties > 0 ? t('police.tiles.libertiesCost', { value: liberties.toFixed(1) }) : '0'}
        </span>
        <span className={styles.tileNote}>{liberties > 0 ? null : t('police.tiles.libertiesNone')}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('police.tiles.equipment')}</span>
        <span className={styles.tileValue}>{game.police.equipment}</span>
        <span className={styles.tileNote}>
          {t('police.tiles.equipmentTier', { tier: game.police.equipment, name: tier?.name ?? '' })}
        </span>
      </div>
    </div>
  );
}

function RegionCard({ game, region }: { game: GameState; region: RegionId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [quantity, setQuantity] = useState(1);
  const name = t(`regions.${region}`);
  const ratio = policeRatio(game, region);
  const toFull = officersForRatio(game, region);
  const stations = stationsNeeded(game.police, region);
  const cost = formatCroreFine(recruitCost(quantity));
  const recruitProblem = validateRecruit(game, region, quantity);
  const dismissProblem = validateRecruit(game, region, -quantity);
  const stationProblem = stations > 0 ? validateStations(game, region, stations) : null;
  return (
    <div className={styles.facilityCard} data-testid={`police-${region}`}>
      <div>
        <div className={styles.personName}>
          {name}{' '}
          <span
            className={styles.coverageCell}
            data-tone={ratio >= 0.98 ? 'good' : ratio >= 0.9 ? 'warning' : 'danger'}
          >
            {t('police.strength', { value: pct(ratio, 0) })}
          </span>
        </div>
        <Bar value={Math.min(ratio, 1.5)} max={1.5} label={t('police.strength', { value: pct(ratio, 0) })} />
        <div className={styles.facilityStats}>
          <span data-testid={`officers-${region}`}>
            {t('police.officersLine', {
              count: groupIndian(game.police.officers[region]),
              per100k: Math.round(officersPer100k(game, region)),
            })}
          </span>
          <span>
            {t('police.stationsLine', {
              count: groupIndian(game.police.stations[region]),
              capacity: groupIndian(stationCapacity(game.police, region)),
            })}
          </span>
          <span>{t('police.crimeLine', { value: game.security.crime[region].toFixed(0) })}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_RECRUIT}
          step={1}
          value={quantity}
          aria-label={t('police.officersLabel', { region: name })}
          onChange={(e) => setQuantity(clampQuantity(e.target.value, MAX_RECRUIT))}
        />
        {toFull > 0 && (
          <Button
            variant="ghost"
            aria-label={t('police.backToStrengthLabel', { region: name })}
            onClick={() => setQuantity(Math.min(MAX_RECRUIT, toFull))}
          >
            {t('police.backToStrength')}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={recruitProblem !== null}
          title={recruitProblem ?? undefined}
          aria-label={t('police.recruitLabel', { count: quantity, region: name, cost })}
          onClick={() => dispatch({ type: 'RECRUIT_POLICE', region, officers: quantity })}
        >
          {t('police.recruit', { cost })}
        </Button>
        <Button
          disabled={dismissProblem !== null}
          title={dismissProblem ?? undefined}
          aria-label={t('police.dismissLabel', { count: quantity, region: name })}
          onClick={() => dispatch({ type: 'RECRUIT_POLICE', region, officers: -quantity })}
        >
          {t('police.dismiss')}
        </Button>
        {stations > 0 && (
          <Button
            disabled={stationProblem !== null}
            title={stationProblem ?? undefined}
            aria-label={t('police.houseThemLabel', {
              count: stations,
              region: name,
              cost: formatCrore(stationCost(stations)),
            })}
            onClick={() => dispatch({ type: 'BUILD_STATION', region, quantity: stations })}
          >
            {t('police.houseThem', { count: stations, cost: formatCrore(stationCost(stations)) })}
          </Button>
        )}
      </div>
    </div>
  );
}

function EquipmentPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const current = EQUIPMENT_CONTENT[game.police.equipment - 1];
  const next = nextEquipment(game.police);
  const problem = validateEquipment(game);
  return (
    <Panel title={t('police.equipment')}>
      <p className={styles.personName}>{t('police.currentTier', { name: current?.name ?? '' })}</p>
      <p className={styles.muted}>{current?.summary}</p>
      {next ? (
        <>
          <p className={styles.note}>
            {next.summary} {t('police.upkeepPerMonth', { cost: formatCrore(next.upkeep) })}
          </p>
          <div className={styles.cardActions}>
            <Button
              variant="primary"
              disabled={problem !== null}
              title={problem ?? undefined}
              onClick={() => gameStore.getState().dispatch({ type: 'UPGRADE_POLICE_EQUIPMENT' })}
            >
              {t('police.upgradeTo', { name: next.name, cost: formatCrore(next.cost) })}
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.note}>{t('police.topTier')}</p>
      )}
      <p className={styles.note}>{t('police.equipmentNote')}</p>
    </Panel>
  );
}

function UnitRow({ game, unit }: { game: GameState; unit: PoliceUnitId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [quantity, setQuantity] = useState(1);
  const c = POLICE_UNIT_CONTENT[unit];
  const cost = formatCroreFine(policeUnitCost(unit, quantity));
  const raiseProblem = validateUnit(game, unit, quantity);
  const disbandProblem = validateUnit(game, unit, -quantity);
  return (
    <div className={styles.facilityCard} data-testid={`unit-${unit}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>{c.summary}</div>
        <div className={styles.facilityStats}>
          {t('police.unitLine', {
            count: game.police.units[unit],
            opening: c.opening,
            cost: formatCroreFine(c.cost),
            upkeep: formatCroreFine(c.upkeep),
          })}
        </div>
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={1}
          max={MAX_UNIT_ORDER}
          step={1}
          value={quantity}
          aria-label={t('police.unitQuantityLabel', { name: c.name.toLowerCase() })}
          onChange={(e) => setQuantity(clampQuantity(e.target.value, MAX_UNIT_ORDER))}
        />
        <Button
          variant="primary"
          disabled={raiseProblem !== null}
          title={raiseProblem ?? undefined}
          aria-label={t('police.raiseLabel', { count: quantity, name: c.name, cost })}
          onClick={() => dispatch({ type: 'RAISE_UNIT', unit, quantity })}
        >
          {t('police.raise', { cost })}
        </Button>
        <Button
          disabled={disbandProblem !== null}
          title={disbandProblem ?? undefined}
          aria-label={t('police.disbandLabel', { count: quantity, name: c.name })}
          onClick={() => dispatch({ type: 'RAISE_UNIT', unit, quantity: -quantity })}
        >
          {t('police.disband')}
        </Button>
      </div>
    </div>
  );
}

function AgencyRow({ game, agency }: { game: GameState; agency: AgencyId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const c = AGENCY_CONTENT[agency];
  const strength = game.police.agencies[agency];
  const up = Math.min(100, strength + 5);
  const down = Math.max(0, strength - 5);
  const upCost = formatCrore(agencyCost(game, agency, up));
  const upProblem = validateAgency(game, agency, up);
  const downProblem = validateAgency(game, agency, down);
  return (
    <div className={styles.facilityCard} data-testid={`agency-${agency}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>{c.summary}</div>
        <Bar value={strength} label={t('police.agencyStrength', { name: c.name })} />
        <div className={styles.facilityStats}>
          {t('police.agencyLine', { value: strength, department: MINISTRY_CONTENT[c.department].shortName })}
        </div>
      </div>
      <div className={styles.actions}>
        <Button
          disabled={downProblem !== null}
          title={downProblem ?? undefined}
          aria-label={t('police.agencyDownLabel', { name: c.name.toLowerCase(), value: down })}
          onClick={() => dispatch({ type: 'FUND_AGENCY', agency, strength: down })}
        >
          {t('police.agencyDown')}
        </Button>
        <Button
          variant="primary"
          disabled={upProblem !== null}
          title={upProblem ?? undefined}
          aria-label={t('police.agencyUpLabel', { name: c.name.toLowerCase(), value: up, cost: upCost })}
          onClick={() => dispatch({ type: 'FUND_AGENCY', agency, strength: up })}
        >
          {t('police.agencyUp', { cost: upCost })}
        </Button>
      </div>
    </div>
  );
}

function LibertiesPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const cost = civilLibertiesCost(game);
  return (
    <Panel title={t('police.liberties')}>
      <p className={styles.note}>
        {t('police.libertiesWhy')}:{' '}
        <strong>{cost > 0 ? t('police.tiles.libertiesCost', { value: cost.toFixed(1) }) : '0'}</strong>{' '}
        <Tooltip label={t('common.why')}>
          <span className={gameStyles.breakdown}>
            {REGIONS.map((r) => (
              <span key={r} style={{ gridColumn: '1 / -1' }}>
                {t('police.libertiesRegion', { region: t(`regions.${r}`), value: pct(headcountRatio(game, r), 0) })}
              </span>
            ))}
            <span style={{ gridColumn: '1 / -1' }}>
              {t('police.libertiesArmed', { value: pct(unitRatio(game, 'armedPolice'), 0) })}
            </span>
          </span>
        </Tooltip>
      </p>
      <p className={styles.note}>{t('police.libertiesNote')}</p>
    </Panel>
  );
}

function RunningCosts({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const upkeep = policeUpkeep(game);
  const lines = MINISTRIES.filter((m) => Math.abs(upkeep[m]) >= 0.5);
  return (
    <Panel title={t('police.runningCosts')}>
      <p className={styles.note}>{t('police.runningCostsNote')}</p>
      {lines.length === 0 ? (
        <p className={styles.note}>{t('police.noRunningCosts')}</p>
      ) : (
        <table className={styles.table} data-testid="police-running-costs">
          <tbody>
            {lines.map((m) => (
              <tr key={m}>
                <td>{MINISTRY_CONTENT[m].shortName}</td>
                <td className={styles.num}>{t('police.perMonth', { cost: formatCrore(upkeep[m]) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function PoliceView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  if (!game) return null;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.police')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('police.subtitle')}</p>
        </div>
      </div>

      <Tiles game={game} />

      <div className={gameStyles.grid}>
        <Panel title={t('police.regions')} className={gameStyles.span12}>
          <p className={styles.note}>{t('police.regionsNote')}</p>
          <div className={styles.facilityList}>
            {REGIONS.map((r) => (
              <RegionCard key={r} game={game} region={r} />
            ))}
          </div>
        </Panel>

        <Panel title={t('police.units')} className={gameStyles.span8}>
          <p className={styles.note}>{t('police.unitsNote')}</p>
          <div className={styles.facilityList}>
            {POLICE_UNITS.map((u) => (
              <UnitRow key={u} game={game} unit={u} />
            ))}
          </div>
        </Panel>
        <div className={`${gameStyles.span4} ${styles.stack}`}>
          <EquipmentPanel game={game} />
          <LibertiesPanel game={game} />
        </div>

        <Panel title={t('police.agencies')} className={gameStyles.span8}>
          <p className={styles.note}>{t('police.agenciesNote')}</p>
          <div className={styles.facilityList}>
            {AGENCIES.map((a) => (
              <AgencyRow key={a} game={game} agency={a} />
            ))}
          </div>
        </Panel>
        <div className={`${gameStyles.span4} ${styles.stack}`}>
          <RunningCosts game={game} />
        </div>

        <OperationsPanel game={game} className={gameStyles.span12} />
        <AuditsPanel game={game} className={gameStyles.span12} />
      </div>
    </>
  );
}
