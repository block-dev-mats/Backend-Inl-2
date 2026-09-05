import express from 'express';
import { createBlockchainController } from './http/controllers/blockchain-controller.js';
import { errorHandler, notFoundHandler } from './http/middleware/error-handler.js';
import { createBlockchainRoutes } from './http/routes/blockchain-routes.js';

export function createApp(blockchain) {
  const app = express();
  const controller = createBlockchainController(blockchain);

  app.use(express.json());
  app.use('/api', createBlockchainRoutes(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
