# Carbon Credit Blockchain API

A small Node.js API that tracks carbon credits on a Proof-of-Work blockchain. Credits can be created with `MINT`, assigned to a new holder with `TRANSFER`, and permanently retired with `RETIRE`.

The blockchain and pending transactions are stored only in memory. When the server restarts, a new chain is created from the genesis block.

## Requirements

- Node.js 22 or later
- npm

## Installation

```bash
npm install
cp .env.example .env
```

## Configuration

```env
POW_DIFFICULTY=2
PORT=3000
```

`POW_DIFFICULTY` sets the number of leading zeroes required in a valid block hash. It must be an integer between 0 and 64 and defaults to `2`. `PORT` sets the server port and defaults to `3000`.

## Starting the server

```bash
npm start
```

For development with automatic restarts:

```bash
npm run dev
```

With the default port, the server is available at `http://localhost:3000`.

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/chain` | Returns the complete blockchain. |
| `POST` | `/api/transactions` | Validates a transaction and adds it to the pending transactions. |
| `POST` | `/api/mine` | Mines the pending transactions into a new block and clears them. |
| `GET` | `/api/verify/:id` | Returns the mined history and current state of a credit. |

An unknown credit at `/api/verify/:id` returns `404`. Invalid payloads return `400`, while transactions that violate the credit state return `422`.

## Example: MINT → TRANSFER → RETIRE

Send each payload to `POST /api/transactions`. Then call `POST /api/mine` to add the pending transactions to a block.

Create the credit:

```json
{
  "creditId": "VERRA-2026-8801",
  "action": "MINT",
  "company": "IKEA",
  "co2Tons": 500,
  "timestamp": 1772188800000
}
```

Transfer the credit:

```json
{
  "creditId": "VERRA-2026-8801",
  "action": "TRANSFER",
  "company": "VOLVO",
  "co2Tons": 500,
  "timestamp": 1772188800001
}
```

Retire the credit:

```json
{
  "creditId": "VERRA-2026-8801",
  "action": "RETIRE",
  "company": "VOLVO",
  "co2Tons": 500,
  "timestamp": 1772188800002
}
```

After mining, `GET /api/verify/VERRA-2026-8801` returns the transactions in `history` and a `state` object containing the credit's `status`, `holder`, and `co2Tons`.

## State rules

- `MINT` requires a new `creditId`.
- `TRANSFER` requires an existing credit that is not `RETIRED`. The company in the transaction becomes the new holder.
- `RETIRE` requires an existing active credit and must be performed by its current holder.
- A credit cannot be transferred or retired after `RETIRE`.
- `co2Tons` must be positive and cannot change after `MINT`.
- Both mined and pending transactions are considered when validating a new transaction.

## Tests and checks

Run the full test suite:

```bash
npm test
```

Check the JavaScript syntax:

```bash
npm run check
```

## Project structure

```text
src/
├── engine/     # Blocks, hashing, the blockchain, and Proof of Work
├── domain/     # Carbon credit state and validation rules
├── http/       # Controllers, routes, and central error handling
├── app.js      # Creates the Express application
├── config.js   # Reads and validates Proof-of-Work configuration
└── server.js   # Loads .env and starts the HTTP server
test/           # Unit and integration tests
```
