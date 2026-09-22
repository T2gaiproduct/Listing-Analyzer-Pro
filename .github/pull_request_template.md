## Summary

<!-- What changed and why -->

## Branch flow

- [ ] This PR targets **`staging`** (feature/fix/chore → staging), **or**
- [ ] This PR targets **`main`** (staging → production promotion), **or**
- [ ] This PR is an authorized **hotfix** (`hotfix/*` → `main`)

## Staging → main checklist (required when promoting to production)

- [ ] Application builds successfully (CI green)
- [ ] Frontend verified on staging
- [ ] Backend/API verified on staging
- [ ] Database migrations tested on staging (if applicable)
- [ ] Authentication verified
- [ ] Existing functionality not broken
- [ ] New functionality tested on staging
- [ ] No critical console/server errors on staging
- [ ] At least one approval obtained (for `main`)
- [ ] Review conversations resolved

## Deployment notes

<!-- Staging or production deploy steps, if any -->
