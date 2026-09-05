import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { Blockchain } from '../src/engine/blockchain.js';

const mint = {
  creditId: 'VERRA-2026-8801',
  action: 'MINT',
  company: 'IKEA',
  co2Tons: 500,
  timestamp: 1772188800000,
};
const transfer = { ...mint, action: 'TRANSFER', company: 'VOLVO', timestamp: mint.timestamp + 1 };
const retire = { ...transfer, action: 'RETIRE', timestamp: mint.timestamp + 2 };

async function withApi(blockchain, callback) {
  const server = createApp(blockchain).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function request(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

function jsonPost(body) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

test('the four API routes support a complete credit lifecycle', async () => {
  const blockchain = new Blockchain(1);
  await withApi(blockchain, async (baseUrl) => {
    let result = await request(baseUrl, '/api/chain');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.chain.length, 1);

    for (const transaction of [mint, transfer, retire]) {
      result = await request(baseUrl, '/api/transactions', jsonPost(transaction));
      assert.equal(result.response.status, 201);
      assert.deepEqual(result.body.transaction, transaction);
      assert.equal(result.body.pendingCount, 1);

      result = await request(baseUrl, '/api/mine', { method: 'POST' });
      assert.equal(result.response.status, 201);
      assert.deepEqual(result.body.block.data, [transaction]);
      assert.ok(result.body.block.hash.startsWith('0'));
    }

    result = await request(baseUrl, '/api/chain');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.chain.length, 4);

    result = await request(baseUrl, `/api/verify/${mint.creditId}`);
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.history, [mint, transfer, retire]);
    assert.deepEqual(result.body.state, {
      creditId: mint.creditId,
      company: 'VOLVO',
      holder: 'VOLVO',
      co2Tons: 500,
      status: 'RETIRED',
    });
  });
});

test('payload and state errors return 400 and 422 without adding transactions', async () => {
  const blockchain = new Blockchain(1);
  await withApi(blockchain, async (baseUrl) => {
    let result = await request(baseUrl, '/api/transactions', jsonPost({ ...mint, co2Tons: 0 }));
    assert.equal(result.response.status, 400);
    assert.equal(result.body.error.code, 'INVALID_PAYLOAD');
    assert.equal(blockchain.pendingTransactions.length, 0);

    result = await request(baseUrl, '/api/transactions', jsonPost(mint));
    assert.equal(result.response.status, 201);
    result = await request(baseUrl, '/api/transactions', jsonPost(mint));
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error.code, 'INVALID_TRANSITION');
    assert.deepEqual(blockchain.pendingTransactions, [mint]);
  });
});

test('malformed JSON receives a consistent 400 response', async () => {
  await withApi(new Blockchain(1), async (baseUrl) => {
    const result = await request(baseUrl, '/api/transactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"creditId":',
    });
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { code: 'INVALID_JSON', message: 'Request body contains malformed JSON.' },
    });
  });
});

test('unknown credits and routes receive consistent 404 responses', async () => {
  await withApi(new Blockchain(1), async (baseUrl) => {
    let result = await request(baseUrl, '/api/verify/UNKNOWN');
    assert.equal(result.response.status, 404);
    assert.equal(result.body.error.code, 'NOT_FOUND');

    result = await request(baseUrl, '/api/unknown');
    assert.equal(result.response.status, 404);
    assert.equal(result.body.error.code, 'NOT_FOUND');
  });
});

test('unexpected failures return a safe 500 response', async () => {
  const blockchain = new Blockchain(1);
  blockchain.addTransaction = () => { throw new Error('private detail'); };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await withApi(blockchain, async (baseUrl) => {
      const result = await request(baseUrl, '/api/transactions', jsonPost(mint));
      assert.equal(result.response.status, 500);
      assert.deepEqual(result.body, {
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
      });
      assert.equal(JSON.stringify(result.body).includes('private detail'), false);
    });
  } finally {
    console.error = originalConsoleError;
  }
});
