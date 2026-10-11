import { Fragment, useState } from 'react';
import {
  addDays,
  COUNTRY_CONTENT,
  describeOffer,
  formatDate,
  FOCUS_IDS,
  MAX_TRADE_TREATIES,
  partnerOf,
  relationOf,
  relationWord,
  reputationTarget,
  SECTOR_LABELS,
  type GameState,
  type Treaty,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore } from '../format';
import gameStyles from '../screens/game.module.css';
import mapStyles from '../map/world.module.css';
import { AiDebug } from './diplomacy/AiDebug';
import styles from './views.module.css';

const EXPIRING_DAYS = 180;
const name = (id: string) => COUNTRY_CONTENT[id]?.name ?? id;

const TYPE_LABELS: Record<Treaty['type'], string> = {
  trade: 'Trade contract',
  nonAggression: 'Non-aggression pact',
  embassy: 'Embassy',
  sanctions: 'Sanctions',
};

function terms(t: Treaty): string {
  if (t.type === 'trade')
    return `${SECTOR_LABELS[t.terms.sector ?? 'services']} · ${formatCrore(t.terms.value ?? 0)} a year`;
  if (t.type === 'sanctions') return t.parties[0] === 'IND' ? 'Imposed by India' : `Imposed by ${name(t.parties[0])}`;
  return '—';
}

function ends(game: GameState, t: Treaty): string {
  if (t.endTick === null) return 'Open-ended';
  const days = t.endTick - game.clock.tick;
  return `${formatDate(addDays(game.clock.date, Math.max(0, days)))} (${Math.max(0, Math.ceil(days / 30))} mo)`;
}

