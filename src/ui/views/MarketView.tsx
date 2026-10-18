import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  COUNTRY_CONTENT,
  formatDate,
  GOOD_CONTENT,
  GOODS,
  MAX_CONTRACT_YEARS,
  MAX_SUPPLY_CONTRACTS,
  MAX_TARIFF,
  partnerPrice,
  partnerProblem,
  quotes,
  spreadOf,
  spareForContracts,
  supplyContracts,
  surplus,
  surplusPlan,
  TRADE_PARTNERS,
  validateBuy,
  validateContract,
  validateControl,
  validateSell,
  validateSellAll,
  validateWorldSale,
  WORLD_MARKET_DISCOUNT,
  type GameState,
  type GoodId,
  type TradeBan,
  type TradeSide,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreFine, pct, signed } from '../format';
import gameStyles from '../screens/game.module.css';
import { qty } from './market/quantity';
import { contractTerms } from './market/contractTerms';
import styles from './views.module.css';

const countryName = (id: string) => COUNTRY_CONTENT[id]?.name ?? id;

function PriceWhy({ game, partner, good, side }: { game: GameState; partner: string; good: GoodId; side: TradeSide }) {
  const { t } = useTranslation();
  const spread = spreadOf(game, partner, good, side);
  return (
    <Tooltip label={t('common.why')}>
      <span className={gameStyles.breakdown}>
        {spread.lines.map((l) => (
          <Fragment key={l.label}>
            <span>{l.label}</span>
            <span className={gameStyles.breakdownValue}>{signed(l.value * 100)}%</span>
          </Fragment>
        ))}
      </span>
    </Tooltip>
  );
}

function Rules({ game, good }: { game: GameState; good: GoodId }) {
  const { t } = useTranslation();
  const now = game.market.controls[good];
  const [tariff, setTariff] = useState(Math.round(now.tariff * 100));
  const [quota, setQuota] = useState(now.quota === null ? '' : String(now.quota));
  const [ban, setBan] = useState<TradeBan | 'none'>(now.ban ?? 'none');
  const unit = GOOD_CONTENT[good].unit;
  const control = {
    tariff: tariff / 100,
    quota: quota.trim() === '' ? null : Number(quota),
    ban: ban === 'none' ? null : ban,
  };
  const problem = validateControl(good, control);
  return (
    <details>
      <summary className={styles.note}>
        {t('market.rules')} ·{' '}
        {t('market.rulesNow', {
          tariff: pct(now.tariff, 0),
          quota: now.quota === null ? t('market.quotaNone') : `${qty(now.quota)} ${unit}`,
          ban: t(`market.bans.${now.ban ?? 'none'}`),
        })}
      </summary>
      <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
        <label className={styles.note}>
          {t('market.tariff')}{' '}
          <input
            type="number"
            className={styles.qtyInput}
            min={0}
            max={MAX_TARIFF * 100}
            step={5}
            value={tariff}
            onChange={(e) => setTariff(Math.max(0, Math.min(MAX_TARIFF * 100, Number(e.target.value) || 0)))}
          />
        </label>
        <label className={styles.note}>
          {t('market.quota', { unit })}{' '}
          <input
            type="number"
            className={styles.qtyInput}
            min={0}
            placeholder={t('market.quotaNone')}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </label>
        <select
          className={styles.select}
          aria-label={t('market.ban')}
          value={ban}
          onChange={(e) => setBan(e.target.value as TradeBan | 'none')}
        >
          {(['none', 'export', 'import'] as const).map((b) => (
            <option key={b} value={b}>
              {t(`market.bans.${b}`)}
            </option>
          ))}
        </select>
        <Button
          disabled={problem !== null}
          title={problem ?? undefined}
          aria-label={t('market.applyRulesLabel', { good: GOOD_CONTENT[good].name.toLowerCase() })}
          onClick={() => gameStore.getState().dispatch({ type: 'SET_TRADE_CONTROL', good, control })}
        >
          {t('market.applyRules')}
        </Button>
      </div>
    </details>
  );
}

