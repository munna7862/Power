import { Fragment, useState } from 'react';
import {
  DOMAIN_LABELS,
  DOMAINS,
  domainStrength,
  militaryStrength,
  moraleFactor,
  readinessFactor,
  RIVAL_CONTENT,
  TIER_POWER,
} from '../../sim';
import { useGame } from '../../store';
import { Tooltip } from '../design/primitives';
import gameStyles from '../screens/game.module.css';
import { ForcesTab } from './military/ForcesTab';
import { NuclearTab } from './military/NuclearTab';
import { OpsTab } from './military/OpsTab';
import { WarTab } from './military/WarTab';
import styles from './views.module.css';

const TABS = [
  { id: 'forces', label: 'Forces' },
  { id: 'ops', label: 'Drills & Intelligence' },
  { id: 'war', label: 'War' },
  { id: 'nuclear', label: 'Nuclear' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function MilitaryView() {
  const game = useGame((s) => s.game);
  const [tab, setTab] = useState<TabId>('forces');
  if (!game) return null;

  const { military } = game;
  const strength = militaryStrength(military);
  const warNames = military.wars.map((w) => RIVAL_CONTENT[w.rival].name);

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Military</h1>
          <p className={gameStyles.viewSubtitle}>
            Armed forces, drills, espionage, war and the nuclear program
            {warNames.length > 0 && ` · At war with ${warNames.join(' and ')}`}
          </p>
        </div>
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Strength index</span>
          <span className={styles.tileValue} data-testid="strength-index">
            {strength.toFixed(0)}
          </span>
          <span className={styles.tileNote}>
            <Tooltip label="Why?">
              <span className={gameStyles.breakdown}>
                {DOMAINS.map((d) => (
                  <Fragment key={d}>
                    <span>
                      {DOMAIN_LABELS[d]} (tier {military.tech[d]}, ×{TIER_POWER[military.tech[d]]})
                    </span>
                    <span className={gameStyles.breakdownValue}>{domainStrength(military, d).toFixed(1)}</span>
                  </Fragment>
                ))}
                <span>Readiness factor</span>
                <span className={gameStyles.breakdownValue}>×{readinessFactor(military.readiness).toFixed(2)}</span>
                <span>Morale factor</span>
                <span className={gameStyles.breakdownValue}>×{moraleFactor(military.morale).toFixed(2)}</span>
              </span>
            </Tooltip>
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Readiness</span>
          <span className={styles.tileValue} data-testid="readiness">
            {military.readiness.toFixed(0)}/100
          </span>
          <span className={styles.tileNote}>Drills raise it; underfunding lowers it</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Morale</span>
          <span className={styles.tileValue} data-testid="morale">
            {military.morale.toFixed(0)}/100
          </span>
          <span className={styles.tileNote}>Feeds army loyalty and coup risk</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Deterrence</span>
          <span className={styles.tileValue} data-testid="deterrence">
            {military.deterrence.toFixed(0)}/100
          </span>
          <span className={styles.tileNote}>Puts rivals off attacking</span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Military sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`mil-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="mil-panel"
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'war' && military.wars.length > 0 ? ` (${military.wars.length})` : ''}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="mil-panel" aria-labelledby={`mil-tab-${tab}`}>
        {tab === 'forces' && <ForcesTab game={game} />}
        {tab === 'ops' && <OpsTab game={game} />}
        {tab === 'war' && <WarTab game={game} />}
        {tab === 'nuclear' && <NuclearTab game={game} />}
      </div>
    </>
  );
}
