import assert from 'node:assert/strict';
import test from 'node:test';
import { getPowDifficulty } from '../src/config.js';

test('POW_DIFFICULTY has a development default and accepts valid integers', () => {
  assert.equal(getPowDifficulty(undefined), 2);
  assert.equal(getPowDifficulty('0'), 0);
  assert.equal(getPowDifficulty('3'), 3);
  assert.equal(getPowDifficulty('64'), 64);
});

test('invalid POW_DIFFICULTY values fail with a clear message', () => {
  for (const value of ['', '-1', '2.5', 'fast', '65', null]) {
    assert.throws(() => getPowDifficulty(value), {
      message: 'POW_DIFFICULTY must be an integer between 0 and 64.',
    });
  }
});
