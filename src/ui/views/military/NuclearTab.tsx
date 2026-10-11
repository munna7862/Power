import { useState } from 'react';
import {
  NUCLEAR,
  nuclearDeterrence,
  nuclearStage,
  programStarted,
  RIVAL_CONTENT,
  type GameState,
  type NuclearDoctrine,
  type War,
} from '../../../sim';
import { gameStore } from '../../../store';
import { Button, Modal, Panel } from '../../design/primitives';
import { formatCrore } from '../../format';
import gameStyles from '../../screens/game.module.css';
import styles from '../views.module.css';
import { Bar, BarRow } from './parts';

const DOCTRINES: Record<NuclearDoctrine, { label: string; text: string }> = {
  noFirstUse: {
    label: 'No First Use',
    text: 'India will never use nuclear weapons first. Keeps the world and voters calm; a first strike is not possible.',
  },
  firstUse: {
    label: 'First use reserved',
    text: 'India reserves the right to strike first. Deterrence rises about 15%, but approval and relations with every neighbour fall.',
  },
};

const STAGE_LABELS = {
  none: 'Not started',
  research: 'Research',
  enrichment: 'Enrichment',
  warheads: 'Warhead production',
} as const;

export function NuclearTab({ game }: { game: GameState }) {
  const { dispatch } = gameStore.getState();
  const program = game.military.nuclear;
  const [strikeAt, setStrikeAt] = useState<War | null>(null);
  const started = programStarted(program);
  const stage = nuclearStage(program);
  const wars = game.military.wars.filter((w) => w.status === 'active');
  const canStrike = program.warheads > 0 && wars.length > 0;

  return (
    <div className={gameStyles.grid}>
      <Panel title="Nuclear program" className={gameStyles.span8}>
        <p className={styles.note}>
          A secret program takes about {NUCLEAR.researchMonths / 12} years of research, then{' '}
          {NUCLEAR.enrichmentMonths / 12} years of enrichment, then builds a warhead every {NUCLEAR.monthsPerWarhead}{' '}
          months ({formatCrore(NUCLEAR.warheadCost)} each). It costs {formatCrore(NUCLEAR.monthlyCost)} a month. Once it
          is visible to foreign services, sanctions pressure builds; the first warhead brings three years of sanctions,
          national pride and deterrence.
        </p>
        <div className={styles.stack}>
          <BarRow label="Research" value={`${Math.round(program.research)}%`}>
            <Bar value={program.research} tone="accent" label="Nuclear research progress" />
          </BarRow>
          <BarRow label="Enrichment" value={`${Math.round(program.enrichment)}%`}>
            <Bar value={program.enrichment} tone="accent" label="Enrichment progress" />
          </BarRow>
          <p data-testid="nuclear-stage">
            Stage: <strong>{STAGE_LABELS[stage]}</strong> · Warheads:{' '}
            <strong data-testid="warheads">{program.warheads}</strong>
            {program.warheads > 0 && <> · Deterrence bonus +{nuclearDeterrence(program).toFixed(0)}</>}
          </p>
          <div className={styles.cardActions}>
            {!started ? (
              <Button
                variant="primary"
                disabled={game.nation.treasury < NUCLEAR.startCost}
                onClick={() => dispatch({ type: 'START_NUCLEAR_PROGRAM' })}
              >
                Launch the program · {formatCrore(NUCLEAR.startCost)}
              </Button>
            ) : (
              <Button onClick={() => dispatch({ type: 'SET_NUCLEAR_PROGRAM', active: !program.active })}>
                {program.active ? 'Pause the program' : 'Resume the program'}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Doctrine" className={gameStyles.span4}>
        <div className={styles.stack} role="radiogroup" aria-label="Nuclear doctrine">
          {(Object.keys(DOCTRINES) as NuclearDoctrine[]).map((d) => (
            <label key={d} className={styles.choice}>
              <input
                type="radio"
                name="doctrine"
                checked={program.doctrine === d}
                onChange={() => program.doctrine !== d && dispatch({ type: 'SET_NUCLEAR_DOCTRINE', doctrine: d })}
              />
              <span>
                <strong>{DOCTRINES[d].label}</strong>
                <span className={styles.muted}> {DOCTRINES[d].text}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Use of nuclear weapons" className={gameStyles.span12}>
        <div className={styles.dangerZone}>
          <p>
            A nuclear strike destroys most of an enemy army and wins the war, and it also brings near-certain global
            sanctions for five years, a collapse in approval, unrest at home and hostile neighbours. On Hard difficulty
            it ends your presidency.
          </p>
          {wars.length === 0 ? (
            <p className={styles.muted}>Only available during a war.</p>
          ) : program.warheads < 1 ? (
            <p className={styles.muted}>India has no warheads.</p>
          ) : program.doctrine === 'noFirstUse' ? (
            <p className={styles.muted}>
              Doctrine is No First Use: change it above before a first strike can be ordered.
            </p>
          ) : null}
          <div className={styles.cardActions}>
            {wars.map((war) => (
              <Button
                key={war.id}
                className={styles.dangerButton}
                disabled={!canStrike || program.doctrine === 'noFirstUse'}
                aria-label={`Use nuclear weapon against ${RIVAL_CONTENT[war.rival].name}`}
                onClick={() => setStrikeAt(war)}
              >
                Use nuclear weapon against {RIVAL_CONTENT[war.rival].name}
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      {strikeAt && (
        <Modal title="Order a nuclear strike?" onClose={() => setStrikeAt(null)}>
          <p>
            You are about to use a nuclear weapon against {RIVAL_CONTENT[strikeAt.rival].name}. This cannot be undone.
          </p>
          <ul className={styles.effects}>
            <li data-tone="bad">Global sanctions for five years: growth −5 pts, revenue −12%</li>
            <li data-tone="bad">Approval −25 for 18 months; unrest and terror rise nationwide</li>
            <li data-tone="bad">Relations with every country −60</li>
            {game.meta.difficulty === 'hard' && <li data-tone="bad">On Hard difficulty your presidency ends</li>}
            <li data-tone="good">The enemy army is destroyed and the war ends</li>
          </ul>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => setStrikeAt(null)}>
              Stand down
            </Button>
            <Button
              className={styles.dangerButton}
              onClick={() => {
                dispatch({ type: 'USE_NUCLEAR_WEAPON', warId: strikeAt.id });
                setStrikeAt(null);
              }}
            >
              Confirm the strike
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
