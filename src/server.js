import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';
import { getPowDifficulty } from './config.js';
import { Blockchain } from './engine/blockchain.js';

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const blockchain = new Blockchain(getPowDifficulty());
const app = createApp(blockchain);
const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
