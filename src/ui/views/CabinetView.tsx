import { useState } from 'react';
import {
  allEfficiencies,
  IDEOLOGIES,
  IDEOLOGY_CONTENT,
  MINISTRIES,
  MINISTRY_CONTENT,
  policyCooldownDays,
  POLICY_CHANGE_COST,
  RESHUFFLE_APPROVAL,
  STRATEGIES,
  STRATEGY_CONTENT,
  type IdeologyId,
  type Minister,
  type MinistryId,
  type RegionId,
  type StrategyId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Avatar } from '../Avatar';
import { Button, Modal, Panel } from '../design/primitives';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

const REGION_LABELS: Record<RegionId, string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  central: 'Central',
  northEast: 'North-East',
};

function Traits({ minister }: { minister: Minister }) {
  const rows: { label: string; value: number; good: boolean }[] = [
    { label: 'Competence', value: minister.competence, good: true },
    { label: 'Loyalty', value: minister.loyalty, good: true },
    { label: 'Corruption', value: minister.corruption, good: false },
  ];
  return (
    <div className={styles.traits}>
      {rows.map((r) => {
        const quality = r.good ? r.value : 100 - r.value;
        const colour = quality >= 60 ? 'var(--green)' : quality >= 40 ? 'var(--warning)' : 'var(--danger)';
        return (
          <span key={r.label} style={{ display: 'contents' }}>
            <span>{r.label}</span>
            <span className={styles.trait} aria-hidden="true">
              <span className={styles.traitFill} style={{ width: `${r.value}%`, background: colour }} />
            </span>
            <span>{Math.round(r.value)}</span>
          </span>
        );
      })}
    </div>
  );
}

function Person({ minister }: { minister: Minister }) {
  return (
    <>
      <Avatar seed={minister.avatarSeed} gender={minister.gender} label={`Portrait of ${minister.name}`} />
      <div>
        <div className={styles.personName}>{minister.name}</div>
        <div className={styles.muted}>
          {REGION_LABELS[minister.region]} ·{' '}
          <span className={styles.tag}>{IDEOLOGY_CONTENT[minister.ideology].name}</span>
        </div>
      </div>
    </>
  );
}

function CandidateModal({ ministry, onClose }: { ministry: MinistryId; onClose: () => void }) {
  const candidates = useGame((s) => s.game?.cabinet.candidates[ministry] ?? []);
  const occupied = useGame((s) => s.game?.cabinet.ministers[ministry] !== null);
  const appoint = (id: string) => {
    if (gameStore.getState().dispatch({ type: 'APPOINT_MINISTER', ministry, candidateId: id })) onClose();
  };
  return (
    <Modal title={`Appoint: ${MINISTRY_CONTENT[ministry].name}`} onClose={onClose}>
      {occupied && (
        <p className={styles.note}>
          Replacing the serving minister costs {RESHUFFLE_APPROVAL} approval for three months and dents the loyalty of
          the rest of the cabinet.
        </p>
      )}
      {candidates.length === 0 ? (
        <p className={styles.muted}>No candidates left this year. A new pool arrives on 1 January.</p>
      ) : (
        <div className={styles.candidates}>
          {candidates.map((c) => (
            <div key={c.id} className={styles.candidate}>
              <Person minister={c} />
              <div style={{ minWidth: 180 }}>
                <Traits minister={c} />
                <div className={styles.cardActions} style={{ marginTop: 8 }}>
                  <Button variant="primary" aria-label={`Appoint ${c.name}`} onClick={() => appoint(c.id)}>
                    Appoint
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PolicyPicker<Id extends IdeologyId | StrategyId>({
  kind,
  ids,
  current,
  content,
}: {
  kind: 'ideology' | 'strategy';
  ids: readonly Id[];
  current: Id;
  content: Record<Id, { name: string; summary: string }>;
}) {
  const game = useGame((s) => s.game);
  const [choice, setChoice] = useState<Id>(current);
  if (!game) return null;
  const wait = policyCooldownDays(game, kind);
  const cost = POLICY_CHANGE_COST[kind];
  const apply = () =>
    gameStore
      .getState()
      .dispatch(
        kind === 'ideology'
          ? { type: 'SET_IDEOLOGY', ideology: choice as IdeologyId }
          : { type: 'SET_STRATEGY', strategy: choice as StrategyId },
      );
  const title = kind === 'ideology' ? 'Ideology' : 'Development strategy';
  return (
    <Panel title={title}>
      <select
        className={styles.select}
        value={choice}
        aria-label={title}
        onChange={(e) => setChoice(e.target.value as Id)}
      >
        {ids.map((id) => (
          <option key={id} value={id}>
            {content[id].name}
            {id === current ? ' (current)' : ''}
          </option>
        ))}
      </select>
      <p className={styles.muted}>{content[choice].summary}</p>
      <div className={styles.actions}>
        <span className={styles.note}>
          {wait > 0
            ? `Can change again in ${wait} days`
            : `Changing costs ${cost.value} approval for ${Math.round(cost.days / 30)} months`}
        </span>
        <Button variant="primary" disabled={choice === current || wait > 0} onClick={apply}>
          Adopt {content[choice].name}
        </Button>
      </div>
    </Panel>
  );
}

export function CabinetView() {
  const game = useGame((s) => s.game);
  const [appointing, setAppointing] = useState<MinistryId | null>(null);
  if (!game) return null;
  const efficiency = allEfficiencies(game);

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Cabinet</h1>
          <p className={gameStyles.viewSubtitle}>Competent, honest ministers make every rupee go further</p>
        </div>
      </div>

      <div className={styles.programme} style={{ marginBottom: 16 }}>
        <PolicyPicker
          key={`ideology-${game.politics.ideology}`}
          kind="ideology"
          ids={IDEOLOGIES}
          current={game.politics.ideology}
          content={IDEOLOGY_CONTENT}
        />
        <PolicyPicker
          key={`strategy-${game.politics.strategy}`}
          kind="strategy"
          ids={STRATEGIES}
          current={game.politics.strategy}
          content={STRATEGY_CONTENT}
        />
      </div>

      <div className={styles.cabinetGrid}>
        {MINISTRIES.map((m) => {
          const minister = game.cabinet.ministers[m];
          return (
            <article key={m} className={styles.ministryCard} aria-label={MINISTRY_CONTENT[m].shortName}>
              <span className={styles.ministryName}>{MINISTRY_CONTENT[m].name}</span>
              <div className={styles.ministryHead}>
                {minister ? (
                  <Person minister={minister} />
                ) : (
                  <div>
                    <div className={styles.personName}>Vacant</div>
                    <div className={styles.muted}>Run by a senior civil servant</div>
                  </div>
                )}
              </div>
              {minister && <Traits minister={minister} />}
              <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                <span className={styles.note}>
                  Efficiency <strong>{Math.round(efficiency[m] * 100)}%</strong>
                </span>
                <span className={styles.cardActions}>
                  {minister && (
                    <Button
                      variant="ghost"
                      aria-label={`Dismiss ${minister.name}`}
                      onClick={() => gameStore.getState().dispatch({ type: 'DISMISS_MINISTER', ministry: m })}
                    >
                      Dismiss
                    </Button>
                  )}
                  <Button
                    aria-label={`Choose minister for ${MINISTRY_CONTENT[m].shortName}`}
                    onClick={() => setAppointing(m)}
                  >
                    {minister ? 'Replace' : 'Appoint'}
                  </Button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {appointing && <CandidateModal ministry={appointing} onClose={() => setAppointing(null)} />}
    </>
  );
}
