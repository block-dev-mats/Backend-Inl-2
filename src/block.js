import { createHash } from 'node:crypto';

// Transaction data uses JSON values. Array order is preserved, object keys sorted.
function stableStringify(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, item[key]]),
      );
    }
    return item;
  });
}

export class Block {
  constructor(index, timestamp, data, previousHash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = structuredClone(data);
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const contents = stableStringify({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      nonce: this.nonce,
    });
    return createHash('sha256').update(contents).digest('hex');
  }

  mineBlock(difficulty) {
    if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 64) {
      throw new RangeError('Difficulty must be an integer between 0 and 64.');
    }

    const prefix = '0'.repeat(difficulty);
    this.hash = this.calculateHash();
    while (!this.hash.startsWith(prefix)) {
      this.nonce += 1;
      this.hash = this.calculateHash();
    }
  }
}
