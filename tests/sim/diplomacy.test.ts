import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  choiceUtility,
  COUNTRY_CONTENT,
  COUNTRY_PICKS,
  countriesInConflict,
  COUNTRY_LIST,
  dispatch,
  FOCUS_IDS,
  hashState,
  parseSave,
  pendingView,
  pickCountry,
  projectMonth,
  raiseEvent,
  relationDrivers,
  relationOf,
  relationTarget,
  relationWord,
  RIVAL_CONTENT,
  RIVALS,
  scoreActions,
  serializeSave,
  startWar,
  tradeAcceptance,
  tradeSizesFor,
  UNAVAILABLE,
  bestAction,
  type AiAction,
  type Command,
  type GameState,
} from '../../src/sim';
import { EVENT_CONTENT } from '../../src/sim/content/events';
import { performAction, runFocusAi } from '../../src/sim/diplomacy/ai';
import { logIncident } from '../../src/sim/diplomacy/world';
import { fireEvent } from '../../src/sim/events/engine';
import { patchCountry } from '../../src/sim/diplomacy/relations';
import { Rng } from '../../src/sim/engine/rng';
import { declarationChance } from '../../src/sim/military/rivals';
import { SYSTEMS } from '../../src/sim/systems';
import { calm, deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

/** A friendly partner with an embassy, so proposals are very likely to be accepted. */
const warm = (state: GameState, id: string): GameState =>
  patchCountry(patchCountry(state, id, { relation: 90 }), id, { embassy: true });

/** Proposes until one is accepted (the roll uses the game's own RNG, so a few tries may be needed). */
function signTrade(state: GameState, country: string, sector: 'tech' | 'energy' | 'agriculture' = 'tech'): GameState {
  let s = warm(state, country);
  for (let i = 0; i < 12; i++) {
    const before = s.diplomacy.treaties.length;
    s = run(s, { type: 'PROPOSE_TRADE', country, sector, size: 'small', years: 3 });
    if (s.diplomacy.treaties.length > before) return s;
    s = patchCountry(s, country, { proposalReadyTick: 0, relation: 90 });
  }
  throw new Error('no trade contract was accepted');
}

describe('world content', () => {
  it('has about 195 countries, with about 20 focus nations including the rivals', () => {
    expect(COUNTRY_LIST.length).toBeGreaterThanOrEqual(190);
    expect(COUNTRY_LIST.length).toBeLessThanOrEqual(215);
    expect(FOCUS_IDS.length).toBeGreaterThanOrEqual(18);
    expect(FOCUS_IDS.length).toBeLessThanOrEqual(22);
    for (const id of RIVALS) expect(FOCUS_IDS).toContain(id);
  });

  it('keeps the rivals’ military profiles in step with their country records', () => {
    for (const id of RIVALS) expect(RIVAL_CONTENT[id].name).toBe(COUNTRY_CONTENT[id]?.name);
  });

  it('opens with a relation, reputation and no treaties', () => {
    const s = newGame();
    expect(Object.keys(s.diplomacy.countries)).toHaveLength(COUNTRY_LIST.length);
    expect(s.diplomacy.treaties).toEqual([]);
    expect(s.diplomacy.reputation).toBeGreaterThan(0);
    for (const c of COUNTRY_LIST) expect(relationOf(s, c.id)).toBe(c.relation);
  });
});

describe('relations', () => {
  it('explains the relation target as the sum of its drivers', () => {
    const s = newGame();
    for (const id of ['USA', 'CHN', 'PAK']) {
      const total = relationDrivers(s, id).reduce((sum, l) => sum + l.value, 0);
      expect(relationTarget(s, id)).toBeCloseTo(Math.max(-100, Math.min(100, total)), 6);
    }
  });

  it('warms with an embassy, trade and a pact, and cools under sanctions or at war', () => {
    const s = newGame();
    const base = relationTarget(s, 'JPN');
    expect(relationTarget(warm(s, 'JPN'), 'JPN')).toBeGreaterThan(base);
    expect(relationTarget(patchCountry(s, 'JPN', { sanctioned: true }), 'JPN')).toBeLessThan(base);
    expect(relationTarget(patchCountry(s, 'JPN', { incidents: 60 }), 'JPN')).toBeLessThan(base);
  });

  it('drifts toward the target month by month', () => {
    const s = patchCountry(newGame(), 'DEU', { relation: -60 });
    const later = advanceDays(s, 100);
    expect(relationOf(later, 'DEU')).toBeGreaterThan(-60);
  });
});

describe('trade contracts', () => {
  it('adds customs revenue and sector growth for its term, and records the treaty', () => {
    const s = newGame();
    const before = projectMonth(s, s.budget).revenue.customs;
    const signed = signTrade(s, 'USA', 'tech');
    const treaty = signed.diplomacy.treaties.find((t) => t.type === 'trade');
    expect(treaty).toMatchObject({ type: 'trade', parties: ['IND', 'USA'], terms: { sector: 'tech' } });
    expect(treaty!.endTick).toBe(treaty!.startTick + 3 * 365);
    expect(projectMonth(signed, signed.budget).revenue.customs).toBeGreaterThan(before);
    const mods = signed.modifiers.filter((m) => m.source === `treaty-${treaty!.id}`);
    expect(mods.map((m) => m.target).sort()).toEqual(['economy.customs', 'economy.growth.tech']);
    expect(signed.log.at(-1)?.category).toBe('diplomacy');
  });

  it('gives the same customs bonus whatever the customs rate was on the day of signing (DEF-01)', () => {
    const atRate = (s: GameState, customs: number): GameState => ({
      ...s,
      budget: { ...s.budget, taxRates: { ...s.budget.taxRates, customs } },
    });
    const bonus = (s: GameState) => s.modifiers.find((m) => m.target === 'economy.customs')!.value;
    const normal = signTrade(newGame(), 'USA', 'tech');
    const signedAtZero = signTrade(atRate(newGame(), 0), 'USA', 'tech');
    expect(bonus(signedAtZero)).toBeCloseTo(bonus(normal), 9);
    expect(bonus(signedAtZero)).toBeLessThan(0.2);
    // Raising customs afterwards brings in no more than a contract signed at that rate would.
    const raised = atRate(signedAtZero, 0.1);
    expect(projectMonth(raised, raised.budget).revenue.customs).toBeCloseTo(
      projectMonth(normal, normal.budget).revenue.customs,
      0,
    );
  });

  it('shows the odds the AI will use, and refuses blocked proposals', () => {
    const s = newGame();
    const low = tradeAcceptance(s, 'USA', 'tech', 50_000).chance;
    expect(tradeAcceptance(warm(s, 'USA'), 'USA', 'tech', 50_000).chance).toBeGreaterThan(low);
    expect(tradeAcceptance(patchCountry(s, 'USA', { sanctioned: true }), 'USA', 'tech', 50_000).chance).toBe(0);
    const cmd = { type: 'PROPOSE_TRADE', country: 'XXX', sector: 'tech', size: 'small', years: 3 } as const;
    expect(dispatch(s, cmd).ok).toBe(false);
    expect(dispatch(s, { ...cmd, country: 'USA', years: 2 }).ok).toBe(false);
    // Tuvalu’s economy is far too small for a contract of any size.
    expect(tradeSizesFor(s, 'TUV')).toEqual([]);
    expect(dispatch(s, { ...cmd, country: 'TUV' }).ok).toBe(false);
  });

  it('refuses a duplicate contract and more than the limit', () => {
    let s = signTrade(newGame(), 'USA', 'tech');
    expect(dispatch(s, { type: 'PROPOSE_TRADE', country: 'USA', sector: 'tech', size: 'small', years: 1 }).ok).toBe(
      false,
    );
    for (const id of ['JPN', 'DEU', 'FRA', 'GBR', 'KOR']) s = signTrade(s, id, 'tech');
    expect(s.diplomacy.treaties.filter((t) => t.type === 'trade')).toHaveLength(6);
    const result = dispatch(warm(s, 'AUS'), {
      type: 'PROPOSE_TRADE',
      country: 'AUS',
      sector: 'agriculture',
      size: 'small',
      years: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('is turned down when relations are poor, which delays the next try', () => {
    let s = patchCountry(newGame(), 'CHN', { relation: -80 });
    expect(tradeAcceptance(s, 'CHN', 'industry', 50_000).chance).toBe(0);
    s = run(s, { type: 'PROPOSE_TRADE', country: 'CHN', sector: 'industry', size: 'small', years: 1 });
    expect(s.diplomacy.treaties).toEqual([]);
    expect(s.diplomacy.countries.CHN!.proposalReadyTick).toBeGreaterThan(s.clock.tick);
    expect(dispatch(s, { type: 'PROPOSE_TRADE', country: 'CHN', sector: 'industry', size: 'small', years: 1 }).ok).toBe(
      false,
    );
  });

  it('breaking a contract removes its effects and costs reputation and goodwill', () => {
    const signed = signTrade(newGame(), 'USA');
    const treaty = signed.diplomacy.treaties.find((t) => t.type === 'trade')!;
    const broken = run(signed, { type: 'BREAK_TREATY', treatyId: treaty.id });
    expect(broken.diplomacy.treaties).toHaveLength(0);
    expect(broken.modifiers.some((m) => m.source === `treaty-${treaty.id}`)).toBe(false);
    expect(broken.diplomacy.reputation).toBeLessThan(signed.diplomacy.reputation);
    expect(relationOf(broken, 'USA')).toBeLessThan(relationOf(signed, 'USA'));
  });

  it('ends on its own at the end date, and its modifiers lapse with it', () => {
    const signed = signTrade(newGame(), 'JPN');
    const later = calm(signed, 3 * 365 + 40);
    expect(later.diplomacy.treaties.filter((t) => t.type === 'trade')).toHaveLength(0);
    expect(later.log.some((e) => e.title.startsWith('Trade contract with Japan has ended'))).toBe(true);
  });
});

describe('pacts, embassies, aid and sanctions', () => {
  it('a pact stops a rival from declaring war, and breaking it by attacking costs standing', () => {
    // Without the approval and leadership systems, so a hands-off game is still running after 400 days.
    let s = advanceDays(
      newGame(),
      400,
      SYSTEMS.filter((x) => x.id !== 'approval' && x.id !== 'leadership'),
    );
    s = patchCountry(s, 'PAK', { relation: -15 });
    s = { ...s, military: { ...s.military, deterrence: 10 } };
    expect(declarationChance(s, 'PAK')).toBeGreaterThan(0);
    let pacted = warm(s, 'PAK');
    for (let i = 0; i < 12 && !pacted.diplomacy.treaties.some((t) => t.type === 'nonAggression'); i++) {
      pacted = patchCountry(run(pacted, { type: 'PROPOSE_PACT', country: 'PAK' }), 'PAK', {
        proposalReadyTick: 0,
        relation: 90,
      });
    }
    expect(pacted.diplomacy.treaties.some((t) => t.type === 'nonAggression')).toBe(true);
    expect(declarationChance(pacted, 'PAK')).toBe(0);

    const attacked = run(pacted, { type: 'DECLARE_WAR', rival: 'PAK' });
    expect(attacked.diplomacy.treaties.some((t) => t.type === 'nonAggression')).toBe(false);
    expect(attacked.diplomacy.reputation).toBeLessThan(pacted.diplomacy.reputation - 15);
  });

  it('opens an embassy for a fee and a monthly bill, once', () => {
    const s = newGame();
    const opened = run(s, { type: 'OPEN_EMBASSY', country: 'JPN' });
    expect(opened.nation.treasury).toBeLessThan(s.nation.treasury);
    expect(opened.diplomacy.countries.JPN!.embassy).toBe(true);
    expect(dispatch(opened, { type: 'OPEN_EMBASSY', country: 'JPN' }).ok).toBe(false);
    const closed = run(opened, { type: 'BREAK_TREATY', treatyId: opened.diplomacy.treaties[0]!.id });
    expect(closed.diplomacy.countries.JPN!.embassy).toBe(false);
  });

  it('aid buys goodwill and reputation, then needs time before the next package', () => {
    const s = newGame();
    const helped = run(s, { type: 'SEND_AID', country: 'NPL', size: 'medium' });
    expect(relationOf(helped, 'NPL')).toBeGreaterThan(relationOf(s, 'NPL') + 5);
    expect(helped.diplomacy.reputation).toBeGreaterThan(s.diplomacy.reputation);
    expect(helped.nation.treasury).toBeLessThan(s.nation.treasury);
    expect(dispatch(helped, { type: 'SEND_AID', country: 'NPL', size: 'small' }).ok).toBe(false);
  });

  it('sanctions end trade, sour relations and can be lifted', () => {
    const traded = signTrade(newGame(), 'RUS', 'energy');
    const sanctioned = run(traded, { type: 'IMPOSE_SANCTIONS', country: 'RUS' });
    expect(sanctioned.diplomacy.countries.RUS!.sanctioned).toBe(true);
    expect(sanctioned.diplomacy.treaties.filter((t) => t.type === 'trade')).toHaveLength(0);
    expect(relationOf(sanctioned, 'RUS')).toBeLessThan(relationOf(traded, 'RUS') - 20);
    expect(dispatch(sanctioned, { type: 'PROPOSE_PACT', country: 'RUS' }).ok).toBe(false);
    const lifted = run(sanctioned, { type: 'LIFT_SANCTIONS', country: 'RUS' });
    expect(lifted.diplomacy.countries.RUS!.sanctioned).toBe(false);
    expect(lifted.diplomacy.treaties).toHaveLength(0);
    expect(dispatch(lifted, { type: 'LIFT_SANCTIONS', country: 'RUS' }).ok).toBe(false);
  });

  it('never mutates its input', () => {
    const s = deepFreeze(newGame());
    expect(() => dispatch(s, { type: 'OPEN_EMBASSY', country: 'FRA' })).not.toThrow();
    expect(() => dispatch(s, { type: 'SEND_AID', country: 'LKA', size: 'small' })).not.toThrow();
    expect(() => dispatch(s, { type: 'IMPOSE_SANCTIONS', country: 'IRN' })).not.toThrow();
  });
});

describe('AI nations', () => {
  it('records why each focus nation chose its action, from the same weighted inputs', () => {
    const s = advanceDays(newGame(), 40);
    for (const id of FOCUS_IDS) {
      const d = s.diplomacy.ai[id];
      expect(d).toBeDefined();
      expect(Object.keys(d!.utilities).sort()).toEqual(
        ['declareWar', 'idle', 'offerDeal', 'seekPact', 'sanction', 'threaten'].sort(),
      );
      expect(d!.utilities.idle).toBeGreaterThan(0);
    }
  });

  it('a hostile, strong, aggressive nation prefers threats to deals; a friend prefers deals', () => {
    let s = newGame();
    s = patchCountry(s, 'CHN', { relation: -70 });
    s = patchCountry(s, 'JPN', { relation: 70 });
    const hostile = scoreActions(s, 'CHN', 0).utilities;
    const friend = scoreActions(s, 'JPN', 0).utilities;
    expect(hostile.threaten).toBeGreaterThan(hostile.idle);
    expect(hostile.offerDeal).toBe(UNAVAILABLE);
    expect(friend.offerDeal).toBeGreaterThan(friend.idle);
    expect(friend.threaten).toBe(UNAVAILABLE);
    expect(friend.declareWar).toBe(UNAVAILABLE);
  });

  it('deterrence puts a nation off hostile action', () => {
    const base = patchCountry(newGame(), 'PAK', { relation: -60 });
    const weak = scoreActions({ ...base, military: { ...base.military, deterrence: 5 } }, 'PAK', 0).utilities;
    const strong = scoreActions({ ...base, military: { ...base.military, deterrence: 95 } }, 'PAK', 0).utilities;
    expect(weak.threaten).toBeGreaterThan(strong.threaten);
    expect(weak.declareWar).toBeGreaterThan(strong.declareWar);
  });

  it('proposes deals to India that wait for an answer and lapse if ignored', () => {
    let s = newGame({ seed: 7 });
    for (const id of ['JPN', 'FRA', 'DEU', 'AUS']) s = patchCountry(s, id, { relation: 95 });
    let found: GameState | null = null;
    for (let i = 0; i < 24 && !found; i++) {
      s = runFocusAi({ ...s, rng: new Rng(s.rng).state }, new Rng(s.rng));
      s = advanceDays(s, 30);
      if (s.diplomacy.offers.length > 0) found = s;
    }
    expect(found).not.toBeNull();
    const offer = found!.diplomacy.offers[0]!;
    const accepted = run(found!, { type: 'ACCEPT_OFFER', offerId: offer.id });
    expect(accepted.diplomacy.offers.find((o) => o.id === offer.id)).toBeUndefined();
    expect(accepted.diplomacy.treaties.some((t) => t.parties.includes(offer.from))).toBe(true);
    const declined = run(found!, { type: 'DECLINE_OFFER', offerId: offer.id });
    expect(declined.diplomacy.offers.find((o) => o.id === offer.id)).toBeUndefined();
    expect(declined.diplomacy.treaties).toHaveLength(found!.diplomacy.treaties.length);
    expect(dispatch(accepted, { type: 'ACCEPT_OFFER', offerId: offer.id }).ok).toBe(false);
    const lapsed = advanceDays({ ...found!, nation: { ...found!.nation, approval: 80 } }, 100);
    expect(lapsed.diplomacy.offers.find((o) => o.id === offer.id)).toBeUndefined();
  });

  it('rivals declare war through the AI, and never while a pact holds', () => {
    let wars = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = advanceDays(newGame({ seed }), 380);
      for (const id of RIVALS) s = patchCountry(s, id, { relation: -95 });
      s = { ...s, military: { ...s.military, deterrence: 0 } };
      for (let m = 0; m < 24 && s.status.kind === 'playing'; m++) {
        s = advanceDays(s, 30);
        // Keep the hands-off President in office, so the test is about the AI and not about impeachment.
        s = { ...s, military: { ...s.military, deterrence: 0 }, nation: { ...s.nation, approval: 60 } };
      }
      if (s.military.wars.length > 0 || s.military.warHistory.length > 0) wars++;
    }
    expect(wars).toBeGreaterThan(0);
  });

  it('plays a year with every nation in under two seconds', () => {
    const start = performance.now();
    advanceDays(newGame(), 366);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('is deterministic', () => {
    expect(hashState(advanceDays(newGame({ seed: 9 }), 500))).toBe(hashState(advanceDays(newGame({ seed: 9 }), 500)));
  });
});

describe('global and diplomatic events', () => {
  it('has about 20 global and diplomatic events, each decision with exactly one default', () => {
    const events = Object.values(EVENT_CONTENT).filter((e) => e.category === 'diplomacy');
    expect(events.length).toBeGreaterThanOrEqual(20);
    for (const e of events) {
      if (e.choices.length > 0) expect(e.choices.filter((c) => c.default)).toHaveLength(1);
    }
  });

  it('a regional conflict shows on the map and raises world tension', () => {
    const s = newGame();
    const raised = raiseEvent(s, 'regional-conflict', null, 'TUR');
    const pending = raised.events.pending.find((p) => p.eventId === 'regional-conflict')!;
    const choice = EVENT_CONTENT['regional-conflict']!.choices.find((c) => c.id === 'neutral')!;
    const resolved = run(raised, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: choice.id });
    expect(resolved.diplomacy.conflicts).toHaveLength(1);
    expect(resolved.diplomacy.conflicts[0]!.countries).toContain('TUR');
    expect(resolved.diplomacy.worldTension).toBeGreaterThan(s.diplomacy.worldTension);
    const later = advanceDays(resolved, 200);
    expect(later.diplomacy.conflicts).toHaveLength(0);
  });

  it('an oil shock hits inflation and growth for everyone, and the choice softens it', () => {
    const raised = raiseEvent(newGame(), 'global-oil-shock');
    const pending = raised.events.pending[0]!;
    const hit = run(raised, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'absorb' });
    const eased = run(raised, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'reserves' });
    const inflation = (s: GameState) =>
      s.modifiers.filter((m) => m.target === 'economy.inflation').reduce((sum, m) => sum + m.value, 0);
    expect(inflation(hit)).toBeGreaterThan(inflation(eased));
    expect(hit.diplomacy.worldTension).toBeGreaterThan(raised.diplomacy.worldTension);
    expect(relationOf(hit, 'FRA')).toBeLessThan(relationOf(raised, 'FRA'));
  });

  it('a summit invitation can open an embassy with the country it came from', () => {
    const raised = raiseEvent(newGame(), 'summit-invitation', null, 'JPN');
    const pending = raised.events.pending[0]!;
    expect(raised.log.at(-1)?.title).toContain('Japan');
    const done = run(raised, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'attend' });
    expect(done.diplomacy.countries.JPN!.embassy).toBe(true);
  });
});

describe('saves', () => {
  it('round-trips the diplomacy state', () => {
    const s = signTrade(advanceDays(newGame({ seed: 11 }), 120), 'USA');
    const parsed = parseSave(serializeSave(s, '2026-01-01T00:00:00.000Z'));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(hashState(parsed.save.state)).toBe(hashState(s));
  });
});

describe('every country can be reached', () => {
  it('has a relation record for each, usable by the commands', () => {
    const s = newGame();
    for (const c of COUNTRY_LIST) {
      expect(s.diplomacy.countries[c.id]).toBeDefined();
      expect(typeof relationTarget(s, c.id)).toBe('number');
    }
  });
});

describe('how diplomatic effects read to the player', () => {
  it('describes and scores every effect of every global and diplomatic decision', () => {
    const base = newGame();
    for (const event of Object.values(EVENT_CONTENT).filter((e) => e.category === 'diplomacy')) {
      const raised = raiseEvent(base, event.id);
      const pending = raised.events.pending[0];
      if (event.choices.length === 0) {
        expect(pending).toBeUndefined();
        continue;
      }
      const view = pendingView(raised, pending!)!;
      expect(view.choices).toHaveLength(event.choices.length);
      for (const c of view.choices) {
        expect(c.choice.label).not.toContain('{');
        for (const line of c.lines) expect(line.text.length).toBeGreaterThan(0);
        expect(
          Number.isFinite(
            choiceUtility(
              raised,
              event.choices.find((x) => x.id === c.choice.id)!,
            ),
          ),
        ).toBe(true);
      }
    }
  });

  it('puts the country’s name into the event text and the outcome', () => {
    const raised = raiseEvent(newGame(), 'aid-request', null, 'NPL');
    const pending = raised.events.pending[0]!;
    expect(raised.log.at(-1)?.title).toContain('Nepal');
    const done = run(raised, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'send' });
    expect(done.log.at(-1)?.body).toContain('Nepal');
    expect(relationOf(done, 'NPL')).toBeGreaterThan(relationOf(raised, 'NPL') + 8);
  });

  it('a lapsed decision applies its default and an unlisted country is ignored', () => {
    const raised = raiseEvent(newGame(), 'un-vote', null, 'USA');
    const lapsed = advanceDays(raised, 40);
    expect(lapsed.events.pending.find((p) => p.eventId === 'un-vote')).toBeUndefined();
    const unknown = raiseEvent(newGame(), 'un-vote', null, 'XXX');
    const done = run(unknown, { type: 'RESOLVE_EVENT', pendingId: unknown.events.pending[0]!.id, choiceId: 'support' });
    // Only the small world-wide shift of that choice applies; nothing is aimed at a country that does not exist.
    expect(done.diplomacy.countries.USA!.relation).toBeCloseTo(unknown.diplomacy.countries.USA!.relation - 0.5, 6);
  });

  it('relation words cover the whole scale', () => {
    expect([90, 40, 0, -30, -60, -90].map(relationWord)).toEqual([
      'Close friend',
      'Friendly',
      'Neutral',
      'Cool',
      'Hostile',
      'Adversary',
    ]);
  });

  it('picks countries of each kind, or none when nobody fits', () => {
    const s = newGame();
    for (const kind of COUNTRY_PICKS) {
      const id = pickCountry(s, kind, new Rng(s.rng));
      if (id) expect(COUNTRY_CONTENT[id]).toBeDefined();
    }
    expect(COUNTRY_CONTENT[pickCountry(s, 'neighbour', new Rng(s.rng))!]!.neighbour).toBe(true);
    expect(pickCountry(s, 'friend', new Rng(s.rng))).not.toBeNull();
    const cold = patchCountry(patchCountry(s, 'USA', { relation: -90 }), 'JPN', { relation: -90 });
    expect(
      pickCountry({ ...cold, diplomacy: { ...cold.diplomacy, countries: allAt(cold, -90) } }, 'friend', new Rng(s.rng)),
    ).toBeNull();
  });

  it('starts a regional crisis with no named country, and notes incidents among the other countries', () => {
    const s = newGame();
    const fired = fireEvent(s, EVENT_CONTENT['regional-conflict']!, null, null, new Rng(s.rng));
    const pending = fired.events.pending[0]!;
    const done = run(fired, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'neutral' });
    expect(done.diplomacy.conflicts[0]!.countries.length).toBeGreaterThan(0);
    expect(countriesInConflict(done).size).toBeGreaterThan(0);
    expect(logIncident(s, 'FRA', false).log.at(-1)?.title).toContain('Goodwill');
    expect(logIncident(s, 'FRA', true).log.at(-1)?.title).toContain('Friction');
  });
});

