import { Fragment, useState } from 'react';
import {
  AID,
  atWarWith,
  COUNTRY_CONTENT,
  EMBASSY,
  hostility,
  indiaPower,
  MAX_TRADE_TREATIES,
  pactAcceptance,
  partnerOf,
  RIVAL_CONTENT,
  RIVALS,
  SANCTIONS,
  SECTOR_LABELS,
  SECTORS,
  strengthView,
  tradeAcceptance,
  tradeCap,
  tradeSizesFor,
  TRADE_SIZES,
  TRADE_YEARS,
  relationDrivers,
  relationOf,
  relationWord,
  treatiesWith,
  validateAid,
  validateEmbassy,
  validateLift,
  validatePact,
  validateSanctions,
  validateTrade,
  allEfficiencies,
  type AidSize,
  type GameState,
  type RelationLine,
  type RivalId,
  type SectorId,
  type TradeSize,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel, Tooltip } from '../../design/primitives';
import { formatCrore, signed } from '../../format';
import gameStyles from '../../screens/game.module.css';
import { Bar } from '../military/parts';
import views from '../views.module.css';
import styles from '../../map/world.module.css';

const DRIVER_LABELS: Record<RelationLine['driver'], string> = {
  base: 'Starting attitude',
  ideology: 'Ideology match',
  trade: 'Trade contracts',
  embassy: 'Embassy',
  pact: 'Non-aggression pact',
  sanctions: 'Sanctions',
  reputation: 'India’s reputation',
  incidents: 'Recent incidents',
  war: 'At war',
  tension: 'World tension',
};

const gdpText = (usdBn: number) => (usdBn >= 1000 ? `$${(usdBn / 1000).toFixed(1)} tn` : `$${Math.round(usdBn)} bn`);
const popText = (m: number) => (m >= 100 ? `${Math.round(m)} m` : `${m.toFixed(m < 10 ? 1 : 0)} m`);

const strengthText = (view: ReturnType<typeof strengthView>): string => {
  switch (view.kind) {
    case 'unknown':
      return 'unknown until a recon operation reveals it';
    case 'estimate':
      return view.high === 0 ? 'annexed' : 'about ' + view.low + '–' + view.high + ' (rough estimate)';
    case 'sighted':
      return view.low + '–' + view.high + ' (recon ' + view.ageDays + ' days old)';
  }
};

