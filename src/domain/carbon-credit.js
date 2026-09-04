export class TransactionValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransactionValidationError';
    this.code = code;
  }
}

function validatePayload(transaction) {
  if (transaction === null || typeof transaction !== 'object' || Array.isArray(transaction)) {
    throw new TransactionValidationError('INVALID_PAYLOAD', 'Transaction must be an object.');
  }

  for (const field of ['creditId', 'company']) {
    if (typeof transaction[field] !== 'string' || transaction[field].trim() === '') {
      throw new TransactionValidationError('INVALID_PAYLOAD', `${field} must be a non-empty string.`);
    }
  }
  if (!['MINT', 'TRANSFER', 'RETIRE'].includes(transaction.action)) {
    throw new TransactionValidationError('INVALID_PAYLOAD', 'Action must be MINT, TRANSFER or RETIRE.');
  }
  if (!Number.isFinite(transaction.co2Tons) || transaction.co2Tons <= 0) {
    throw new TransactionValidationError('INVALID_PAYLOAD', 'co2Tons must be a positive finite number.');
  }
  // Numeric milliseconds since Unix epoch, within the JavaScript Date range.
  if (!Number.isFinite(transaction.timestamp) || Number.isNaN(new Date(transaction.timestamp).getTime())) {
    throw new TransactionValidationError('INVALID_PAYLOAD', 'Timestamp must be a valid numeric timestamp.');
  }
}

function applyTransaction(state, transaction) {
  validatePayload(transaction);
  const { creditId, action, company, co2Tons } = transaction;
  const credit = state.get(creditId);

  if (action === 'MINT') {
    if (credit) {
      throw new TransactionValidationError('INVALID_TRANSITION', 'Credit already exists.');
    }
    state.set(creditId, { creditId, company, co2Tons, status: 'ACTIVE' });
    return;
  }

  if (!credit) {
    throw new TransactionValidationError('INVALID_TRANSITION', 'Credit does not exist.');
  }
  if (credit.status === 'RETIRED') {
    throw new TransactionValidationError('INVALID_TRANSITION', 'Credit is already retired.');
  }
  if (co2Tons !== credit.co2Tons) {
    throw new TransactionValidationError('INVALID_TRANSITION', 'co2Tons cannot change after MINT.');
  }
  if (action === 'TRANSFER') {
    credit.company = company;
  } else {
    if (company !== credit.company) {
      throw new TransactionValidationError('INVALID_TRANSITION', 'Only the current holder can retire a credit.');
    }
    credit.status = 'RETIRED';
  }
}

function reconstructState(transactions) {
  const state = new Map();
  // Replay ledger order, not timestamp order.
  for (const transaction of transactions) {
    applyTransaction(state, transaction);
  }
  return state;
}

export function validateTransaction(transaction, previousTransactions) {
  const state = reconstructState(previousTransactions);
  applyTransaction(state, transaction);
}

export function getCreditHistory(transactions, creditId) {
  return structuredClone(transactions.filter((transaction) => transaction.creditId === creditId));
}

export function getCreditState(transactions, creditId) {
  const history = getCreditHistory(transactions, creditId);
  return reconstructState(history).get(creditId) ?? null;
}
