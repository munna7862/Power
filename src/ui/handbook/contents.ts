/**
 * The "Constitution": an in-game encyclopedia explaining every stat and rule. The structure lives here and
 * the text in i18n (handbook.*); numbers come from the simulation's own constants, so the handbook can
 * never disagree with the game.
 */
export const HANDBOOK = [
  { id: 'basics', entries: ['winning', 'losing', 'time', 'difficulty', 'options'] },
  {
    id: 'nation',
    entries: ['approval', 'satisfaction', 'treasury', 'budget', 'taxes', 'gdp', 'inflation', 'unemployment', 'debt'],
  },
  { id: 'society', entries: ['corruption', 'hdi', 'sectors'] },
  { id: 'government', entries: ['ministries', 'ministers', 'ideology', 'strategy', 'events'] },
  {
    id: 'security',
    entries: ['unrest', 'terror', 'operations', 'investigations', 'borderTension', 'coup', 'safety'],
  },
  {
    id: 'military',
    entries: ['forces', 'readiness', 'deterrence', 'research', 'drills', 'intelligence', 'war', 'nuclear'],
  },
  { id: 'world', entries: ['relations', 'reputation', 'tension', 'trade', 'pacts', 'measures', 'aiNations'] },
  { id: 'interface', entries: ['why', 'inbox', 'saves', 'shortcuts'] },
] as const;
