import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  type StrategyId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Avatar } from '../Avatar';
import { Button, Modal, Panel } from '../design/primitives';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

const TRAITS = [
  { id: 'competence', good: true },
  { id: 'loyalty', good: true },
  { id: 'corruption', good: false },
] as const;

function Traits({ minister }: { minister: Minister }) {
  const { t } = useTranslation();
  return (
    <div className={styles.traits}>
      {TRAITS.map((r) => {
        const value = minister[r.id];
        const quality = r.good ? value : 100 - value;
        const colour = quality >= 60 ? 'var(--green)' : quality >= 40 ? 'var(--warning)' : 'var(--danger)';
        return (
          <span key={r.id} style={{ display: 'contents' }}>
            <span>{t(`cabinet.traits.${r.id}`)}</span>
            <span className={styles.trait} aria-hidden="true">
              <span className={styles.traitFill} style={{ width: `${value}%`, background: colour }} />
            </span>
            <span>{Math.round(value)}</span>
          </span>
        );
      })}
    </div>
  );
}

function Person({ minister }: { minister: Minister }) {
  const { t } = useTranslation();
  return (
    <>
      <Avatar
        seed={minister.avatarSeed}
        gender={minister.gender}
        label={t('cabinet.portrait', { name: minister.name })}
      />
      <div>
        <div className={styles.personName}>{minister.name}</div>
        <div className={styles.muted}>
          {t(`regions.${minister.region}`)} ·{' '}
          <span className={styles.tag}>{IDEOLOGY_CONTENT[minister.ideology].name}</span>
        </div>
      </div>
    </>
  );
}

function CandidateModal({ ministry, onClose }: { ministry: MinistryId; onClose: () => void }) {
  const { t } = useTranslation();
  const candidates = useGame((s) => s.game?.cabinet.candidates[ministry] ?? []);
  const occupied = useGame((s) => s.game?.cabinet.ministers[ministry] !== null);
  const appoint = (id: string) => {
    if (gameStore.getState().dispatch({ type: 'APPOINT_MINISTER', ministry, candidateId: id })) onClose();
  };
  return (
    <Modal title={t('cabinet.appointTitle', { ministry: MINISTRY_CONTENT[ministry].name })} onClose={onClose}>
      {occupied && <p className={styles.note}>{t('cabinet.reshuffle', { cost: RESHUFFLE_APPROVAL })}</p>}
      {candidates.length === 0 ? (
        <p className={styles.muted}>{t('cabinet.noCandidates')}</p>
      ) : (
        <div className={styles.candidates}>
          {candidates.map((c) => (
            <div key={c.id} className={styles.candidate}>
              <Person minister={c} />
              <div style={{ minWidth: 180 }}>
                <Traits minister={c} />
                <div className={styles.cardActions} style={{ marginTop: 8 }}>
                  <Button
                    variant="primary"
                    aria-label={t('cabinet.appointName', { name: c.name })}
                    onClick={() => appoint(c.id)}
                  >
                    {t('cabinet.appoint')}
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
  const { t } = useTranslation();
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
  const heading = kind === 'ideology' ? t('newGame.ideology') : t('newGame.strategy');
  return (
    <Panel title={heading}>
      <select
        className={styles.select}
        value={choice}
        aria-label={heading}
        onChange={(e) => setChoice(e.target.value as Id)}
      >
        {ids.map((id) => (
          <option key={id} value={id}>
            {id === current ? t('cabinet.current', { name: content[id].name }) : content[id].name}
          </option>
        ))}
      </select>
      <p className={styles.muted}>{content[choice].summary}</p>
      <div className={styles.actions}>
        <span className={styles.note}>
          {wait > 0
            ? t('cabinet.policyWait', { count: wait })
            : t('cabinet.policyCost', { cost: cost.value, months: Math.round(cost.days / 30) })}
        </span>
        <Button variant="primary" disabled={choice === current || wait > 0} onClick={apply}>
          {t('cabinet.adopt', { name: content[choice].name })}
        </Button>
      </div>
    </Panel>
  );
}

export function CabinetView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [appointing, setAppointing] = useState<MinistryId | null>(null);
  if (!game) return null;
  const efficiency = allEfficiencies(game);

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.cabinet')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('cabinet.subtitle')}</p>
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
                    <div className={styles.personName}>{t('cabinet.vacant')}</div>
                    <div className={styles.muted}>{t('cabinet.civilServant')}</div>
                  </div>
                )}
              </div>
              {minister && <Traits minister={minister} />}
              <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                <span className={styles.note}>
                  {t('cabinet.efficiency')} <strong>{Math.round(efficiency[m] * 100)}%</strong>
                </span>
                <span className={styles.cardActions}>
                  {minister && (
                    <Button
                      variant="ghost"
                      aria-label={t('cabinet.dismissName', { name: minister.name })}
                      onClick={() => gameStore.getState().dispatch({ type: 'DISMISS_MINISTER', ministry: m })}
                    >
                      {t('cabinet.dismiss')}
                    </Button>
                  )}
                  <Button
                    aria-label={t('cabinet.chooseFor', { ministry: MINISTRY_CONTENT[m].shortName })}
                    onClick={() => setAppointing(m)}
                  >
                    {minister ? t('cabinet.replace') : t('cabinet.appoint')}
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
