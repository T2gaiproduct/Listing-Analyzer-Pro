# GitHub repository scripts

## Branch protection

After `.github/workflows/ci.yml` is on the default branches, a repository **admin** should run:

```bash
bash scripts/github/apply-branch-protection.sh
```

If the required status check does not match, open **Settings → Branches** or **Rules** and select **`CI / typecheck`** (GitHub’s display name for the `typecheck` job).

Manual setup guide: [.github/BRANCHING.md](../.github/BRANCHING.md)
