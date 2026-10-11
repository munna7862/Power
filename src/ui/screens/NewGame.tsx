import { useState, type FormEvent } from 'react';
import { DIFFICULTIES, PRESIDENT_NAME_MAX, type Difficulty } from '../../sim';
import { gameStore } from '../../store';
import { Button } from '../design/primitives';
import styles from './screens.module.css';

const DIFFICULTY_TEXT: Record<Difficulty, { title: string; text: string }> = {
  easy: { title: 'Easy', text: 'Healthy treasury, patient public.' },
  normal: { title: 'Normal', text: 'A balanced start. Recommended.' },
  hard: { title: 'Hard', text: 'Thin reserves, sceptical voters.' },
};

export function NewGame() {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    gameStore.getState().startNewGame({ presidentName: name, difficulty });
  };

  return (
    <main className={styles.menuScreen}>
      <form className={`${styles.menuCard} ${styles.form}`} onSubmit={submit}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>New term</span>
          <h1 className={styles.title}>Take the oath</h1>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>President&apos;s name</span>
          <input
            className={styles.input}
            value={name}
            maxLength={PRESIDENT_NAME_MAX}
            placeholder="The President"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <span className={styles.hint}>A fictional leader. Leave blank to be addressed as “The President”.</span>
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel} id="difficulty-label">
            Difficulty
          </span>
          <fieldset className={styles.choices} aria-labelledby="difficulty-label">
            {DIFFICULTIES.map((d) => (
              <label key={d} className={styles.choice}>
                <input
                  type="radio"
                  name="difficulty"
                  value={d}
                  checked={difficulty === d}
                  onChange={() => setDifficulty(d)}
                />
                <span className={styles.choiceTitle}>{DIFFICULTY_TEXT[d].title}</span>
                <span className={styles.choiceText}>{DIFFICULTY_TEXT[d].text}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => gameStore.getState().goTo('menu')}>Back</Button>
          <Button type="submit" variant="primary">
            Begin term
          </Button>
        </div>
      </form>
    </main>
  );
}
