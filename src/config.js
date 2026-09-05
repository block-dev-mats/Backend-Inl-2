export function getPowDifficulty(value = process.env.POW_DIFFICULTY) {
  if (value === undefined) return 2;

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('POW_DIFFICULTY must be an integer between 0 and 64.');
  }

  const difficulty = Number(value);
  if (difficulty > 64) {
    throw new Error('POW_DIFFICULTY must be an integer between 0 and 64.');
  }
  return difficulty;
}