describe('what AI nations do to India', () => {
  const act = (s: GameState, id: string, action: AiAction) => performAction(s, id, action, new Rng(s.rng));

  it('threatens, sanctions, offers deals and seeks pacts through the same measures the player uses', () => {
    const s = newGame();
    const threatened = act(s, 'PAK', 'threaten');
    expect(relationOf(threatened, 'PAK')).toBeLessThan(relationOf(s, 'PAK'));
    expect(threatened.security.borderTension).toBeGreaterThan(s.security.borderTension);
    expect(threatened.log.at(-1)?.title).toContain('warning');

    const sanctioned = act(s, 'USA', 'sanction');
    const measure = sanctioned.diplomacy.treaties[0]!;
    expect(measure).toMatchObject({ type: 'sanctions', parties: ['USA', 'IND'] });
    expect(sanctioned.modifiers.some((m) => m.source === `treaty-${measure.id}` && m.value < 0)).toBe(true);
    const later = calm(sanctioned, 400);
    expect(later.diplomacy.treaties.filter((t) => t.type === 'sanctions')).toHaveLength(0);
    expect(later.modifiers.some((m) => m.source === `treaty-${measure.id}`)).toBe(false);

    const offered = act(s, 'JPN', 'offerDeal');
    expect(offered.diplomacy.offers[0]).toMatchObject({ from: 'JPN', type: 'trade' });
    const pact = act(s, 'LKA', 'seekPact');
    expect(pact.diplomacy.offers[0]).toMatchObject({ from: 'LKA', type: 'nonAggression' });
    expect(act(s, 'JPN', 'idle')).toBe(s);
    expect(act(s, 'PAK', 'declareWar').military.wars[0]).toMatchObject({ rival: 'PAK', declaredBy: 'rival' });
  });

  it('will not declare war on a rival it is already fighting', () => {
    const s = startWar(newGame(), 'PAK', 'rival');
    expect(scoreActions(s, 'PAK', 0).utilities.declareWar).toBe(UNAVAILABLE);
    expect(bestAction(scoreActions(s, 'JPN', 0).utilities)).toBeDefined();
  });

  it('keeps its unlisted-country state errors loud', () => {
    expect(() => relationOf(newGame(), 'XXX')).toThrow(/Unknown country/);
  });
});

