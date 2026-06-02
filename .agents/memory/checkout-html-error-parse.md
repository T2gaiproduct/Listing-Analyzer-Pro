---
name: "Cryptic 'string did not match the expected pattern' on checkout"
description: WebKit JSON-parse error symptom that actually means the server returned an HTML error page; fix is server-side JSON error handling.
---

# "The string did not match the expected pattern" on Stripe checkout

When a fetch handler does `if (!r.ok) throw new Error((await r.json()).error)` and the
server route throws an **unhandled** exception (e.g. a Stripe SDK error), Express returns
its default **HTML** error page. `r.json()` then fails to parse the HTML, and WebKit/Safari
surfaces this as `TypeError: The string did not match the expected pattern` — a misleading
client-side message that looks like a Stripe/regex validation error but is really a JSON
parse failure.

**Why:** The cryptic message is a symptom, not the cause. The real failure is on the server
and is hidden because the response body is HTML, not JSON.

**How to apply:** Any Express route the client calls with `(await r.json()).error` must be
wrapped so it ALWAYS returns JSON on error (`res.status(5xx).json({ error })`). Don't chase
the client-side "expected pattern" string — check server logs for the unhandled error.
Log the full error server-side; return a generic user-safe message to the client.
