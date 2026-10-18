import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  COUNTRY_CONTENT,
  formatDate,
  FOCUS_IDS,
  MAX_TRADE_TREATIES,
  partnerOf,
  relationLevel,
  relationOf,
  reputationTarget,
  type GameState,
  type Offer,
  type Treaty,
  validateOffer,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore } from '../format';
import { t as translate } from '../i18n';
import gameStyles from '../screens/game.module.css';
import mapStyles from '../map/world.module.css';
import { AiDebug } from './diplomacy/AiDebug';
import styles from './views.module.css';

const EXPIRING_DAYS = 180;
const name = (id: string) => COUNTRY_CONTENT[id]?.name ?? id;
const typeName = (type: Treaty['type']) => translate(`diplomacy.types.${type}`);

function terms(t: Treaty): string {
  if (t.type === 'trade') {
    return translate('diplomacy.tradeTerms', {
      sector: translate(`economy.sectorNames.${t.terms.sector ?? 'services'}`),
      value: formatCrore(t.terms.value ?? 0),
    });
  }
  if (t.type === 'sanctions') {
    return t.parties[0] === 'IND'
      ? translate('diplomacy.imposedByIndia')
      : translate('diplomacy.imposedBy', { name: name(t.parties[0]) });
  }
  return '—';
}

function ends(game: GameState, t: Treaty): string {
  if (t.endTick === null) return translate('diplomacy.openEnded');
  const days = t.endTick - game.clock.tick;
  return translate('diplomacy.endsOn', {
    date: formatDate(addDays(game.clock.date, Math.max(0, days))),
    months: Math.max(0, Math.ceil(days / 30)),
  });
}

function offerText(o: Offer): string {
  return o.type === 'trade'
    ? translate('diplomacy.offerTrade', {
        years: o.years,
        sector: translate(`diplomacy.offerSectors.${o.terms.sector ?? 'services'}`),
        value: formatCrore(o.terms.value ?? 0),
      })
    : translate('diplomacy.offerPact', { years: o.years });
}