export function DiplomacyView() {
  const game = useGame((s) => s.game);
  const [debug, setDebug] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!game) return null;

  const { dispatch, openCountry } = gameStore.getState();
  const { diplomacy, clock } = game;
  const trades = diplomacy.treaties.filter((t) => t.type === 'trade');
  const pacts = diplomacy.treaties.filter((t) => t.type === 'nonAggression');
  const embassies = diplomacy.treaties.filter((t) => t.type === 'embassy');
  const expiring = diplomacy.treaties.filter(
    (t) => t.endTick !== null && t.parties[0] === 'IND' && t.endTick - clock.tick <= EXPIRING_DAYS,
  );
  const measures = diplomacy.treaties.filter((t) => t.type === 'sanctions');
  const showDebug = import.meta.env.DEV;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Diplomacy</h1>
          <p className={gameStyles.viewSubtitle}>Treaties, offers, sanctions and the world’s mood</p>
        </div>
        {showDebug && (
          <Button variant="ghost" aria-pressed={debug} onClick={() => setDebug((d) => !d)}>
            {debug ? 'Hide' : 'Show'} AI debug
          </Button>
        )}
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Reputation</span>
          <span className={styles.tileValue} data-testid="reputation">
            {Math.round(diplomacy.reputation)}/100
          </span>
          <span className={styles.tileNote}>
            <Tooltip label="Why?">
              <span className={gameStyles.breakdown}>
                <span>Settling toward</span>
                <span className={gameStyles.breakdownValue}>{Math.round(reputationTarget(game))}</span>
                <span>
                  Pacts ({pacts.length}), trade contracts ({trades.length}) and embassies ({embassies.length}) lift it;
                  breaking a treaty, aggressive war and unprovoked sanctions cost it.
                </span>
              </span>
            </Tooltip>
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>World tension</span>
          <span className={styles.tileValue} data-testid="world-tension">
            {Math.round(diplomacy.worldTension)}/100
          </span>
          <span className={styles.tileNote}>
            {diplomacy.conflicts.length} regional crisis{diplomacy.conflicts.length === 1 ? '' : 'es'}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Trade contracts</span>
          <span className={styles.tileValue} data-testid="trade-count">
            {trades.length}/{MAX_TRADE_TREATIES}
          </span>
          <span className={styles.tileNote}>Customs revenue and sector growth</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Pacts and embassies</span>
          <span className={styles.tileValue}>
            {pacts.length} · {embassies.length}
          </span>
          <span className={styles.tileNote}>Non-aggression pacts · embassies</span>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title="Offers" className={gameStyles.span8}>
          {diplomacy.offers.length === 0 ? (
            <p className={styles.note}>
              No country has a proposal waiting. Friendly nations make offers from time to time.
            </p>
          ) : (
            <ul className={mapStyles.list} aria-label="Offers">
              {diplomacy.offers.map((o) => (
                <li key={o.id} data-testid={`offer-${o.from}`}>
                  <span>
                    <strong>{name(o.from)}</strong> proposes a {o.years}-year {describeOffer(o)}
                    <span className={styles.muted}> · {Math.max(0, o.expiresTick - clock.tick)} days to answer</span>
                  </span>
                  <span className={mapStyles.actions}>
                    <Button variant="primary" onClick={() => dispatch({ type: 'ACCEPT_OFFER', offerId: o.id })}>
                      Accept
                    </Button>
                    <Button onClick={() => dispatch({ type: 'DECLINE_OFFER', offerId: o.id })}>Decline</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Expiring soon" className={gameStyles.span4}>
          {expiring.length === 0 ? (
            <p className={styles.note}>Nothing ends in the next six months.</p>
          ) : (
            <ul className={mapStyles.list} aria-label="Expiring deals">
              {expiring.map((t) => (
                <li key={t.id}>
                  <span>
                    {TYPE_LABELS[t.type]} · {name(partnerOf(t))}
                    <br />
                    <span className={styles.muted}>{ends(game, t)}</span>
                  </span>
                  <Button onClick={() => openCountry(partnerOf(t))}>Renew</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Active treaties" className={gameStyles.span12}>
          {diplomacy.treaties.length === 0 ? (
            <p className={styles.note}>
              No treaties yet. Open the World screen, pick a country, and propose a trade contract, a pact or an
              embassy.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label="Active treaties">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Country</th>
                    <th>Terms</th>
                    <th>Ends</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {diplomacy.treaties.map((t) => {
                    const partner = partnerOf(t);
                    return (
                      <tr key={t.id} data-testid={`treaty-${t.type}-${partner}`}>
                        <td>{TYPE_LABELS[t.type]}</td>
                        <td>
                          <button type="button" className={mapStyles.link} onClick={() => openCountry(partner)}>
                            {name(partner)}
                          </button>
                        </td>
                        <td>{terms(t)}</td>
                        <td>{ends(game, t)}</td>
                        <td>
                          {t.parties[0] === 'IND' && t.type !== 'sanctions' ? (
                            confirming === t.id ? (
                              <span className={mapStyles.actions}>
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    dispatch({ type: 'BREAK_TREATY', treatyId: t.id });
                                    setConfirming(null);
                                  }}
                                >
                                  Confirm: costs reputation
                                </Button>
                                <Button variant="ghost" onClick={() => setConfirming(null)}>
                                  Keep
                                </Button>
                              </span>
                            ) : (
                              <Button
                                onClick={() => setConfirming(t.id)}
                                aria-label={`End ${TYPE_LABELS[t.type]} with ${name(partner)}`}
                              >
                                End early
                              </Button>
                            )
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Sanctions and crises" className={gameStyles.span4}>
          <h3 className={styles.personName}>Sanctions</h3>
          {measures.length === 0 ? (
            <p className={styles.muted}>No sanctions in force.</p>
          ) : (
            <ul className={mapStyles.list}>
              {measures.map((t) => (
                <li key={t.id}>
                  {terms(t)} · {name(partnerOf(t))}
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.personName} style={{ marginTop: 12 }}>
            Crises between other states
          </h3>
          {diplomacy.conflicts.length === 0 ? (
            <p className={styles.muted}>None at the moment.</p>
          ) : (
            <ul className={mapStyles.list} aria-label="Crises">
              {diplomacy.conflicts.map((c) => (
                <li key={c.id}>
                  {c.countries.map(name).join(', ')} · {Math.max(0, Math.ceil((c.endTick - clock.tick) / 30))} mo left
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Major nations" className={gameStyles.span8}>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Major nations">
              <thead>
                <tr>
                  <th>Country</th>
                  <th className={styles.num}>Relation</th>
                  <th>Attitude</th>
                  <th>Last move</th>
                </tr>
              </thead>
              <tbody>
                {FOCUS_IDS.map((id) => {
                  const d = diplomacy.ai[id];
                  const relation = relationOf(game, id);
                  return (
                    <Fragment key={id}>
                      <tr>
                        <td>
                          <button type="button" className={mapStyles.link} onClick={() => openCountry(id)}>
                            {name(id)}
                          </button>
                        </td>
                        <td className={styles.num}>{Math.round(relation)}</td>
                        <td>{relationWord(relation)}</td>
                        <td className={styles.muted}>
                          {d?.acted
                            ? {
                                offerDeal: 'Offered a deal',
                                seekPact: 'Proposed a pact',
                                threaten: 'Issued a warning',
                                sanction: 'Imposed sanctions',
                                declareWar: 'Declared war',
                                idle: '—',
                              }[d.action]
                            : '—'}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {showDebug && debug && <AiDebug game={game} />}
      </div>
    </>
  );
}
