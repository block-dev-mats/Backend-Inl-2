import { Router } from 'express';

export function createBlockchainRoutes(controller) {
  const router = Router();
  router.get('/chain', controller.getChain);
  router.post('/transactions', controller.addTransaction);
  router.post('/mine', controller.mine);
  router.get('/verify/:id', controller.verify);
  return router;
}
