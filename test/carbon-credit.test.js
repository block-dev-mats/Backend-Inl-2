import assert from 'node:assert/strict';
import test from 'node:test';
import { Blockchain } from '../src/engine/blockchain.js';
import { TransactionValidationError } from '../src/domain/carbon-credit.js';

const mint = {
  creditId: 'VERRA-2026-8801',
  action: 'MINT',
  company: 'IKEA',
  co2Tons: 500,
  timestamp: 1772188800000,
};
const transfer = { ...mint, action: 'TRANSFER', company: 'VOLVO', timestamp: mint.timestamp + 1 };
const retire = { ...transfer, action: 'RETIRE', timestamp: mint.timestamp + 2 };

function assertRejected(blockchain, transaction, code = 'INVALID_TRANSITION') {
  const pendingBefore = structuredClone(blockchain.pendingTransactions);
  assert.throws(() => blockchain.addTransaction(transaction), (error) => {
    assert.ok(error instanceof TransactionValidationError);
    assert.equal(error.code, code);
    return true;
  });
  assert.deepEqual(blockchain.pendingTransactions, pendingBefore);
}

test('MINT, TRANSFER and RETIRE produce ordered mined history and current state', () => {
  const blockchain = new Blockchain(1);
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), []);
  assert.equal(blockchain.getCreditState(mint.creditId), null);

  blockchain.addTransaction(mint);
  assert.equal(blockchain.getCreditState(mint.creditId), null);
  blockchain.minePendingTransactions();
  assert.deepEqual(blockchain.getCreditState(mint.creditId), {
    creditId: mint.creditId, company: 'IKEA', co2Tons: 500, status: 'ACTIVE',
  });

  blockchain.addTransaction(transfer);
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), [mint]);
  blockchain.minePendingTransactions();
  assert.equal(blockchain.getCreditState(mint.creditId).company, 'VOLVO');

  blockchain.addTransaction(retire);
  assert.equal(blockchain.getCreditState(mint.creditId).status, 'ACTIVE');
  blockchain.minePendingTransactions();
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), [mint, transfer, retire]);
  assert.deepEqual(blockchain.getCreditState(mint.creditId), {
    creditId: mint.creditId, company: 'VOLVO', co2Tons: 500, status: 'RETIRED',
  });
  assert.deepEqual(blockchain.getCreditHistory('unknown'), []);
  assert.equal(blockchain.getCreditState('unknown'), null);
  assert.equal(blockchain.isChainValid(), true);
});

test('pending transitions follow insertion order and remain separate per credit', () => {
  const blockchain = new Blockchain(1);
  const earlierTransfer = { ...transfer, timestamp: mint.timestamp - 1 };
  blockchain.addTransaction(mint);
  blockchain.addTransaction({ ...mint, creditId: 'OTHER' });
  blockchain.addTransaction(earlierTransfer);
  blockchain.addTransaction(retire);
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), []);
  blockchain.minePendingTransactions();
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), [mint, earlierTransfer, retire]);
  assert.equal(blockchain.getCreditState(mint.creditId).status, 'RETIRED');
  assert.equal(blockchain.getCreditState('OTHER').status, 'ACTIVE');
  assert.equal(blockchain.isChainValid(), true);
});

test('duplicate MINT is rejected against pending and mined transactions', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction(mint);
  assertRejected(blockchain, mint);
  blockchain.minePendingTransactions();
  assertRejected(blockchain, mint);
});

test('TRANSFER and RETIRE of an unknown credit are rejected', () => {
  const blockchain = new Blockchain(1);
  for (const transaction of [transfer, retire]) {
    assertRejected(blockchain, transaction);
  }
});

test('pending and mined RETIRE prevent duplicate RETIRE, TRANSFER and reminting', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction(mint);
  blockchain.minePendingTransactions();
  const retirement = { ...mint, action: 'RETIRE' };
  blockchain.addTransaction(retirement);
  for (const transaction of [retirement, transfer, mint]) {
    assertRejected(blockchain, transaction);
  }
  blockchain.minePendingTransactions();
  for (const transaction of [retirement, transfer, mint]) {
    assertRejected(blockchain, transaction);
  }
});

test('RETIRE requires the holder after both pending and mined transfers', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction(mint);
  blockchain.minePendingTransactions();
  blockchain.addTransaction(transfer);
  assertRejected(blockchain, { ...mint, action: 'RETIRE' });
  blockchain.minePendingTransactions();
  assertRejected(blockchain, { ...mint, action: 'RETIRE' });
  blockchain.addTransaction(retire);
  assert.deepEqual(blockchain.pendingTransactions, [retire]);
});

test('co2Tons cannot change after pending or mined MINT', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction(mint);
  for (const action of ['TRANSFER', 'RETIRE']) {
    assertRejected(blockchain, { ...mint, action, co2Tons: 501 });
  }
  blockchain.minePendingTransactions();
  for (const action of ['TRANSFER', 'RETIRE']) {
    assertRejected(blockchain, { ...mint, action, co2Tons: 501 });
  }
  assert.equal(blockchain.getCreditState(mint.creditId).co2Tons, 500);
});

test('invalid payloads have a distinct error code and never enter the pending pool', () => {
  const blockchain = new Blockchain(1);
  const invalidPayloads = [null, undefined, [], 'transaction', 42, {}];
  const invalidFields = {
    creditId: ['', '  ', 123, null, undefined],
    company: ['', '\t', 123, null, undefined],
    action: ['mint', 'DELETE', null, undefined],
    co2Tons: [0, -1, Infinity, -Infinity, NaN, '500', null, undefined],
    timestamp: [NaN, Infinity, -Infinity, 8640000000000001, '1772188800000', null, undefined],
  };
  for (const [field, values] of Object.entries(invalidFields)) {
    for (const value of values) {
      invalidPayloads.push({ ...mint, [field]: value });
    }
  }
  for (const payload of invalidPayloads) {
    assertRejected(blockchain, payload, 'INVALID_PAYLOAD');
  }
  blockchain.addTransaction({ ...mint, co2Tons: 0.5, timestamp: 0 });
  assert.equal(blockchain.pendingTransactions.length, 1);
});

test('caller mutations cannot change accepted pending transactions or later validation', () => {
  const blockchain = new Blockchain(1);
  const transaction = { ...mint };
  blockchain.addTransaction(transaction);
  transaction.creditId = 'CHANGED';
  transaction.action = 'RETIRE';
  transaction.company = 'OTHER';
  transaction.co2Tons = 999;
  transaction.timestamp = 0;
  assert.deepEqual(blockchain.pendingTransactions, [mint]);
  assertRejected(blockchain, mint);
  blockchain.addTransaction(transfer);
  blockchain.minePendingTransactions();
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), [mint, transfer]);
  assert.equal(blockchain.getCreditState(mint.creditId).company, 'VOLVO');
  assert.equal(blockchain.getCreditState('CHANGED'), null);
});

test('history and state results cannot mutate stored transactions', () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction(mint);
  blockchain.minePendingTransactions();
  blockchain.getCreditHistory(mint.creditId)[0].co2Tons = 999;
  blockchain.getCreditState(mint.creditId).company = 'OTHER';
  assert.deepEqual(blockchain.getCreditHistory(mint.creditId), [mint]);
  assert.equal(blockchain.getCreditState(mint.creditId).company, 'IKEA');
  assert.equal(blockchain.isChainValid(), true);
});