export function DiplomacyView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [debug, setDebug] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!game) return null;

  const { dispatch, openCountry } = gameStore.getState();
  const { diplomacy, clock } = game;
  const trades = diplomacy.treaties.filter((x) => x.type === 'trade');
  const pacts = diplomacy.treaties.filter((x) => x.type === 'nonAggression');
  const embassies = diplomacy.treaties.filter((x) => x.type === 'embassy');
  const expiring = diplomacy.treaties.filter(
    (x) => x.endTick !== null && x.parties[0] === 'IND' && x.endTick - clock.tick <= EXPIRING_DAYS,
  );
  const measures = diplomacy.treaties.filter((x) => x.type === 'sanctions');
  const showDebug = import.meta.env.DEV;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.diplomacy')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('diplomacy.subtitle')}</p>
        </div>
        {showDebug && (
          <Button variant="ghost" aria-pressed={debug} onClick={() => setDebug((d) => !d)}>
            {debug ? t('diplomacy.hideDebug') : t('diplomacy.showDebug')}
          </Button>
        )}
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('diplomacy.reputation')}</span>
          <span className={styles.tileValue} data-testid="reputation">
            {Math.round(diplomacy.reputation)}/100
          </span>
          <span className={styles.tileNote}>
            <Tooltip label={t('common.why')}>
              <span className={gameStyles.breakdown}>
                <span>{t('diplomacy.settling')}</span>
                <span className={gameStyles.breakdownValue}>{Math.round(reputationTarget(game))}</span>
                <span>
                  {t('diplomacy.reputationNote', {
                    pacts: pacts.length,
                    trades: trades.length,
                    embassies: embassies.length,
                  })}
                </span>
              </span>
            </Tooltip>
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('diplomacy.tension')}</span>
          <span className={styles.tileValue} data-testid="world-tension">
            {Math.round(diplomacy.worldTension)}/100
          </span>
          <span className={styles.tileNote}>{t('diplomacy.crisesCount', { count: diplomacy.conflicts.length })}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('diplomacy.trade')}</span>
          <span className={styles.tileValue} data-testid="trade-count">
            {trades.length}/{MAX_TRADE_TREATIES}
          </span>
          <span className={styles.tileNote}>{t('diplomacy.tradeNote')}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('diplomacy.pactsEmbassies')}</span>
          <span className={styles.tileValue}>
            {pacts.length} · {embassies.length}
          </span>
          <span className={styles.tileNote}>{t('diplomacy.pactsEmbassiesNote')}</span>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title={t('diplomacy.offers')} className={gameStyles.span8}>
          {diplomacy.offers.length === 0 ? (
            <p className={styles.note}>{t('diplomacy.noOffers')}</p>
          ) : (
            <ul className={mapStyles.list} aria-label={t('diplomacy.offers')}>
              {diplomacy.offers.map((o) => (
                <li key={o.id} data-testid={`offer-${o.from}`}>
                  <span>
                    <strong>{name(o.from)}</strong> {offerText(o)}
                    <span className={styles.muted}>
                      {' '}
                      · {t('diplomacy.daysToAnswer', { count: Math.max(0, o.expiresTick - clock.tick) })}
                    </span>
                  </span>
                  <span className={mapStyles.actions}>
                    <Button
                      variant="primary"
                      disabled={validateOffer(game, o.id) !== null}
                      title={validateOffer(game, o.id) ?? undefined}
                      onClick={() => dispatch({ type: 'ACCEPT_OFFER', offerId: o.id })}
                    >
                      {t('diplomacy.accept')}
                    </Button>
                    <Button onClick={() => dispatch({ type: 'DECLINE_OFFER', offerId: o.id })}>
                      {t('diplomacy.decline')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('diplomacy.expiring')} className={gameStyles.span4}>
          {expiring.length === 0 ? (
            <p className={styles.note}>{t('diplomacy.nothingExpiring')}</p>
          ) : (
            <ul className={mapStyles.list} aria-label={t('diplomacy.expiringLabel')}>
              {expiring.map((x) => (
                <li key={x.id}>
                  <span>
                    {typeName(x.type)} · {name(partnerOf(x))}
                    <br />
                    <span className={styles.muted}>{ends(game, x)}</span>
                  </span>
                  <Button onClick={() => openCountry(partnerOf(x))}>{t('diplomacy.renew')}</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('diplomacy.active')} className={gameStyles.span12}>
          {diplomacy.treaties.length === 0 ? (
            <p className={styles.note}>{t('diplomacy.noTreaties')}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label={t('diplomacy.active')}>
                <thead>
                  <tr>
                    <th>{t('diplomacy.columns.type')}</th>
                    <th>{t('diplomacy.columns.country')}</th>
                    <th>{t('diplomacy.columns.terms')}</th>
                    <th>{t('diplomacy.columns.ends')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {diplomacy.treaties.map((x) => {
                    const partner = partnerOf(x);
                    return (
                      <tr key={x.id} data-testid={`treaty-${x.type}-${partner}`}>
                        <td>{typeName(x.type)}</td>
                        <td>
                          <button type="button" className={mapStyles.link} onClick={() => openCountry(partner)}>
                            {name(partner)}
                          </button>
                        </td>
                        <td>{terms(x)}</td>
                        <td>{ends(game, x)}</td>
                        <td>
                          {x.parties[0] === 'IND' && x.type !== 'sanctions' ? (
                            confirming === x.id ? (
                              <span className={mapStyles.actions}>
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    dispatch({ type: 'BREAK_TREATY', treatyId: x.id });
                                    setConfirming(null);
                                  }}
                                >
                                  {t('diplomacy.confirmBreak')}
                                </Button>
                                <Button variant="ghost" onClick={() => setConfirming(null)}>
                                  {t('diplomacy.keep')}
                                </Button>
                              </span>
                            ) : (
                              <Button
                                onClick={() => setConfirming(x.id)}
                                aria-label={t('diplomacy.endLabel', { type: typeName(x.type), name: name(partner) })}
                              >
                                {t('diplomacy.endEarly')}
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

        <Panel title={t('diplomacy.sanctionsCrises')} className={gameStyles.span4}>
          <h3 className={styles.personName}>{t('diplomacy.types.sanctions')}</h3>
          {measures.length === 0 ? (
            <p className={styles.muted}>{t('diplomacy.noSanctions')}</p>
          ) : (
            <ul className={mapStyles.list}>
              {measures.map((x) => (
                <li key={x.id}>
                  {terms(x)} · {name(partnerOf(x))}
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.personName} style={{ marginTop: 12 }}>
            {t('diplomacy.crisesOthers')}
          </h3>
          {diplomacy.conflicts.length === 0 ? (
            <p className={styles.muted}>{t('diplomacy.noCrises')}</p>
          ) : (
            <ul className={mapStyles.list} aria-label={t('diplomacy.crisesLabel')}>
              {diplomacy.conflicts.map((c) => (
                <li key={c.id}>
                  {t('diplomacy.crisisRow', {
                    countries: c.countries.map(name).join(', '),
                    months: Math.max(0, Math.ceil((c.endTick - clock.tick) / 30)),
                  })}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('diplomacy.major')} className={gameStyles.span8}>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label={t('diplomacy.major')}>
              <thead>
                <tr>
                  <th>{t('diplomacy.columns.country')}</th>
                  <th className={styles.num}>{t('diplomacy.columns.relation')}</th>
                  <th>{t('diplomacy.columns.attitude')}</th>
                  <th>{t('diplomacy.columns.lastMove')}</th>
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
                        <td>{t(`world.relationLevels.${relationLevel(relation)}`)}</td>
                        <td className={styles.muted}>{d?.acted ? t(`diplomacy.moves.${d.action}`) : '—'}</td>
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
