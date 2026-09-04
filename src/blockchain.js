import { Block } from './block.js';

function createGenesisBlock() {
  return new Block(0, '2026-01-01T00:00:00.000Z', [], '0');
}

export class Blockchain {
  constructor() {
    this.chain = [createGenesisBlock()];
    this.pendingTransactions = [];
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions(difficulty) {
    const block = new Block(
      this.chain.length,
      new Date().toISOString(),
      this.pendingTransactions,
      this.getLatestBlock().hash,
    );
    block.mineBlock(difficulty);
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
        if (!Number.isInteger(block.difficulty) || block.difficulty < 0 || block.difficulty > 64) {
          return false;
        }
        if (!block.hash.startsWith('0'.repeat(block.difficulty))) return false;
      }
    }
    return true;
  }
}
