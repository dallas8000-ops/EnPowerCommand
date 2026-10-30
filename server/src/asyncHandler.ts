import type { NextFunction, Request, Response, RequestHandler } from "express";

/** Express 4 does not catch async errors — wrap route handlers so failures return 500. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
