import budget from './budget.json';
import construction from './construction.json';
import dashboard from './dashboard.json';
import departments from './departments.json';
import diplomacy from './diplomacy.json';
import economy from './economy.json';
import energy from './energy.json';
import handbook from './handbook.json';
import inbox from './inbox.json';
import police from './police.json';
import military from './military.json';
import reports from './reports.json';
import security from './security.json';
import shell from './shell.json';
import tutorial from './tutorial.json';
import world from './world.json';

/** The English catalogue: one JSON file per area, merged into a single namespace. */
export const en = {
  ...shell,
  ...tutorial,
  ...handbook,
  ...dashboard,
  ...inbox,
  ...economy,
  ...budget,
  ...departments,
  ...construction,
  ...energy,
  ...security,
  ...police,
  ...military,
  ...world,
  ...diplomacy,
  ...reports,
};
