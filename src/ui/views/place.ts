import type { RegionId } from '../../sim';
import { t } from '../i18n';
import { useGame } from '../../store';

/** Whether the game in progress is played region by region (the New Game option; on for saves from before it). */
export const useRegional = (): boolean => useGame((s) => s.game?.meta.options.regions ?? true);

/** A region's name, or "India" for an order or figure for the whole country (null). */
export const placeName = (region: RegionId | null): string =>
  region === null ? t('regions.india') : t(`regions.${region}`);

/** A region as it reads in a sentence ("the North"), or "India" (null). */
export const placePhrase = (region: RegionId | null): string =>
  region === null ? t('regions.india') : t('regions.inSentence', { region: t(`regions.${region}`) });
