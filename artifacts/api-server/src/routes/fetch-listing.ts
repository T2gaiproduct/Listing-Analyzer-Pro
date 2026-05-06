import { Router, type IRouter } from "express";
import { fetchListing } from "../lib/amazon-fetcher";

const router: IRouter = Router();

router.post("/fetch-listing", async (req, res): Promise<void> => {
  const { asin, url } = req.body as { asin?: string; url?: string };

  if (!asin && !url) {
    res.status(400).json({ error: "Either asin or url must be provided" });
    return;
  }

  try {
    const listing = await fetchListing({ asin, url });
    res.json(listing);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch listing";
    res.status(400).json({ error: message });
  }
});

export default router;
