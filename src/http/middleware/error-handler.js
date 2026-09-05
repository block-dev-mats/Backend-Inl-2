import { TransactionValidationError } from '../../domain/carbon-credit.js';
import { NotFoundError } from '../errors.js';

export function notFoundHandler(request, _response, next) {
  next(new NotFoundError(`Route ${request.method} ${request.originalUrl} was not found.`));
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof TransactionValidationError) {
    const status = error.code === 'INVALID_PAYLOAD' ? 400 : 422;
    return response.status(status).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof NotFoundError) {
    return response.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body contains malformed JSON.' },
    });
  }

  console.error(error);
  return response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
  });
}
