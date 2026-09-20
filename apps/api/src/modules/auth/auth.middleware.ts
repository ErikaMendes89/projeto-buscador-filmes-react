import type { RequestHandler } from 'express';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// Contrato temporário: será substituído por sessão opaca no próximo marco.
export const requireSession: RequestHandler = (_request, response, next) => {
  response.locals.userId = DEMO_USER_ID;
  next();
};
