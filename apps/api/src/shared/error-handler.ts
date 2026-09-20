import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: 'Dados inválidos', code: 'validation_error', details: error.issues });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor', code: 'internal_error' });
};
