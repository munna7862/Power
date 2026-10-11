import { describe, expect, it } from 'vitest';
import { groupIndian } from '../../src/sim';

describe('groupIndian', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [100000, '1,00,000'],
    [12345678, '1,23,45,678'],
    [-350000, '-3,50,000'],
    [1234.6, '1,235'],
  ])('formats %d as %s', (input, expected) => {
    expect(groupIndian(input)).toBe(expected);
  });
});
