import { NotFoundError } from '../errors.js';

export function createBlockchainController(blockchain) {
  return {
    getChain(_request, response) {
      response.json({ chain: blockchain.chain });
    },

    addTransaction(request, response, next) {
      try {
        blockchain.addTransaction(request.body);
        response.status(201).json({
          transaction: blockchain.pendingTransactions.at(-1),
          pendingCount: blockchain.pendingTransactions.length,
        });
      } catch (error) {
        next(error);
      }
    },

    mine(_request, response, next) {
      try {
        const block = blockchain.minePendingTransactions();
        response.status(201).json({ block });
      } catch (error) {
        next(error);
      }
    },

    verify(request, response, next) {
      try {
        const state = blockchain.getCreditState(request.params.id);
        if (!state) {
          throw new NotFoundError('Carbon credit not found.');
        }
        response.json({
          history: blockchain.getCreditHistory(request.params.id),
          state: { ...state, holder: state.company },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
