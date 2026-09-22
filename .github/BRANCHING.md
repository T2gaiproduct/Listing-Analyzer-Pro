# SellerLens Git branching workflow

## Branches

| Branch | Purpose | Deploy target |
|--------|---------|----------------|
| **`main`** | Production-ready code only | **Production** |
| **`staging`** | Integration and QA before production | **Staging** |

Never use `main` for day-to-day development. Never use the **production** database or production `.env` for staging tests.

---

## Required promotion flow

```
feature/<name>  (or fix/<name>, chore/<name>)
        │
        ▼  Pull Request + review + CI
    staging  ──► deploy staging ──► test ──► fix ──► retest
        │
        ▼  Pull Request + ≥1 approval + CI + resolved conversations
      main  ──► production deploy
```

### Start work

```bash
git fetch origin
git checkout staging
git pull origin staging
git checkout -b feature/my-change   # optional but recommended
```

### Ship to staging

```bash
git add .
git commit -m "feat: describe the change"
git push -u origin feature/my-change
```

Open a **Pull Request: `feature/my-change` → `staging`**. Merge after CI passes and review (team policy).

### Promote to production

After staging is deployed and tested:

1. Open **Pull Request: `staging` → `main`**
2. Complete the PR checklist (build, auth, migrations, regression, new features)
3. Obtain **at least one approval**
4. Ensure **CI / typecheck** is green
5. Resolve all review conversations
6. Merge (no direct push to `main`)

---

## If you are on `main`

Do **not** edit production code on `main`. Switch to staging first:

```bash
git checkout staging
git pull origin staging
git checkout -b feature/my-change
```

---

## Emergency hotfix (production)

1. Branch from **`main`**: `hotfix/<short-description>`
2. Minimal fix only; PR **`hotfix/...` → `main`**
3. After merge to `main`, **immediately** merge or cherry-pick the same fix into **`staging`** so staging is not behind production

---

## GitHub branch protection (repository settings)

Repo admins must enforce rules on GitHub (the Cloud Agent token cannot set these automatically).

Run from a machine with **admin** access:

```bash
bash scripts/github/apply-branch-protection.sh
```

Or configure manually under **Settings → Rules → Rulesets** (see script comments for equivalent settings).

### `main` (strict)

- Pull requests required; **no direct pushes**
- **≥ 1** approving review
- **Required status check:** `CI / typecheck` (or job name `typecheck` from `.github/workflows/ci.yml`)
- Require branches to be up to date before merge
- Require **conversation resolution** before merge
- **Block force push** and **block deletion**
- Do not merge broken or untested work

### `staging`

- **Block force push** and **block deletion**
- PRs recommended for feature work; direct pushes may be allowed for integrators (team choice)
- Always deploy and test on staging before opening `staging` → `main`

---

## Secrets and environments

- Do **not** commit `.env`, API keys, passwords, or tokens
- Staging and production use **separate** databases and environment variables
- Do not copy production credentials into staging

---

## Cloud Agent / Cursor branches

Automated agents may use `cursor/<description>-<id>` branches. Those changes should still land via **`staging` first**, then **`main`**, unless an authorized hotfix process applies.
