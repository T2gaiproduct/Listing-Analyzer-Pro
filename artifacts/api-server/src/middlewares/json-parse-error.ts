import type { Request, Response, NextFunction } from "express";

function isJsonBodyParseError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const parseErr = err as SyntaxError & { status?: number; type?: string };
  if (parseErr.type === "entity.parse.failed" || parseErr.status === 400) return true;
  // express.json() / body-parser SyntaxErrors (Express 5 may omit status/type)
  return true;
}

/** Map express.json() syntax errors to 400 instead of an unhandled 500. */
export function handleJsonParseError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isJsonBodyParseError(err)) {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }
  next(err);
}
