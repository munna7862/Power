import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, SECTORS, TAXES, type MinistryId, type SectorId, type TaxId } from '../content/ids';
import { departmentQuality, serviceStars, starQuality } from '../departments/quality';
import { multiplierFor } from '../engine/modifiers';
import { exportRevenue, plantUpkeep } from '../energy/grid';
import {
  climateBeyondTax,
  goodsCustomsDelta,
  OPENING_SHORTAGE_SHARE,
  privateProfitDelta,
  shortageShareOf,
  stateProfitDelta,
} from '../industry/flows';
import { facilityUpkeep } from '../infrastructure/coverage';
import { policeUpkeep } from '../police/strength';
import type { BudgetState, EconomyState, ExpenditureLine, FiscalMonth, GameState, RevenueLine } from '../state/types';
import {
  COMPLIANCE_PER_CORRUPTION,
  CORPORATE_CLIMATE_ELASTICITY,
  DEFAULT_TAX_RATES,
  ESTABLISHMENT_SHARE,
  GST_JOBS_ELASTICITY,
  GST_SHORTAGE_WEIGHT,
  INCOME_TAX_JOBS_ELASTICITY,
  MIN_TAX_FACTOR,
  NON_TAX_REVENUE_SHARE,
  SECTOR_START_SHARE,
  START_CORRUPTION,
  START_UNEMPLOYMENT,
  TAX_AVOIDANCE_CEILING,
  TAX_BASE_SHARE,
  TAX_SECTOR_WEIGHTS,
} from './constants';

/**
 * Pure economic formulas shared by the monthly systems, the budget preview in
 * the UI and the balance bots. Nothing here touches the RNG.
 */

export function realGdp(economy: EconomyState): number {
  return SECTORS.reduce((sum, s) => sum + economy.sectors[s].output, 0);
}

/** Nominal GDP as an annual rate, ₹ crore. */
export function nominalGdp(economy: EconomyState): number {
  return realGdp(economy) * economy.priceIndex;
}

export function debtToGdp(economy: EconomyState): number {
  return economy.debt / nominalGdp(economy);
}

export function sectorShare(economy: EconomyState, sector: SectorId): number {
  return economy.sectors[sector].output / realGdp(economy);
}

/** Share of the tax base still declared at this rate (Laffer-style avoidance), normalised to 1 at default rates. */
export function taxYieldFactor(tax: TaxId, rate: number): number {
  const ceiling = TAX_AVOIDANCE_CEILING[tax];
  const avoidance = (r: number) => Math.max(0, 1 - 0.8 * (r / ceiling) ** 2);
  return avoidance(rate) / avoidance(DEFAULT_TAX_RATES[tax]);
}

/** Share of every ministry's money that still does its job once the national corruption index takes its cut. 1 at game start. */
export function nationalLeakageFactor(corruption: number): number {
  return (1 - 0.12 * (corruption / 100)) / (1 - 0.12 * (START_CORRUPTION / 100));
}

/** Efficiency of a department: 1 = adequately funded and well run. Funding × service stars × national corruption; roughly 0–2. */
export function ministryEfficiency(
  state: Pick<GameState, 'budget' | 'departments' | 'modifiers' | 'economy'>,
  ministry: MinistryId,
): number {
  return ministryEfficiencyFor(state.budget.allocations[ministry], state, ministry);
}

export function ministryEfficiencyFor(
  allocation: number,
  state: Pick<GameState, 'departments' | 'modifiers' | 'economy'>,
  ministry: MinistryId,
): number {
  const funding = allocation / MINISTRY_CONTENT[ministry].defaultAllocation;
  const spendingMultiplier = multiplierFor(state.modifiers, 'economy.expenditure');
  const fundingFactor = Math.sqrt(Math.max(0, Math.min(funding * spendingMultiplier, 3)));
  return fundingFactor * departmentQuality(state, ministry) * nationalLeakageFactor(state.economy.corruption);
}

export function allEfficiencies(
  state: Pick<GameState, 'budget' | 'departments' | 'modifiers' | 'economy'>,
): Record<MinistryId, number> {
  return Object.fromEntries(MINISTRIES.map((m) => [m, ministryEfficiency(state, m)])) as Record<MinistryId, number>;
}

/**
 * How well tax is collected: the Finance department's efficiency, with the Tax administration service's stars in
 * place of the department's average (the same at the start, when every service has the same rating).
 */
