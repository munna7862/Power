import type { ViewId } from '../../store';
import { ViewIcon } from '../icons';
import styles from '../screens/game.module.css';
import { VIEW_LABELS } from './viewLabels';

const ROADMAP: Record<Exclude<ViewId, 'dashboard'>, { phase: string; text: string }> = {
  economy: { phase: 'Phase 2', text: 'Sectors, taxes, budget allocation, inflation and debt.' },
  cabinet: { phase: 'Phase 2', text: 'Appoint ministers, set ideology and development strategy.' },
  security: { phase: 'Phase 3', text: 'Emergencies, corruption, unrest, terror threats and your own safety.' },
  military: { phase: 'Phase 4', text: 'Armed forces, drills, espionage, war and the nuclear program.' },
  world: { phase: 'Phase 5', text: 'World map, relations, trade contracts and treaties.' },
  reports: { phase: 'Phase 2', text: 'Indicator history charts and annual reports.' },
};

export function ComingSoonView({ view }: { view: Exclude<ViewId, 'dashboard'> }) {
  const { phase, text } = ROADMAP[view];
  return (
    <div className={styles.comingSoon}>
      <ViewIcon view={view} className={styles.navIcon} />
      <h1 className={styles.viewTitle}>{VIEW_LABELS[view]}</h1>
      <p className={styles.muted}>{text}</p>
      <span className={styles.phaseTag}>Arrives in {phase}</span>
    </div>
  );
}
