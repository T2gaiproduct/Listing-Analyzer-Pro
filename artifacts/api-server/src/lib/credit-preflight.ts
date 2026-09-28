import type { Response } from "express";
import {
  getCreditCost,
  hasCreditsTeamAware,
  insufficientCreditsMessage,
  type TeamAwareContext,
} from "./credits.js";

/** Returns true when the account has enough credits; otherwise sends 402 and returns false. */
export async function requireImageCreditsForUnits(
  res: Response,
  creditCtx: TeamAwareContext,
  imageUnits: number,
): Promise<boolean> {
  if (imageUnits <= 0) return true;
  const cost = await getCreditCost("graphics");
  const creditsNeeded = cost.creditsRequired * imageUnits;
  const ok = await hasCreditsTeamAware(creditCtx, cost.creditType, creditsNeeded);
  if (ok) return true;
  res.status(402).json({
    error: await insufficientCreditsMessage(creditCtx, cost.creditType, creditsNeeded),
  });
  return false;
}