export function CountryPanel({ game, id }: { game: GameState; id: string }) {
  const content = COUNTRY_CONTENT[id];
  const [sector, setSector] = useState<SectorId>('tech');
  const [size, setSize] = useState<TradeSize>('small');
  const [years, setYears] = useState<number>(3);
  const [confirm, setConfirm] = useState<'sanctions' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  if (!content) return null;

  const { dispatch } = gameStore.getState();
  const act = (command: Parameters<typeof dispatch>[0]) => {
    const ok = dispatch(command);
    const last = gameStore.getState().game?.log.at(-1);
    setResult(ok && last ? last.title : null);
    setConfirm(null);
  };

  const cs = game.diplomacy.countries[id];
  if (!cs) return null;
  const relation = relationOf(game, id);
  const treaties = treatiesWith(game, id);
  const sizes = tradeSizesFor(game, id);
  const chosen = sizes.find((s) => s.size === size) ?? sizes[0];
  const odds = chosen ? tradeAcceptance(game, id, sector, chosen.value) : null;
  const tradeProblem = chosen
    ? validateTrade(game, id, sector, chosen.size, years)
    : 'Too small an economy for a contract.';
  const pactProblem = validatePact(game, id);
  const pact = pactAcceptance(game, id);
  const embassyProblem = validateEmbassy(game, id);
  const rival = (RIVALS as readonly string[]).includes(id) ? (id as RivalId) : null;
  const eff = allEfficiencies(game);
  const power = indiaPower(game);

  return (
    <Panel title={content.name} className={gameStyles.span12}>
      <div className={styles.stack} data-testid="country-panel" data-country={id}>
        <p className={views.muted}>
          {content.subregion}, {content.continent}
          {content.neighbour ? ' · Neighbour' : ''}
          {content.focus ? ' · Major actor' : ''}
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>Economy</dt>
            <dd>{gdpText(content.gdp)}</dd>
          </div>
          <div>
            <dt>Population</dt>
            <dd>{popText(content.population)}</dd>
          </div>
          <div>
            <dt>Power</dt>
            <dd>
              {Math.round(content.power)} <span className={views.muted}>(India {Math.round(power)})</span>
            </dd>
          </div>
          <div>
            <dt>Outlook</dt>
            <dd style={{ textTransform: 'capitalize' }}>{content.outlook}</dd>
          </div>
          <div>
            <dt>Temperament</dt>
            <dd>{content.aggression >= 45 ? 'Assertive' : content.aggression >= 25 ? 'Measured' : 'Peaceable'}</dd>
          </div>
          <div>
            <dt>Strong in</dt>
            <dd>{content.strengths.map((s) => SECTOR_LABELS[s]).join(', ')}</dd>
          </div>
        </dl>

        <div>
          <div className={styles.relationRow}>
            <span>
              Relation with India: <strong data-testid="country-relation">{Math.round(relation)}</strong> ·{' '}
              {relationWord(relation)}
            </span>
            <Tooltip label="Why?">
              <span className={gameStyles.breakdown}>
                <span className={gameStyles.breakdownHeading}>Where this relation is heading</span>
                {relationDrivers(game, id)
                  .filter((l) => Math.abs(l.value) >= 0.05 || l.driver === 'base')
                  .map((l) => (
                    <Fragment key={l.driver}>
                      <span>{DRIVER_LABELS[l.driver]}</span>
                      <span className={gameStyles.breakdownValue}>{signed(l.value, 1)}</span>
                    </Fragment>
                  ))}
              </span>
            </Tooltip>
          </div>
          <Bar value={(relation + 100) / 2} label={`Relation with ${content.name}`} />
        </div>

        {rival && (
          <p className={views.note}>
            {RIVAL_CONTENT[rival].summary} Army strength:{' '}
            <strong>{strengthText(strengthView(game, rival, eff.intelligence))}</strong> · Hostility{' '}
            {Math.round(hostility(game, rival))}.{' '}
            {atWarWith(game, rival)
              ? 'At war: see the Military screen.'
              : 'Recon and war are run from the Military screen.'}
          </p>
        )}

        <div>
          <h3 className={views.personName}>Treaties and measures</h3>
          {treaties.length === 0 ? (
            <p className={views.muted}>None.</p>
          ) : (
            <ul className={styles.list} aria-label="Treaties with this country">
              {treaties.map((t) => (
                <li key={t.id}>
                  <span>
                    {t.type === 'trade' &&
                      `Trade: ${SECTOR_LABELS[t.terms.sector ?? 'services']}, ${formatCrore(t.terms.value ?? 0)} a year`}
                    {t.type === 'nonAggression' && 'Non-aggression pact'}
                    {t.type === 'embassy' && 'Embassy'}
                    {t.type === 'sanctions' && (t.parties[0] === 'IND' ? 'India’s sanctions' : 'Sanctions on India')}
                    {t.endTick !== null &&
                      ` · ${Math.max(0, Math.ceil((t.endTick - game.clock.tick) / 30))} months left`}
                  </span>
                  {t.parties[0] === 'IND' && t.type !== 'sanctions' && partnerOf(t) === id && (
                    <Button
                      onClick={() => act({ type: 'BREAK_TREATY', treatyId: t.id })}
                      aria-label={`End ${t.type} with ${content.name}`}
                    >
                      End
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={views.personName}>Trade contract</h3>
          <div className={styles.form}>
            <label>
              Sector
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as SectorId)}
                aria-label="Contract sector"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Size
              <select
                value={chosen?.size ?? size}
                onChange={(e) => setSize(e.target.value as TradeSize)}
                aria-label="Contract size"
              >
                {sizes.map((s) => (
                  <option key={s.size} value={s.size}>
                    {TRADE_SIZES[s.size].label} · {formatCrore(s.value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Term
              <select value={years} onChange={(e) => setYears(Number(e.target.value))} aria-label="Contract term">
                {TRADE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y} year{y === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 8 }}>
            <Button
              variant="primary"
              disabled={tradeProblem !== null}
              onClick={() => chosen && act({ type: 'PROPOSE_TRADE', country: id, sector, size: chosen.size, years })}
            >
              Propose contract{odds ? ` (${Math.round(odds.chance * 100)}%)` : ''}
            </Button>
            {odds && (
              <Tooltip label="Odds">
                <span className={gameStyles.breakdown}>
                  {odds.lines.map((l) => (
                    <Fragment key={l.label}>
                      <span>{l.label}</span>
                      <span className={gameStyles.breakdownValue}>{signed(l.value * 100, 0)}%</span>
                    </Fragment>
                  ))}
                  <span>Largest deal this economy can take</span>
                  <span className={gameStyles.breakdownValue}>{formatCrore(tradeCap(id))}</span>
                  <span>Contracts held</span>
                  <span className={gameStyles.breakdownValue}>
                    {game.diplomacy.treaties.filter((t) => t.type === 'trade').length}/{MAX_TRADE_TREATIES}
                  </span>
                </span>
              </Tooltip>
            )}
          </div>
          {tradeProblem && <p className={styles.blocked}>{tradeProblem}</p>}
        </div>

        <div>
          <h3 className={views.personName}>Diplomacy</h3>
          <div className={styles.actions}>
            <Button disabled={pactProblem !== null} onClick={() => act({ type: 'PROPOSE_PACT', country: id })}>
              Propose non-aggression pact ({Math.round(pact.chance * 100)}%)
            </Button>
            <Button disabled={embassyProblem !== null} onClick={() => act({ type: 'OPEN_EMBASSY', country: id })}>
              Open embassy ({formatCrore(EMBASSY.cost)})
            </Button>
          </div>
          {(pactProblem ?? embassyProblem) && <p className={styles.blocked}>{pactProblem ?? embassyProblem}</p>}

          <div className={styles.actions} style={{ marginTop: 8 }} role="group" aria-label="Send aid">
            {(Object.keys(AID) as AidSize[]).map((s) => (
              <Button
                key={s}
                disabled={validateAid(game, id, s) !== null}
                title={validateAid(game, id, s) ?? `Relation +${AID[s].relation}, reputation +${AID[s].reputation}`}
                onClick={() => act({ type: 'SEND_AID', country: id, size: s })}
              >
                Aid: {AID[s].label.split(' ')[0]} ({formatCrore(AID[s].cost)})
              </Button>
            ))}
          </div>

          <div className={styles.actions} style={{ marginTop: 8 }}>
            {cs.sanctioned ? (
              <Button
                disabled={validateLift(game, id) !== null}
                onClick={() => act({ type: 'LIFT_SANCTIONS', country: id })}
              >
                Lift sanctions
              </Button>
            ) : confirm === 'sanctions' ? (
              <>
                <Button variant="primary" onClick={() => act({ type: 'IMPOSE_SANCTIONS', country: id })}>
                  Confirm sanctions on {content.name}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button disabled={validateSanctions(game, id) !== null} onClick={() => setConfirm('sanctions')}>
                Impose sanctions
              </Button>
            )}
          </div>
          {confirm === 'sanctions' && (
            <p className={styles.blocked}>
              Ends trade contracts, relation {SANCTIONS.relation}, and costs customs revenue
              {relation > SANCTIONS.provokedBelow ? ' and some reputation, as the move looks unprovoked' : ''}.
            </p>
          )}
        </div>

        {result && (
          <p className={views.note} role="status" data-testid="country-result">
            {result}
          </p>
        )}
      </div>
    </Panel>
  );
}
