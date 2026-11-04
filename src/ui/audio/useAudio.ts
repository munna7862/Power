import { useEffect } from 'react';
import { VICTORY_CAUSES, type GameState } from '../../sim';
import { gameStore } from '../../store';
import { useSettings } from '../../store/settingsStore';
import { audio } from './engine';
import { moodFor } from './music/mood';

const activeWars = (game: GameState): number => game.military.wars.filter((w) => w.status === 'active').length;

/**
 * Wires the audio engine to the game: volumes follow the settings, the first gesture unlocks sound, buttons
 * click, new decisions chime, critical news sounds an alert, the soundtrack follows the state of the country,
 * and wars and the end of a presidency play a short musical cue.
 */
export function useAudio(): void {
  const musicVolume = useSettings((s) => s.musicVolume);
  const sfxVolume = useSettings((s) => s.sfxVolume);
  const muted = useSettings((s) => s.muted);
  const musicStyle = useSettings((s) => s.musicStyle);

  useEffect(() => {
    audio.setVolumes(musicVolume, sfxVolume, muted);
  }, [musicVolume, sfxVolume, muted]);

  useEffect(() => {
    audio.setMusic(musicStyle !== 'off');
    const follow = () => {
      const { screen, game } = gameStore.getState();
      audio.setMood(moodFor(screen, game, musicStyle));
    };
    follow();
    return gameStore.subscribe(follow);
  }, [musicStyle]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    const click = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest('button:not(:disabled)')) audio.play('click');
    };
    const visibility = () => audio.setHidden(document.visibilityState === 'hidden');
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('pointerdown', click);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('pointerdown', click);
      document.removeEventListener('visibilitychange', visibility);
      audio.setMusic(false);
    };
  }, []);

  useEffect(
    () =>
      gameStore.subscribe((now, before) => {
        if (now.notice !== before.notice && now.notice?.tone === 'info') audio.play('save');
        const game = now.game;
        const prev = before.game;
        if (!game || !prev || game === prev || game.meta.seed !== prev.meta.seed) return;
        // With music off, the big moments keep their short effect chimes instead of musical cues.
        const music = useSettings.getState().musicStyle !== 'off';
        if (game.status.kind === 'over' && prev.status.kind !== 'over') {
          const won = VICTORY_CAUSES.includes(game.status.cause);
          if (music) audio.stinger(won ? 'victory' : 'defeat');
          else audio.play(won ? 'success' : 'failure');
          return;
        }
        const wars = activeWars(game);
        const warsBefore = activeWars(prev);
        if (music && wars > warsBefore) audio.stinger('war');
        else if (music && wars === 0 && warsBefore > 0) audio.stinger('peace');
        // The log is capped, so find new entries after the last one seen rather than by length.
        const lastSeen = prev.log.at(-1)?.id;
        const seenAt = game.log.findIndex((e) => e.id === lastSeen);
        const fresh = seenAt >= 0 ? game.log.slice(seenAt + 1) : [];
        if (fresh.some((e) => e.severity === 'critical')) audio.play('alert');
        else if (game.events.pending.length > prev.events.pending.length) audio.play('decision');
      }),
    [],
  );
}
