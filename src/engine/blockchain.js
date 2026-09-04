import { Block } from './block.js';
import { getCreditHistory, getCreditState, validateTransaction } from '../domain/carbon-credit.js';

function createGenesisBlock() {
  return new Block(0, '2026-01-01T00:00:00.000Z', [], '0');
}

export class Blockchain {
  constructor(difficulty = 2) {
    if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 64) {
      throw new RangeError('Difficulty must be an integer between 0 and 64.');
    }

    // Mining and validation share the chain's configured rule.
    this.difficulty = difficulty;
    this.chain = [createGenesisBlock()];
    this.pendingTransactions = [];
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    const minedTransactions = this.chain.flatMap((block) => block.data);
    validateTransaction(transaction, [...minedTransactions, ...this.pendingTransactions]);
    this.pendingTransactions.push(structuredClone(transaction));
  }

  // Public verification reads confirmed history; pending transactions are excluded.
  getCreditHistory(creditId) {
    return getCreditHistory(this.chain.flatMap((block) => block.data), creditId);
  }

  getCreditState(creditId) {
    return getCreditState(this.chain.flatMap((block) => block.data), creditId);
  }

  minePendingTransactions() {
    const block = new Block(
      this.chain.length,
      new Date().toISOString(),
      this.pendingTransactions,
      this.getLatestBlock().hash,
    );
    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
    return block;
  }

  isChainValid() {
    if (this.chain.length === 0) return false;

    const genesisHash = createGenesisBlock().hash;
    if (this.chain[0].hash !== genesisHash) return false;

    for (let index = 0; index < this.chain.length; index += 1) {
      const block = this.chain[index];
      if (block.index !== index || block.hash !== block.calculateHash()) return false;
      if (index > 0) {
        if (block.previousHash !== this.chain[index - 1].hash) return false;
        if (!block.hash.startsWith('0'.repeat(this.difficulty))) return false;
      }
    }
    return true;
  }
}