export function taxAdministration(
  state: Pick<GameState, 'departments' | 'modifiers' | 'economy'>,
  financeAllocation: number,
): number {
  const finance = ministryEfficiencyFor(financeAllocation, state, 'finance');
  return (
    (finance * starQuality(serviceStars(state, 'finance', 'taxAdministration'))) / departmentQuality(state, 'finance')
  );
}

/** Tax compliance: better with good tax administration, worse with corruption (against the opening corruption). */
export function complianceFactor(administration: number, corruption: number): number {
  const raw = (0.92 + 0.08 * Math.min(administration, 1.6)) * (1 - corruption * COMPLIANCE_PER_CORRUPTION);
  return raw / (1 - START_CORRUPTION * COMPLIANCE_PER_CORRUPTION);
}

/** A tax base from jobs: more people in work means more people paying (income tax by default). 1 at game start. */
export function employmentTaxFactor(unemployment: number, elasticity = INCOME_TAX_JOBS_ELASTICITY): number {
  return Math.max(MIN_TAX_FACTOR, 1 + elasticity * (START_UNEMPLOYMENT - unemployment));
}

const weightedMix = (shares: Record<SectorId, number>, weights: Record<SectorId, number>): number =>
  SECTORS.reduce((sum, s) => sum + shares[s] * weights[s], 0);

/** A tax base from the sector mix: how much more (or less) taxable today's economy is than the opening one. */
export function sectorMixFactor(economy: EconomyState, tax: Exclude<TaxId, 'customs'>): number {
  const total = realGdp(economy);
  const shares = Object.fromEntries(SECTORS.map((s) => [s, economy.sectors[s].output / total])) as Record<
    SectorId,
    number
  >;
  return weightedMix(shares, TAX_SECTOR_WEIGHTS[tax]) / weightedMix(SECTOR_START_SHARE, TAX_SECTOR_WEIGHTS[tax]);
}

/** Multipliers on a tax's base, each 1 at the start; the Budget screen's "Why?" names them. */
export type TaxFactorId =
  'avoidance' | 'compliance' | 'modifiers' | 'sectorMix' | 'jobs' | 'climate' | 'shortages' | 'trade';
/** Amounts added to a tax, each 0 at the start. */
export type TaxAdditionId = 'privatePlants' | 'importedGoods';

export interface TaxBreakdown {
  /** Monthly GDP × base share × rate: what the tax would raise with every factor at 1. */
  base: number;
  factors: { id: TaxFactorId; value: number }[];
  additions: { id: TaxAdditionId; value: number }[];
  /** base × every factor + every addition, never below zero. */
  total: number;
}

/**
 * One month of one tax, with its causes: the single formula behind the fiscal settlement, the budget preview,
 * the daily figures and the Budget screen's "Why?" tooltip.
 */
export function taxBreakdown(
  state: GameState,
  budget: Pick<BudgetState, 'taxRates' | 'allocations'>,
  tax: TaxId,
): TaxBreakdown {
  const { economy, modifiers } = state;
  const rate = budget.taxRates[tax];
  const base = (nominalGdp(economy) / 12) * TAX_BASE_SHARE[tax] * rate;
  const factors: TaxBreakdown['factors'] = [
    { id: 'avoidance', value: taxYieldFactor(tax, rate) },
    {
      id: 'compliance',
      value: complianceFactor(taxAdministration(state, budget.allocations.finance), economy.corruption),
    },
    { id: 'modifiers', value: multiplierFor(modifiers, 'economy.revenue') },
  ];
  const additions: TaxBreakdown['additions'] = [];
  if (tax !== 'customs') factors.push({ id: 'sectorMix', value: sectorMixFactor(economy, tax) });
  if (tax === 'income') factors.push({ id: 'jobs', value: employmentTaxFactor(economy.unemployment) });
  if (tax === 'corporate') {
    const climate = 1 + CORPORATE_CLIMATE_ELASTICITY * (climateBeyondTax(state) - 1);
    factors.push({ id: 'climate', value: Math.max(MIN_TAX_FACTOR, climate) });
    // Since Phase 8: corporate tax on private plants' profits, against the opening settlement.
    additions.push({ id: 'privatePlants', value: rate * privateProfitDelta(state) });
  }
  if (tax === 'gst') {
    factors.push({ id: 'jobs', value: employmentTaxFactor(economy.unemployment, GST_JOBS_ELASTICITY) });
    const unmet = shortageShareOf(state.industry.last) - OPENING_SHORTAGE_SHARE;
    factors.push({ id: 'shortages', value: Math.max(MIN_TAX_FACTOR, 1 - GST_SHORTAGE_WEIGHT * unmet) });
  }
  if (tax === 'customs') {
    const external = ministryEfficiencyFor(budget.allocations.external, state, 'external');
    // Sanctions on many partners can push the multiplier below zero; customs then raises nothing, never less.
    const trade = (0.95 + 0.05 * Math.min(external, 1.6)) * Math.max(0, multiplierFor(modifiers, 'economy.customs'));
    factors.push({ id: 'trade', value: trade });
    // Since Phase 8: tariffs on imported goods, against the opening settlement.
    additions.push({ id: 'importedGoods', value: goodsCustomsDelta(state) });
  }
  const total =
    base * factors.reduce((product, f) => product * f.value, 1) + additions.reduce((sum, a) => sum + a.value, 0);
  // Each line is floored at zero (DEF-10).
  return { base, factors, additions, total: Math.max(0, total) };
}

