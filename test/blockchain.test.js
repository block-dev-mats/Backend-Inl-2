import assert from 'node:assert/strict';
import test from 'node:test';
import { Block } from '../src/block.js';
import { Blockchain } from '../src/blockchain.js';

const timestamp = '2026-01-02T00:00:00.000Z';

test('mining meets difficulty and changes nonce', () => {
  const block = new Block(1, timestamp, [{ amount: 10 }], 'previous');
  const originalNonce = block.nonce;
  assert.ok(!block.hash.startsWith('00'));
  block.mineBlock(2);
  assert.ok(block.hash.startsWith('00'));
  assert.ok(block.nonce > originalNonce);
  assert.equal(block.hash, block.calculateHash());
});

test('object key order does not affect the hash, including nested objects', () => {
  const first = { amount: 10, details: { project: 'Forest', tags: [{ a: 1, b: 2 }] } };
  const second = { details: { tags: [{ b: 2, a: 1 }], project: 'Forest' }, amount: 10 };
  assert.equal(
    new Block(1, timestamp, first, 'previous').hash,
    new Block(1, timestamp, second, 'previous').hash,
  );
});

test('mining drains pending transactions and preserves earlier blocks and data', () => {
  const blockchain = new Blockchain(2);
  const genesis = structuredClone(blockchain.chain[0]);
  const transaction = { amount: 10 };
  blockchain.addTransaction(transaction);
  assert.deepEqual(blockchain.pendingTransactions, [transaction]);
  const mined = blockchain.minePendingTransactions();
  assert.equal(blockchain.getLatestBlock(), mined);
  assert.equal(mined.previousHash, genesis.hash);
  assert.ok(mined.hash.startsWith('00'));
  assert.deepEqual(mined.data, [{ amount: 10 }]);
  assert.deepEqual(blockchain.pendingTransactions, []);
  const snapshot = structuredClone(mined);
  transaction.amount = 999;
  blockchain.addTransaction({ amount: 5 });
  blockchain.minePendingTransactions();
  assert.ok(blockchain.getLatestBlock().hash.startsWith('00'));
  assert.deepEqual(structuredClone(blockchain.chain[0]), genesis);
  assert.deepEqual(structuredClone(mined), snapshot);
  assert.equal(blockchain.isChainValid(), true);
});

test('tampering with mined data or a hash link invalidates the chain', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction({ amount: 10 });
  const block = blockchain.minePendingTransactions();
  blockchain.minePendingTransactions();
  assert.ok(block.hash.startsWith('0'));
  assert.equal(blockchain.isChainValid(), true);
  block.data[0].amount = 20;
  assert.equal(blockchain.isChainValid(), false);
  block.data[0].amount = 10;
  assert.equal(blockchain.isChainValid(), true);
  block.previousHash = 'wrong';
  block.hash = block.calculateHash();
  assert.equal(blockchain.isChainValid(), false);
});

test('genesis is deterministic and cannot be replaced by rehashing', () => {
  const blockchain = new Blockchain();
  assert.deepEqual(blockchain.chain[0], new Blockchain().chain[0]);
  assert.equal(blockchain.isChainValid(), true);
  blockchain.chain[0].timestamp = timestamp;
  blockchain.chain[0].hash = blockchain.chain[0].calculateHash();
  assert.equal(blockchain.isChainValid(), false);
});

test('rehashing a tampered mined block without valid proof of work invalidates the chain', () => {
  const blockchain = new Blockchain(2);
  blockchain.addTransaction({ amount: 10 });
  const block = blockchain.minePendingTransactions();
  const minedNonce = block.nonce;
  assert.equal(blockchain.isChainValid(), true);

  // A changed hash can coincidentally meet PoW, so select a change that does not.
  do {
    block.data[0].amount += 1;
    block.hash = block.calculateHash();
  } while (block.hash.startsWith('00'));

  assert.equal(block.nonce, minedNonce);
  assert.equal(block.hash, block.calculateHash());
  assert.equal(block.previousHash, blockchain.chain[0].hash);
  assert.equal(blockchain.isChainValid(), false);

  block.mineBlock(blockchain.difficulty);
  assert.equal(blockchain.isChainValid(), true);
});

test('lowering a block-local difficulty cannot bypass the chain proof of work', () => {
  const blockchain = new Blockchain(2);
  blockchain.addTransaction({ amount: 10 });
  const block = blockchain.minePendingTransactions();
  const minedNonce = block.nonce;
  assert.equal(blockchain.isChainValid(), true);

  block.difficulty = 0;
  do {
    block.data[0].amount += 1;
    block.hash = block.calculateHash();
  } while (block.hash.startsWith('00'));

  assert.equal(block.nonce, minedNonce);
  assert.equal(block.hash, block.calculateHash());
  assert.equal(block.previousHash, blockchain.chain[0].hash);
  assert.equal(blockchain.isChainValid(), false);
});
