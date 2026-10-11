import { useEffect } from 'react';
import { VICTORY_CAUSES } from '../../sim';
import { gameStore } from '../../store';
import { useSettings } from '../../store/settingsStore';
import { audio } from './engine';

/**
 * Wires the audio engine to the game: volumes follow the settings, the first gesture unlocks sound, buttons
 * click, new decisions chime, critical news sounds an alert and the end of a presidency plays a short cue.
 */
export function useAudio(): void {
  const musicVolume = useSettings((s) => s.musicVolume);
  const sfxVolume = useSettings((s) => s.sfxVolume);
  const muted = useSettings((s) => s.muted);

  useEffect(() => {
    audio.setVolumes(musicVolume, sfxVolume, muted);
  }, [musicVolume, sfxVolume, muted]);

  useEffect(() => {
    audio.setMusic(true);
    const unlock = () => audio.unlock();
    const click = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest('button:not(:disabled)')) audio.play('click');
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('pointerdown', click);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('pointerdown', click);
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
        if (game.status.kind === 'over' && prev.status.kind !== 'over') {
          audio.play(VICTORY_CAUSES.includes(game.status.cause) ? 'success' : 'failure');
          return;
        }
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