/** Every country at the same relation, for tests that need a cold world. */
function allAt(state: GameState, relation: number): GameState['diplomacy']['countries'] {
  return Object.fromEntries(Object.entries(state.diplomacy.countries).map(([id, c]) => [id, { ...c, relation }]));
}

describe('war, annexation and offers keep to the treaty rules', () => {
  /** India beats Sri Lanka and annexes it, through the real commands. */
  function annexSriLanka(): GameState {
    let s = run(newGame(), { type: 'OPEN_EMBASSY', country: 'LKA' });
    s = run(s, { type: 'DECLARE_WAR', rival: 'LKA' });
    const war = s.military.wars[0]!;
    s = {
      ...s,
      military: { ...s.military, wars: [{ ...war, status: 'terms', termsDeadlineTick: s.clock.tick + 30 }] },
    };
    return run(s, { type: 'SETTLE_WAR', warId: war.id, terms: 'annex' });
  }

  it('an annexed country is no longer a diplomatic partner (DEF-05)', () => {
    const s = annexSriLanka();
    expect(s.military.rivals.LKA.annexed).toBe(true);
    expect(s.diplomacy.treaties.filter((t) => t.parties.includes('LKA'))).toEqual([]);
    for (const command of [
      { type: 'OPEN_EMBASSY', country: 'LKA' },
      { type: 'SEND_AID', country: 'LKA', size: 'small' },
      { type: 'PROPOSE_PACT', country: 'LKA' },
      { type: 'IMPOSE_SANCTIONS', country: 'LKA' },
    ] as Command[]) {
      const result = dispatch(s, command);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('no longer exists');
    }
    const rng = new Rng(s.rng);
    for (let i = 0; i < 500; i++) expect(pickCountry(s, 'any', rng)).not.toBe('LKA');
    const later = runFocusAi(s, new Rng(s.rng));
    expect(later.diplomacy.ai.LKA).toMatchObject({ action: 'idle', acted: false });
  });

  it('an invader’s contracts, embassy and offers end without costing India anything (DEF-06)', () => {
    let s = run(newGame(), { type: 'OPEN_EMBASSY', country: 'BGD' });
    s = signTrade(s, 'BGD', 'agriculture');
    const reputation = s.diplomacy.reputation;
    s = {
      ...s,
      diplomacy: {
        ...s.diplomacy,
        offers: [
          { id: 'ofr-x', from: 'BGD', type: 'nonAggression', years: 5, terms: {}, raisedTick: 0, expiresTick: 90 },
        ],
      },
    };
    const atWar = startWar(s, 'BGD', 'rival');
    expect(atWar.diplomacy.treaties.filter((t) => t.parties.includes('BGD'))).toEqual([]);
    expect(atWar.modifiers.some((m) => m.label.includes('Bangladesh') && m.source.startsWith('treaty-'))).toBe(false);
    expect(atWar.diplomacy.countries.BGD!.embassy).toBe(false);
    expect(atWar.diplomacy.offers).toEqual([]);
    expect(atWar.diplomacy.reputation).toBe(reputation);
  });

  it('an offer is refused when India could not have proposed the same deal (DEF-07)', () => {
    const offer = (from: string, sector: 'tech' | 'agriculture' = 'tech') => ({
      id: `ofr-${from}-${sector}`,
      from,
      type: 'trade' as const,
      years: 3,
      terms: { sector, value: 40_000 },
      raisedTick: 0,
      expiresTick: 90,
    });
    const withOffers = (state: GameState, ...offers: ReturnType<typeof offer>[]): GameState => ({
      ...state,
      diplomacy: { ...state.diplomacy, offers },
    });
    // Sanctions end the country's open offers, and an offer cannot be accepted while sanctions stand.
    const sanctioned = run(withOffers(newGame(), offer('GBR')), { type: 'IMPOSE_SANCTIONS', country: 'GBR' });
    expect(sanctioned.diplomacy.offers).toEqual([]);
    const staged = withOffers(sanctioned, offer('GBR'));
    const refused = dispatch(staged, { type: 'ACCEPT_OFFER', offerId: 'ofr-GBR-tech' });
    expect(refused.ok).toBe(false);
    // A second contract in the same sector is refused, as a proposal would be.
    const trading = signTrade(newGame(), 'USA', 'tech');
    const duplicate = dispatch(withOffers(trading, offer('USA')), { type: 'ACCEPT_OFFER', offerId: 'ofr-USA-tech' });
    expect(duplicate.ok).toBe(false);
    const other = dispatch(withOffers(trading, offer('USA', 'agriculture')), {
      type: 'ACCEPT_OFFER',
      offerId: 'ofr-USA-agriculture',
    });
    expect(other.ok).toBe(true);
  });
});
