import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  SECTORS,
  strengthView,
  tradeAcceptance,
  tradeCap,
  tradeSizesFor,
  TRADE_YEARS,
  relationDrivers,
  relationLevel,
  relationOf,
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
  type RivalId,
  type SectorId,
  type Treaty,
  type TradeSize,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Panel, Tooltip } from '../../design/primitives';
import { formatCrore, signed } from '../../format';
import { t as translate } from '../../i18n';
import gameStyles from '../../screens/game.module.css';
import { Bar } from '../military/parts';
import views from '../views.module.css';
import styles from '../../map/world.module.css';

const gdpText = (usdBn: number) =>
  usdBn >= 1000
    ? translate('country.trillion', { value: (usdBn / 1000).toFixed(1) })
    : translate('country.billion', { value: Math.round(usdBn) });
const popText = (m: number) =>
  translate('country.million', { value: m >= 100 ? Math.round(m) : m.toFixed(m < 10 ? 1 : 0) });

/** A rival's army as the fog of war lets India see it. */
const strengthText = (view: ReturnType<typeof strengthView>): string => {
  switch (view.kind) {
    case 'unknown':
      return translate('country.strength.unknown');
    case 'estimate':
      return view.high === 0
        ? translate('country.strength.annexed')
        : translate('country.strength.estimate', { low: view.low, high: view.high });
    case 'sighted':
      return translate('country.strength.sighted', { low: view.low, high: view.high, count: view.ageDays });
  }
};

function treatyText(treaty: Treaty, now: number): string {
  const base =
    treaty.type === 'trade'
      ? translate('country.treaty.trade', {
          sector: translate(`economy.sectorNames.${treaty.terms.sector ?? 'services'}`),
          value: formatCrore(treaty.terms.value ?? 0),
        })
      : treaty.type === 'sanctions'
        ? translate(treaty.parties[0] === 'IND' ? 'country.treaty.indiaSanctions' : 'country.treaty.sanctionsOnIndia')
        : translate(`country.treaty.${treaty.type}`);
  return treaty.endTick === null
    ? base
    : translate('country.treaty.left', { base, count: Math.max(0, Math.ceil((treaty.endTick - now) / 30)) });
}

const temperament = (aggression: number) =>
  aggression >= 45 ? 'assertive' : aggression >= 25 ? 'measured' : 'peaceable';