function GoodCard({ game, good }: { game: GameState; good: GoodId }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const c = GOOD_CONTENT[good];
  const [quantity, setQuantity] = useState(() => Math.max(1, Math.round(surplus(game, good) * 100) / 100 || 1));
  const buyer = quotes(game, good, 'sell')[0];
  const seller = quotes(game, good, 'buy')[0];
  const price = game.market.prices[good];
  const name = c.name.toLowerCase();
  const sellValue = buyer ? formatCrore(quantity * buyer.price) : '';
  const buyValue = seller ? formatCrore(quantity * seller.price) : '';
  const worldValue = formatCrore(quantity * price * WORLD_MARKET_DISCOUNT);
  const sellProblem = buyer ? validateSell(game, good, buyer.partner, quantity) : t('market.noBuyer');
  const buyProblem = seller ? validateBuy(game, good, seller.partner, quantity) : t('market.noSeller');
  const worldProblem = validateWorldSale(game, good, quantity);
  return (
    <div className={styles.facilityCard} data-testid={`good-${good}`}>
      <div>
        <div className={styles.personName}>{c.name}</div>
        <div className={styles.muted}>
          {t('market.price', {
            price: formatCroreFine(price),
            unit: c.unit,
            change: `${price >= c.price ? '+' : ''}${pct(price / c.price - 1, 0)}`,
          })}
        </div>
        <div className={styles.facilityStats}>
          <span>
            {t('market.stockLine', {
              stock: qty(game.industry.stocks[good]),
              surplus: qty(surplus(game, good)),
              imported: qty(game.industry.last.imports[good]),
              unit: c.unit,
            })}
          </span>
          <span>
            {buyer ? (
              <>
                {t('market.bestBuyer', { partner: countryName(buyer.partner), price: formatCroreFine(buyer.price) })}{' '}
                <PriceWhy game={game} partner={buyer.partner} good={good} side="sell" />
              </>
            ) : (
              t('market.noBuyer')
            )}
          </span>
          <span>
            {seller ? (
              <>
                {t('market.bestSeller', { partner: countryName(seller.partner), price: formatCroreFine(seller.price) })}{' '}
                <PriceWhy game={game} partner={seller.partner} good={good} side="buy" />
              </>
            ) : (
              t('market.noSeller')
            )}
          </span>
        </div>
        <Rules key={JSON.stringify(game.market.controls[good])} game={game} good={good} />
      </div>
      <div className={styles.actions}>
        <input
          type="number"
          className={styles.qtyInput}
          min={0}
          step="any"
          value={quantity}
          aria-label={t('market.quantityLabel', { unit: c.unit, good: name })}
          onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
        />
        <Button
          variant="primary"
          disabled={sellProblem !== null}
          title={sellProblem ?? undefined}
          aria-label={
            buyer
              ? t('market.sellLabel', {
                  quantity,
                  unit: c.unit,
                  good: name,
                  partner: countryName(buyer.partner),
                  value: sellValue,
                })
              : t('market.noBuyer')
          }
          onClick={() => buyer && dispatch({ type: 'SELL_GOODS', good, partner: buyer.partner, quantity })}
        >
          {t('market.sell', { value: sellValue })}
        </Button>
        <Button
          disabled={buyProblem !== null}
          title={buyProblem ?? undefined}
          aria-label={
            seller
              ? t('market.buyLabel', {
                  quantity,
                  unit: c.unit,
                  good: name,
                  partner: countryName(seller.partner),
                  value: buyValue,
                })
              : t('market.noSeller')
          }
          onClick={() => seller && dispatch({ type: 'BUY_GOODS', good, partner: seller.partner, quantity })}
        >
          {t('market.buy', { value: buyValue })}
        </Button>
        <Button
          variant="ghost"
          disabled={worldProblem !== null}
          title={worldProblem ?? undefined}
          aria-label={t('market.worldSaleLabel', { quantity, unit: c.unit, good: name, value: worldValue })}
          onClick={() => dispatch({ type: 'SELL_ON_WORLD_MARKET', good, quantity })}
        >
          {t('market.worldSale', { value: worldValue })}
        </Button>
      </div>
    </div>
  );
}

