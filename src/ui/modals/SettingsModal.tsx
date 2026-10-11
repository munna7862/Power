import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { desktopBridge } from '../../platform/desktop';
import { UI_SCALES, type Motion, type Palette, type Theme } from '../../platform/settings';
import { useSettings } from '../../store/settingsStore';
import { Button, Modal } from '../design/primitives';
import styles from '../screens/screens.module.css';
import { SHORTCUTS } from '../shortcuts';

/** A row of toggle buttons, one pressed. */
function Choice<T extends string | number>({
  label,
  value,
  options,
  text,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  text: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const id = `setting-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={styles.settingsRow}>
      <span className={styles.fieldLabel} id={id}>
        {label}
      </span>
      <div role="group" aria-labelledby={id} className={styles.actions}>
        {options.map((o) => (
          <Button
            key={o}
            variant={value === o ? 'primary' : 'secondary'}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {text(o)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className={styles.settingsRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.settingsSection} aria-label={title}>
      <h3 className={styles.settingsHeading}>{title}</h3>
      {children}
    </section>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const s = useSettings();
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    void desktopBridge()?.saves.folder().then(setFolder);
  }, []);

  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <Section title={t('settings.display')}>
        <Choice<Theme>
          label={t('settings.theme')}
          value={s.theme}
          options={['dark', 'light']}
          text={(o) => t(`settings.themes.${o}`)}
          onChange={(theme) => s.update({ theme })}
        />
        <Choice
          label={t('settings.uiScale')}
          value={s.uiScale}
          options={UI_SCALES}
          text={(o) => `${o}%`}
          onChange={(uiScale) => s.update({ uiScale })}
        />
      </Section>

      <Section title={t('settings.accessibility')}>
        <Choice<Palette>
          label={t('settings.palette')}
          value={s.palette}
          options={['standard', 'colourBlind']}
          text={(o) => t(`settings.palettes.${o}`)}
          onChange={(palette) => s.update({ palette })}
        />
        <Choice<Motion>
          label={t('settings.motion')}
          value={s.motion}
          options={['system', 'reduced', 'full']}
          text={(o) => t(`settings.motions.${o}`)}
          onChange={(motion) => s.update({ motion })}
        />
      </Section>

      <Section title={t('settings.audio')}>
        <Volume
          label={t('settings.music')}
          value={s.musicVolume}
          onChange={(musicVolume) => s.update({ musicVolume })}
        />
        <Volume label={t('settings.effects')} value={s.sfxVolume} onChange={(sfxVolume) => s.update({ sfxVolume })} />
        <Choice
          label={t('settings.sound')}
          value={s.muted ? 'off' : 'on'}
          options={['on', 'off']}
          text={(o) => t(`settings.soundStates.${o}`)}
          onChange={(o) => s.update({ muted: o === 'off' })}
        />
      </Section>

      <Section title={t('settings.keyboard')}>
        <dl className={styles.shortcuts}>
          {SHORTCUTS.map((sc) => (
            <div key={sc.id} style={{ display: 'contents' }}>
              <dt>{sc.keys.map((k, i) => (k === '–' ? <span key={i}> – </span> : <kbd key={i}>{k}</kbd>))}</dt>
              <dd>{t(`shortcuts.${sc.id}`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {folder && (
        <Section title={t('settings.saves')}>
          <p className={styles.hint}>{t('settings.savesFolder', { folder })}</p>
        </Section>
      )}
    </Modal>
  );
}
