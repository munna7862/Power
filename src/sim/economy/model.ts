import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, SECTORS, TAXES, type MinistryId, type SectorId, type TaxId } from '../content/ids';
import { departmentQuality } from '../departments/quality';
import { multiplierFor } from '../engine/modifiers';
import { facilityUpkeep } from '../infrastructure/coverage';
import type { BudgetState, EconomyState, ExpenditureLine, FiscalMonth, GameState, RevenueLine } from '../state/types';
import {
  DEFAULT_TAX_RATES,
  ESTABLISHMENT_SHARE,
  NON_TAX_REVENUE_SHARE,
  START_CORRUPTION,
  TAX_AVOIDANCE_CEILING,
  TAX_BASE_SHARE,
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

/** Tax compliance: better with an effective Finance ministry, worse with corruption. 1 at game start. */
export function complianceFactor(financeEfficiency: number, corruption: number): number {
  const raw = (0.92 + 0.08 * Math.min(financeEfficiency, 1.6)) * (1 - corruption * 0.001);
  return raw / (1 - START_CORRUPTION * 0.001);
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
  const finance = ministryEfficiencyFor(budget.allocations.finance, state, 'finance');
  const external = ministryEfficiencyFor(budget.allocations.external, state, 'external');
  const compliance = complianceFactor(finance, economy.corruption);
  const revenueMultiplier = multiplierFor(modifiers, 'economy.revenue');

  const revenue = {} as Record<RevenueLine, number>;
  for (const tax of TAXES) {
    const rate = budget.taxRates[tax];
    let amount = gdpMonth * TAX_BASE_SHARE[tax] * rate * taxYieldFactor(tax, rate) * compliance * revenueMultiplier;
    if (tax === 'customs')
      // Sanctions on many partners can push the multiplier below zero; customs then raises nothing, never less.
      amount *= (0.95 + 0.05 * Math.min(external, 1.6)) * Math.max(0, multiplierFor(modifiers, 'economy.customs'));
    revenue[tax] = amount;
  }
  revenue.nonTax = gdpMonth * NON_TAX_REVENUE_SHARE * revenueMultiplier;

  const spendingMultiplier = multiplierFor(modifiers, 'economy.expenditure');
  const expenditure = {} as Record<ExpenditureLine, number>;
  // Each department pays its allocation plus the running costs of facilities built beyond the opening network.
  const upkeep = facilityUpkeep(state);
  for (const m of MINISTRIES) {
    expenditure[m] = Math.max(0, gdpMonth * budget.allocations[m] * spendingMultiplier + upkeep[m]);
  }
  expenditure.establishment = gdpMonth * ESTABLISHMENT_SHARE;
  expenditure.interest = (economy.debt * economy.interestRate) / 12;

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
