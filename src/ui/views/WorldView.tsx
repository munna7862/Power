import { useMemo, useState } from 'react';
import { COUNTRY_CONTENT, COUNTRY_LIST, relationOf, relationWord } from '../../sim';
import { gameStore, useGame } from '../../store';
import { OVERLAY_LABELS, OVERLAY_LEGENDS, OVERLAYS, overlayFills, overlayValue, type OverlayId } from '../map/overlays';
import { WorldMap } from '../map/WorldMap';
import mapStyles from '../map/world.module.css';
import gameStyles from '../screens/game.module.css';
import { CountryPanel } from './world/CountryPanel';
import styles from './views.module.css';

const INDIA_NAME = 'India';
const nameOf = (id: string) => (id === 'IND' ? INDIA_NAME : (COUNTRY_CONTENT[id]?.name ?? id));

export function WorldView() {
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
          <h1 className={gameStyles.viewTitle}>World</h1>
          <p className={gameStyles.viewSubtitle}>
            {COUNTRY_LIST.length} countries · reputation {Math.round(game.diplomacy.reputation)} · world tension{' '}
            {Math.round(game.diplomacy.worldTension)}
            {crises.length > 0 && ` · ${crises.length} regional crisis${crises.length === 1 ? '' : 'es'}`}
          </p>
        </div>
      </div>

      <div className={mapStyles.layout}>
        <div className={mapStyles.mapColumn}>
          <div className={mapStyles.toolbar}>
            <div className={styles.segmented} role="group" aria-label="Map overlay">
              {OVERLAYS.map((o) => (
                <button key={o} type="button" aria-pressed={overlay === o} onClick={() => setOverlay(o)}>
                  {OVERLAY_LABELS[o]}
                </button>
              ))}
            </div>
            <ul className={mapStyles.legend} aria-label="Legend">
              {OVERLAY_LEGENDS[overlay].map((item) => (
                <li key={item.label}>
                  <span className={mapStyles.swatch} style={{ background: item.colour }} />
                  {item.label}
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
                : 'Your country';
            }}
          />
          <p className={styles.note}>
            Boundaries follow the Survey of India. Drag to pan, scroll or use the buttons to zoom, click a country to
            open it.
          </p>
        </div>

        <div className={mapStyles.stack}>
          <div className={mapStyles.finder}>
            <label htmlFor="country-search" className={styles.muted}>
              Find a country
            </label>
            <input
              id="country-search"
              type="search"
              value={query}
              placeholder="Type a name…"
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className={mapStyles.results} aria-label="Matching countries">
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
                      <span className={styles.muted}>{relationWord(relationOf(game, c.id))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && COUNTRY_CONTENT[selected] ? (
            <CountryPanel key={selected} game={game} id={selected} />
          ) : (
            <p className={styles.note}>
              Select a country on the map, or search for one, to see its relation with India and what you can do.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
