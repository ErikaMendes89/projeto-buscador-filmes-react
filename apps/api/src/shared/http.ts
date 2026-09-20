import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => (request, response, next) => {
  void Promise.resolve(handler(request, response, next)).catch(next);
};
