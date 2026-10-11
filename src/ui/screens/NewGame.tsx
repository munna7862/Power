import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_IDEOLOGY,
  DEFAULT_STRATEGY,
  DIFFICULTIES,
  DIFFICULTY_RULES,
  IDEOLOGIES,
  IDEOLOGY_CONTENT,
  PRESIDENT_NAME_MAX,
  STRATEGIES,
  STRATEGY_CONTENT,
  type Difficulty,
  type GameOptions,
  type IdeologyId,
  type StrategyId,
} from '../../sim';
import { gameStore } from '../../store';
import { useSettings } from '../../store/settingsStore';
import { Button } from '../design/primitives';
import { formatCrore } from '../format';
import { useTutorial } from '../tutorial/tutorialStore';
import styles from './screens.module.css';

const OPTION_IDS = ['tutorial', 'noWars', 'noRiots'] as const satisfies readonly (keyof GameOptions)[];

export function NewGame() {
  const { t } = useTranslation();
  const tutorialSeen = useSettings((s) => s.tutorialSeen);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [ideology, setIdeology] = useState<IdeologyId>(DEFAULT_IDEOLOGY);
  const [strategy, setStrategy] = useState<StrategyId>(DEFAULT_STRATEGY);
  const [options, setOptions] = useState<GameOptions>({ tutorial: !tutorialSeen, noWars: false, noRiots: false });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    gameStore.getState().startNewGame({ presidentName: name, difficulty, ideology, strategy, options });
    if (options.tutorial) useTutorial.getState().start();
  };

  return (
    <main className={styles.menuScreen}>
      <form className={`${styles.menuCard} ${styles.form}`} onSubmit={submit}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>{t('newGame.eyebrow')}</span>
          <h1 className={styles.title}>{t('newGame.title')}</h1>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('newGame.name')}</span>
          <input
            className={styles.input}
            value={name}
            maxLength={PRESIDENT_NAME_MAX}
            placeholder={t('newGame.namePlaceholder')}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <span className={styles.hint}>{t('newGame.nameHint')}</span>
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel} id="difficulty-label">
            {t('newGame.difficulty')}
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
                <span className={styles.choiceTitle}>{t(`difficulty.${d}.title`)}</span>
                <span className={styles.choiceText}>{t(`difficulty.${d}.text`)}</span>
              </label>
            ))}
          </fieldset>
          <span className={styles.hint} data-testid="difficulty-rules">
            {t('newGame.difficultyRules', {
              treasury: formatCrore(DIFFICULTY_RULES[difficulty].treasury),
              approval: DIFFICULTY_RULES[difficulty].approval,
              fatigue: DIFFICULTY_RULES[difficulty].voterFatigue,
              reelection: DIFFICULTY_RULES[difficulty].reelectionApproval,
            })}
          </span>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('newGame.ideology')}</span>
          <select className={styles.input} value={ideology} onChange={(e) => setIdeology(e.target.value as IdeologyId)}>
            {IDEOLOGIES.map((id) => (
              <option key={id} value={id}>
                {IDEOLOGY_CONTENT[id].name}
              </option>
            ))}
          </select>
          <span className={styles.hint}>{IDEOLOGY_CONTENT[ideology].summary}</span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('newGame.strategy')}</span>
          <select className={styles.input} value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyId)}>
            {STRATEGIES.map((id) => (
              <option key={id} value={id}>
                {STRATEGY_CONTENT[id].name}
              </option>
            ))}
          </select>
          <span className={styles.hint}>{STRATEGY_CONTENT[strategy].summary}</span>
        </label>

        <fieldset className={styles.optionList}>
          <legend className={styles.fieldLabel}>{t('newGame.options')}</legend>
          {OPTION_IDS.map((id) => (
            <label key={id} className={styles.option}>
              <input
                type="checkbox"
                checked={options[id]}
                onChange={(e) => setOptions({ ...options, [id]: e.target.checked })}
              />
              <span>
                <span className={styles.choiceTitle}>{t(`newGame.option.${id}.title`)}</span>
                <span className={styles.choiceText}>{t(`newGame.option.${id}.text`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.actions}>
          <Button onClick={() => gameStore.getState().goTo('menu')}>{t('common.back')}</Button>
          <Button type="submit" variant="primary">
            {t('newGame.begin')}
          </Button>
        </div>
      </form>
    </main>
  );
}
