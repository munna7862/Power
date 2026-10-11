import { useSettings } from '../../store/settingsStore';
import { Button, Modal } from '../design/primitives';
import styles from '../screens/screens.module.css';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className={styles.settingsRow}>
        <span className={styles.fieldLabel} id="theme-label">
          Theme
        </span>
        <div role="group" aria-labelledby="theme-label" className={styles.actions}>
          {(['dark', 'light'] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? 'primary' : 'secondary'}
              aria-pressed={theme === t}
              onClick={() => setTheme(t)}
            >
              {t === 'dark' ? 'Dark' : 'Light'}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
