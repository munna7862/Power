import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/sim';
import { appendLog } from '../../src/sim/state/log';
import { deepFreeze, newGame } from '../helpers';

describe('dispatch', () => {
  it('renames the president with normalised whitespace', () => {
    const result = dispatch(deepFreeze(newGame()), { type: 'SET_PRESIDENT_NAME', name: '  Vikram   Sen ' });
    expect(result.ok).toBe(true);
    expect(result.state.meta.presidentName).toBe('Vikram Sen');
  });

  it.each([
    ['too short', 'A'],
    ['too long', 'x'.repeat(41)],
  ])('rejects a name that is %s and leaves state unchanged', (_label, name) => {
    const state = newGame();
    const result = dispatch(state, { type: 'SET_PRESIDENT_NAME', name });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it('marks a single inbox entry as read', () => {
    const state = deepFreeze(appendLog(newGame(), { severity: 'warning', title: 'Second', body: '' }));
    const target = state.log[0]!.id;
    const result = dispatch(state, { type: 'MARK_LOG_READ', id: target });
    expect(result.ok).toBe(true);
    expect(result.state.log.map((e) => e.read)).toEqual([true, false]);
  });

  it('fails to mark an unknown inbox entry', () => {
    const result = dispatch(newGame(), { type: 'MARK_LOG_READ', id: 'nope' });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('nope') });
  });

  it('marks all inbox entries as read', () => {
    const state = appendLog(newGame(), { severity: 'info', title: 'Second', body: '' });
    const result = dispatch(state, { type: 'MARK_ALL_LOG_READ' });
    expect(result.state.log.every((e) => e.read)).toBe(true);
  });
});
