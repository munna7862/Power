import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COUNTRY_CONTENT, COUNTRY_LIST, relationLevel, relationOf } from '../../sim';
import { gameStore, useGame } from '../../store';
import { t as translate } from '../i18n';
import { OVERLAY_LEGENDS, OVERLAYS, overlayFills, overlayValue, type OverlayId } from '../map/overlays';
import { WorldMap } from '../map/WorldMap';
import mapStyles from '../map/world.module.css';
import gameStyles from '../screens/game.module.css';
import { CountryPanel } from './world/CountryPanel';
import styles from './views.module.css';

const nameOf = (id: string) => (id === 'IND' ? translate('menu.eyebrow') : (COUNTRY_CONTENT[id]?.name ?? id));

export function WorldView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.country);
  const [overlay, setOverlay] = useState<OverlayId>('relation');
  const [query, setQuery] = useState('');

  const diplomacy = game?.diplomacy;
  const wars = game?.military.wars;
  const fills = useMemo(
    () => (diplomacy && wars ? overlayFills({ diplomacy, military: { wars } }, overlay) : {}),
    [diplomacy, wars, overlay],
  );
  if (!game) return null;

  const select = (id: string) => gameStore.getState().openCountry(id === 'IND' ? null : id);
  const matches = query.trim()
    ? COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30)
    : [];
  const crises = game.diplomacy.conflicts;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.world')}</h1>
          <p className={gameStyles.viewSubtitle}>
            {t('world.subtitle', {
              countries: COUNTRY_LIST.length,
              reputation: Math.round(game.diplomacy.reputation),
              tension: Math.round(game.diplomacy.worldTension),
            })}
            {crises.length > 0 && t('world.crises', { count: crises.length })}
          </p>
        </div>
      </div>

      <div className={mapStyles.layout}>
        <div className={mapStyles.mapColumn}>
          <div className={mapStyles.toolbar}>
            <div className={styles.segmented} role="group" aria-label={t('world.overlay')}>
              {OVERLAYS.map((o) => (
                <button key={o} type="button" aria-pressed={overlay === o} onClick={() => setOverlay(o)}>
                  {t(`world.overlays.${o}`)}
                </button>
              ))}
            </div>
            <ul className={mapStyles.legend} aria-label={t('world.legendLabel')}>
              {OVERLAY_LEGENDS[overlay].map((item) => (
                <li key={item.id}>
                  <span className={mapStyles.swatch} style={{ background: item.colour }} />
                  {t(`world.legend.${item.id}`)}
                </li>
              ))}
            </ul>
          </div>

          <WorldMap
            fills={fills}
            selected={selected}
            onSelect={select}
            nameOf={nameOf}
            valueOf={(id) => {
              const c = COUNTRY_CONTENT[id];
              return c
                ? overlayValue({ diplomacy: game.diplomacy, military: game.military }, c, overlay)
                : t('world.yourCountry');
            }}
          />
          <p className={styles.note}>{t('world.mapNote')}</p>
        </div>

        <div className={mapStyles.stack}>
          <div className={mapStyles.finder}>
            <label htmlFor="country-search" className={styles.muted}>
              {t('world.find')}
            </label>
            <input
              id="country-search"
              type="search"
              value={query}
              placeholder={t('world.findPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className={mapStyles.results} aria-label={t('world.matches')}>
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={selected === c.id}
                      onClick={() => {
                        select(c.id);
                        setQuery('');
                      }}
                    >
                      <span>{c.name}</span>
                      <span className={styles.muted}>
                        {t(`world.relationLevels.${relationLevel(relationOf(game, c.id))}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && COUNTRY_CONTENT[selected] ? (
            <CountryPanel key={selected} game={game} id={selected} />
          ) : (
            <p className={styles.note}>{t('world.selectPrompt')}</p>
          )}
        </div>
      </div>
    </>
  );
}
