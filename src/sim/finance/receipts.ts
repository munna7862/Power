import { RECEIPT_SOURCES, type GameState, type ReceiptSource } from '../state/types';

/** A month with no one-off receipts yet. */
export const noReceipts = (): Record<ReceiptSource, number> =>
  Object.fromEntries(RECEIPT_SOURCES.map((s) => [s, 0])) as Record<ReceiptSource, number>;

/** Sum of a month's one-off receipts, ₹ crore. */
export const totalReceipts = (receipts: Record<ReceiptSource, number>): number =>
  RECEIPT_SOURCES.reduce((sum, s) => sum + receipts[s], 0);

/**
 * Pays a one-off receipt into the treasury and records it under its source for this month's figures. Every
 * one-off inflow goes through here, so the Finance screen accounts for each rupee that reaches the treasury
 * outside the monthly settlement.
 */
export function receive(state: GameState, source: ReceiptSource, amount: number): GameState {
  if (amount <= 0) return state;
  const { receipts } = state.economy;
  return {
    ...state,
    nation: { ...state.nation, treasury: state.nation.treasury + amount },
    economy: { ...state.economy, receipts: { ...receipts, [source]: receipts[source] + amount } },
  };
}