export function CountryPanel({ game, id }: { game: GameState; id: string }) {
  const { t } = useTranslation();
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
  const tradeProblem = chosen ? validateTrade(game, id, sector, chosen.size, years) : t('country.tooSmall');
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
          {t('country.where', { subregion: content.subregion, continent: content.continent })}
          {content.neighbour ? t('country.neighbour') : ''}
          {content.focus ? t('country.major') : ''}
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>{t('country.facts.economy')}</dt>
            <dd>{gdpText(content.gdp)}</dd>
          </div>
          <div>
            <dt>{t('country.facts.population')}</dt>
            <dd>{popText(content.population)}</dd>
          </div>
          <div>
            <dt>{t('country.facts.power')}</dt>
            <dd>
              {Math.round(content.power)}{' '}
              <span className={views.muted}>{t('country.indiaPower', { value: Math.round(power) })}</span>
            </dd>
          </div>
          <div>
            <dt>{t('country.facts.outlook')}</dt>
            <dd style={{ textTransform: 'capitalize' }}>{content.outlook}</dd>
          </div>
          <div>
            <dt>{t('country.facts.temperament')}</dt>
            <dd>{t(`country.temperament.${temperament(content.aggression)}`)}</dd>
          </div>
          <div>
            <dt>{t('country.facts.strengths')}</dt>
            <dd>{content.strengths.map((s) => t(`economy.sectorNames.${s}`)).join(', ')}</dd>
          </div>
        </dl>

        <div>
          <div className={styles.relationRow}>
            <span>
              {t('country.relation')} <strong data-testid="country-relation">{Math.round(relation)}</strong> ·{' '}
              {t(`world.relationLevels.${relationLevel(relation)}`)}
            </span>
            <Tooltip label={t('common.why')}>
              <span className={gameStyles.breakdown}>
                <span className={gameStyles.breakdownHeading}>{t('country.relationHeading')}</span>
                {relationDrivers(game, id)
                  .filter((l) => Math.abs(l.value) >= 0.05 || l.driver === 'base')
                  .map((l) => (
                    <Fragment key={l.driver}>
                      <span>{t(`country.drivers.${l.driver}`)}</span>
                      <span className={gameStyles.breakdownValue}>{signed(l.value, 1)}</span>
                    </Fragment>
                  ))}
              </span>
            </Tooltip>
          </div>
          <Bar value={(relation + 100) / 2} label={t('country.relationWith', { name: content.name })} />
        </div>

        {rival && (
          <p className={views.note}>
            {RIVAL_CONTENT[rival].summary} {t('country.army')}{' '}
            <strong>{strengthText(strengthView(game, rival, eff.intelligence))}</strong> ·{' '}
            {t('country.hostility', { value: Math.round(hostility(game, rival)) })}{' '}
            {atWarWith(game, rival) ? t('country.atWar') : t('country.militaryScreen')}
          </p>
        )}

        <div>
          <h3 className={views.personName}>{t('country.treaties')}</h3>
          {treaties.length === 0 ? (
            <p className={views.muted}>{t('common.none')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('country.treatiesLabel')}>
              {treaties.map((tr) => (
                <li key={tr.id}>
                  <span>{treatyText(tr, game.clock.tick)}</span>
                  {tr.parties[0] === 'IND' && tr.type !== 'sanctions' && partnerOf(tr) === id && (
                    <Button
                      onClick={() => act({ type: 'BREAK_TREATY', treatyId: tr.id })}
                      aria-label={t('country.endLabel', { type: tr.type, name: content.name })}
                    >
                      {t('country.end')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={views.personName}>{t('country.tradeContract')}</h3>
          <div className={styles.form}>
            <label>
              {t('economy.sector')}
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as SectorId)}
                aria-label={t('country.contractSector')}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {t(`economy.sectorNames.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('country.size')}
              <select
                value={chosen?.size ?? size}
                onChange={(e) => setSize(e.target.value as TradeSize)}
                aria-label={t('country.contractSize')}
              >
                {sizes.map((s) => (
                  <option key={s.size} value={s.size}>
                    {t('country.sizeOption', { size: t(`country.sizes.${s.size}`), value: formatCrore(s.value) })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('country.term')}
              <select
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                aria-label={t('country.contractTerm')}
              >
                {TRADE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {t('common.years', { count: y })}
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
              {odds ? t('country.proposeOdds', { chance: Math.round(odds.chance * 100) }) : t('country.propose')}
            </Button>
            {odds && (
              <Tooltip label={t('country.odds')}>
                <span className={gameStyles.breakdown}>
                  {odds.lines.map((l) => (
                    <Fragment key={l.label}>
                      <span>{l.label}</span>
                      <span className={gameStyles.breakdownValue}>{signed(l.value * 100, 0)}%</span>
                    </Fragment>
                  ))}
                  <span>{t('country.largestDeal')}</span>
                  <span className={gameStyles.breakdownValue}>{formatCrore(tradeCap(id))}</span>
                  <span>{t('country.contractsHeld')}</span>
                  <span className={gameStyles.breakdownValue}>
                    {game.diplomacy.treaties.filter((x) => x.type === 'trade').length}/{MAX_TRADE_TREATIES}
                  </span>
                </span>
              </Tooltip>
            )}
          </div>
          {tradeProblem && <p className={styles.blocked}>{tradeProblem}</p>}
        </div>

        <div>
          <h3 className={views.personName}>{t('nav.views.diplomacy')}</h3>
          <div className={styles.actions}>
            <Button disabled={pactProblem !== null} onClick={() => act({ type: 'PROPOSE_PACT', country: id })}>
              {t('country.proposePact', { chance: Math.round(pact.chance * 100) })}
            </Button>
            <Button disabled={embassyProblem !== null} onClick={() => act({ type: 'OPEN_EMBASSY', country: id })}>
              {t('country.openEmbassy', { cost: formatCrore(EMBASSY.cost) })}
            </Button>
          </div>
          {(pactProblem ?? embassyProblem) && <p className={styles.blocked}>{pactProblem ?? embassyProblem}</p>}

          <div className={styles.actions} style={{ marginTop: 8 }} role="group" aria-label={t('country.sendAid')}>
            {(Object.keys(AID) as AidSize[]).map((s) => (
              <Button
                key={s}
                disabled={validateAid(game, id, s) !== null}
                title={
                  validateAid(game, id, s) ??
                  t('country.aidEffect', { relation: AID[s].relation, reputation: AID[s].reputation })
                }
                onClick={() => act({ type: 'SEND_AID', country: id, size: s })}
              >
                {t('country.aid', { size: t(`country.sizes.${s}`), cost: formatCrore(AID[s].cost) })}
              </Button>
            ))}
          </div>

          <div className={styles.actions} style={{ marginTop: 8 }}>
            {cs.sanctioned ? (
              <Button
                disabled={validateLift(game, id) !== null}
                onClick={() => act({ type: 'LIFT_SANCTIONS', country: id })}
              >
                {t('country.lift')}
              </Button>
            ) : confirm === 'sanctions' ? (
              <>
                <Button variant="primary" onClick={() => act({ type: 'IMPOSE_SANCTIONS', country: id })}>
                  {t('country.confirmSanctions', { name: content.name })}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <Button disabled={validateSanctions(game, id) !== null} onClick={() => setConfirm('sanctions')}>
                {t('country.impose')}
              </Button>
            )}
          </div>
          {confirm === 'sanctions' && (
            <p className={styles.blocked}>
              {relation > SANCTIONS.provokedBelow
                ? t('country.sanctionsWarningUnprovoked', { relation: SANCTIONS.relation })
                : t('country.sanctionsWarning', { relation: SANCTIONS.relation })}
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