function Contracts({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const contracts = supplyContracts(game);
  const partners = TRADE_PARTNERS.filter((id) => !partnerProblem(game, id));
  const [good, setGood] = useState<GoodId>('steel');
  const [partner, setPartner] = useState(partners[0] ?? '');
  const [side, setSide] = useState<TradeSide>('sell');
  const [quantity, setQuantity] = useState(1);
  const [years, setYears] = useState(2);
  const chosen = partners.includes(partner) ? partner : (partners[0] ?? '');
  const problem = chosen ? validateContract(game, good, chosen, side, quantity, years) : t('market.noPartner');
  const price = chosen ? partnerPrice(game, chosen, good, side) : 0;
  return (
    <Panel title={t('market.contracts')} className={gameStyles.span12}>
      <p className={styles.note}>{t('market.contractsNote', { max: MAX_SUPPLY_CONTRACTS })}</p>
      {contracts.length === 0 ? (
        <p className={styles.note}>{t('market.noContracts')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-testid="supply-contracts">
            <thead>
              <tr>
                <th>{t('market.columns.deal')}</th>
                <th>{t('market.columns.partner')}</th>
                <th className={styles.num}>{t('market.columns.monthly')}</th>
                <th className={styles.num}>{t('market.columns.delivered')}</th>
                <th className={styles.num}>{t('market.columns.ends')}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const other = c.parties[0] === 'IND' ? c.parties[1] : c.parties[0];
                const value = (c.terms.quantity ?? 0) * (c.terms.price ?? 0);
                const delivered = game.market.deliveries[c.id];
                const unit = c.terms.good ? GOOD_CONTENT[c.terms.good].unit : '';
                const short = delivered !== undefined && delivered.quantity < delivered.promised * 0.999;
                return (
                  <tr key={c.id}>
                    <td>{contractTerms(c)}</td>
                    <td>{countryName(other)}</td>
                    <td className={styles.num}>{(c.terms.side === 'sell' ? '+' : '−') + formatCrore(value)}</td>
                    <td className={`${styles.num} ${short ? styles.negative : ''}`} data-testid={`delivered-${c.id}`}>
                      {delivered === undefined
                        ? t('market.notYet')
                        : t('market.delivered', {
                            quantity: qty(delivered.quantity),
                            promised: qty(delivered.promised),
                            unit,
                            value: (c.terms.side === 'sell' ? '+' : '−') + formatCrore(delivered.value),
                          })}
                    </td>
                    <td className={styles.num}>
                      {c.endTick === null ? '—' : formatDate(addDays(game.clock.date, c.endTick - game.clock.tick))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3 className={styles.personName}>{t('market.newContract')}</h3>
      {side === 'sell' && (
        <p className={styles.note} data-testid="contract-spare">
          {t('market.spare', {
            quantity: qty(spareForContracts(game, good)),
            unit: GOOD_CONTENT[good].unit,
            good: GOOD_CONTENT[good].name.toLowerCase(),
          })}
        </p>
      )}
      <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
        <select
          className={styles.select}
          aria-label={t('market.good')}
          value={good}
          onChange={(e) => setGood(e.target.value as GoodId)}
        >
          {GOODS.map((g) => (
            <option key={g} value={g}>
              {GOOD_CONTENT[g].name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={t('market.partner')}
          value={chosen}
          onChange={(e) => setPartner(e.target.value)}
        >
          {partners.map((id) => (
            <option key={id} value={id}>
              {countryName(id)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={t('market.side')}
          value={side}
          onChange={(e) => setSide(e.target.value as TradeSide)}
        >
          {(['sell', 'buy'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`market.sides.${s}`)}
            </option>
          ))}
        </select>
        <input
          type="number"
          className={styles.qtyInput}
          min={0}
          step="any"
          value={quantity}
          aria-label={t('market.quantity')}
          onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
        />
        <select
          className={styles.select}
          aria-label={t('market.years')}
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
        >
          {Array.from({ length: MAX_CONTRACT_YEARS }, (_, i) => i + 1).map((y) => (
            <option key={y} value={y}>
              {t('market.yearsOption', { count: y })}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          disabled={problem !== null}
          title={problem ?? undefined}
          onClick={() =>
            gameStore
              .getState()
              .dispatch({ type: 'SIGN_SUPPLY_CONTRACT', good, partner: chosen, side, quantity, years })
          }
        >
          {t('market.sign', { price: formatCroreFine(price), unit: GOOD_CONTENT[good].unit })}
        </Button>
      </div>
    </Panel>
  );
}

export function MarketView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  if (!game) return null;
  const plan = surplusPlan(game);
  const planValue = plan.reduce((s, p) => s + p.quantity * partnerPrice(game, p.partner, p.good, 'sell'), 0);
  const sellAllProblem = validateSellAll(game);

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.market')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('market.subtitle')}</p>
        </div>
        <Button
          variant="primary"
          disabled={sellAllProblem !== null}
          title={sellAllProblem ?? undefined}
          onClick={() => gameStore.getState().dispatch({ type: 'SELL_ALL_SURPLUS' })}
        >
          {sellAllProblem ? t('market.sellAllNone') : t('market.sellAll', { value: formatCrore(planValue) })}
        </Button>
      </div>

      <div className={gameStyles.grid}>
        <Panel title={t('market.goods')} className={gameStyles.span12}>
          <div className={styles.facilityList}>
            {GOODS.map((g) => (
              <GoodCard key={g} game={game} good={g} />
            ))}
          </div>
        </Panel>
        <Contracts game={game} />
      </div>
    </>
  );
}
