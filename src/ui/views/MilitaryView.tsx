import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { ArmouryTab } from './military/ArmouryTab';
import { NuclearTab } from './military/NuclearTab';
import { OpsTab } from './military/OpsTab';
import { WarTab } from './military/WarTab';
import styles from './views.module.css';

const TABS = ['armoury', 'ops', 'war', 'nuclear'] as const;
type TabId = (typeof TABS)[number];

export function MilitaryView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [tab, setTab] = useState<TabId>('armoury');
  if (!game) return null;

  const { military } = game;
  const strength = militaryStrength(military);
  const warNames = military.wars.map((w) => RIVAL_CONTENT[w.rival].name);
  const tiles = [
    { id: 'readiness', value: military.readiness },
    { id: 'morale', value: military.morale },
    { id: 'deterrence', value: military.deterrence },
  ] as const;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.military')}</h1>
          <p className={gameStyles.viewSubtitle}>
            {t('military.subtitle')}
            {warNames.length > 0 && t('military.atWar', { countries: warNames.join(t('common.and')) })}
          </p>
        </div>
      </div>

      <div className={styles.tiles} style={{ marginBottom: 16 }}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('military.strength')}</span>
          <span className={styles.tileValue} data-testid="strength-index">
            {strength.toFixed(0)}
          </span>
          <span className={styles.tileNote}>
            <Tooltip label={t('common.why')}>
              <span className={gameStyles.breakdown}>
                {DOMAINS.map((d) => (
                  <Fragment key={d}>
                    <span>
                      {t('military.domainTier', {
                        domain: t(`military.domains.${d}`),
                        tier: military.tech[d],
                        power: TIER_POWER[military.tech[d]],
                      })}
                    </span>
                    <span className={gameStyles.breakdownValue}>{domainStrength(military, d).toFixed(1)}</span>
                  </Fragment>
                ))}
                <span>{t('military.readinessFactor')}</span>
                <span className={gameStyles.breakdownValue}>×{readinessFactor(military.readiness).toFixed(2)}</span>
                <span>{t('military.moraleFactor')}</span>
                <span className={gameStyles.breakdownValue}>×{moraleFactor(military.morale).toFixed(2)}</span>
              </span>
            </Tooltip>
          </span>
        </div>
        {tiles.map((tile) => (
          <div key={tile.id} className={styles.tile}>
            <span className={styles.tileLabel}>{t(`military.tiles.${tile.id}`)}</span>
            <span className={styles.tileValue} data-testid={tile.id}>
              {tile.value.toFixed(0)}/100
            </span>
            <span className={styles.tileNote}>{t(`military.tiles.${tile.id}Note`)}</span>
          </div>
        ))}
      </div>

      <div className={styles.tabs} role="tablist" aria-label={t('military.sections')}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`mil-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="mil-panel"
            className={styles.tab}
            onClick={() => setTab(id)}
          >
            {t(`military.tabs.${id}`)}
            {id === 'war' && military.wars.length > 0 ? ` (${military.wars.length})` : ''}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="mil-panel" aria-labelledby={`mil-tab-${tab}`}>
        {tab === 'armoury' && <ArmouryTab game={game} />}
        {tab === 'ops' && <OpsTab game={game} />}
        {tab === 'war' && <WarTab game={game} />}
        {tab === 'nuclear' && <NuclearTab game={game} />}
      </div>
    </>
  );
}