/** Ceiling on the market rate; beyond it a government defaults (bankruptcy ending arrives in Phase 3). */
export const MAX_INTEREST_RATE = 0.35;

/** Average rate on public debt: rises with the debt load, inflation and large deficits (bond-market nerves). */
export function interestRateFor(debtRatio: number, inflation: number, deficitRatio = 0): number {
  const rate =
    0.065 +
    0.15 * Math.max(0, debtRatio - 0.6) +
    0.6 * Math.max(0, inflation - 0.05) +
    0.3 * Math.max(0, deficitRatio - 0.04);
  return Math.min(rate, MAX_INTEREST_RATE);
}

/** Interest due this month on all loans, ₹ crore. */
export const loanInterest = (economy: Pick<EconomyState, 'loans'>): number =>
  economy.loans.reduce((s, l) => s + (l.principal * l.rate) / 12, 0);

export interface FiscalProjection {
  revenue: Record<RevenueLine, number>;
  expenditure: Record<ExpenditureLine, number>;
  totalRevenue: number;
  totalExpenditure: number;
  balance: number;
  /** Annualised balance as a share of GDP (negative = deficit). */
  balanceToGdp: number;
}

/**
 * One month of revenue and spending for the given budget, without random noise.
 * Used for monthly settlement and for previewing a proposed budget.
 */
export function projectMonth(
  state: GameState,
  budget: Pick<BudgetState, 'taxRates' | 'allocations'>,
): FiscalProjection {
  const { economy, modifiers } = state;
  const gdpMonth = nominalGdp(economy) / 12;
  const revenueMultiplier = multiplierFor(modifiers, 'economy.revenue');

  const revenue = {} as Record<RevenueLine, number>;
  for (const tax of TAXES) revenue[tax] = taxBreakdown(state, budget, tax).total;
  // Fees, dividends, state plants' profits (against the opening settlement, since Phase 8) and power sold to
  // neighbours, floored at zero (DEF-10).
  revenue.nonTax = Math.max(
    0,
    gdpMonth * NON_TAX_REVENUE_SHARE * revenueMultiplier + exportRevenue(state) + stateProfitDelta(state),
  );

  const spendingMultiplier = multiplierFor(modifiers, 'economy.expenditure');
  const expenditure = {} as Record<ExpenditureLine, number>;
  // Each department pays its allocation plus the running costs of facilities, police, agencies and power plants
  // beyond the opening ones (whose costs the allocation already covers).
  const facilities = facilityUpkeep(state);
  const police = policeUpkeep(state);
  const plants = plantUpkeep(state);
  for (const m of MINISTRIES) {
    expenditure[m] = Math.max(
      0,
      gdpMonth * budget.allocations[m] * spendingMultiplier + facilities[m] + police[m] + plants[m],
    );
  }
  expenditure.establishment = gdpMonth * ESTABLISHMENT_SHARE;
  // Public debt at its average rate, and loans at the rates agreed with each lender.
  expenditure.interest = (economy.debt * economy.interestRate) / 12 + loanInterest(economy);

  const totalRevenue = Object.values(revenue).reduce((a, b) => a + b, 0);
  const totalExpenditure = Object.values(expenditure).reduce((a, b) => a + b, 0);
  const balance = totalRevenue - totalExpenditure;
  return {
    revenue,
    expenditure,
    totalRevenue,
    totalExpenditure,
    balance,
    balanceToGdp: (balance * 12) / nominalGdp(economy),
  };
}

/** Annualised deficit of the last settled month as a share of GDP (positive = deficit). */
export function lastDeficitRatio(economy: EconomyState, fallback = 0.025): number {
  const last: FiscalMonth | null = economy.lastMonth;
  return last ? (-last.balance * 12) / nominalGdp(economy) : fallback;
}
