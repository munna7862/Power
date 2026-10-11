import { ViewIcon } from '../icons';
import styles from '../screens/game.module.css';
import { VIEW_LABELS } from './viewLabels';

export type FutureView = 'security' | 'military' | 'world';

const ROADMAP: Record<FutureView, { phase: string; text: string }> = {
  security: { phase: 'Phase 3', text: 'Emergencies, corruption, unrest, terror threats and your own safety.' },
  military: { phase: 'Phase 4', text: 'Armed forces, drills, espionage, war and the nuclear program.' },
  world: { phase: 'Phase 5', text: 'World map, relations, trade contracts and treaties.' },
};

export function ComingSoonView({ view }: { view: FutureView }) {
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
