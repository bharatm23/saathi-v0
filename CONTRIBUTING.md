# Contributing to Saathi

Thanks for taking the time to contribute. Saathi is a family health-memory app, and because it handles sensitive health data, the bar for changes here is a little higher than a typical side project — especially anything touching data ingestion, the safety guardrails, or how one family member's data is kept separate from another's. This guide explains how to propose changes in a way that gets merged quickly.

> **Status:** Saathi is currently a private, closed beta. Contributions are limited to invited collaborators. If you've landed here without an invite and want to get involved, open an issue to introduce yourself before sending code.

---

## Before you start

- Read the [`README.md`](./README.md) to get the project running locally. If the setup steps don't work, that's a bug worth an issue on its own.
- Never commit secrets. No `.env`, `.env.local`, API keys, tokens, or real user data — not in code, not in tests, not in fixtures. If you think you've committed one, tell a maintainer immediately rather than force-pushing over it.
- Never use real patient or family health data in examples, screenshots, or test fixtures. Use synthetic data only.

---

## Reporting bugs

Open an issue and include:

- What you expected to happen, and what actually happened.
- Steps to reproduce, as specifically as you can.
- Your environment — browser, OS, and whether it's frontend, backend, or the database.
- Screenshots or logs where they help — but scrub any personal or health data first.

If the bug is a **security or privacy issue** (data leaking across family members, a guardrail being bypassed, exposed credentials), do **not** open a public issue. Contact a maintainer directly so it can be handled before it's visible.

---

## Suggesting features

Open an issue describing the problem the feature solves before the solution you have in mind — Saathi is deliberately scoped, and features are weighed against the product vision, not added because they're possible. A feature that doesn't serve "a shared family health memory, grounded and safe" is unlikely to land, however good it is.

---

## Making a change

We work off `main`, which is the deployed branch. Don't commit to it directly.

1. **Branch off `main`** with a descriptive name:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/short-description   # or fix/, docs/, chore/
   ```
2. **Make your change**, keeping the commit history readable — small, logical commits beat one giant one.
3. **Match the existing style.** TypeScript/React on the frontend, Python/FastAPI on the backend. Follow the patterns already in the files you're editing rather than introducing new ones.
4. **Test locally** — run both the frontend and backend and exercise the actual user path your change affects, not just the happy case.
5. **Push and open a pull request against `main`.**
   ```bash
   git push -u origin feat/short-description
   ```

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) prefixes, which you'll see throughout the history:

- `feat:` a new capability
- `fix:` a bug fix
- `docs:` documentation only
- `chore:` tooling, deps, cleanup
- `refactor:` code change that neither fixes a bug nor adds a feature

Example: `fix(brief): handle empty wearable data case`

Keep the subject line short and in the imperative mood ("add", not "added"). Add a body when the *why* isn't obvious from the diff.

---

## Pull requests

A good PR:

- **Does one thing.** Separate unrelated changes into separate PRs — it makes review faster and rollbacks cleaner.
- **Explains the why**, not just the what. Link the issue it closes.
- **Calls out risk explicitly.** If your change touches any of the areas below, say so in the description so it gets the extra review it needs:
  - **Data ingestion** — lab-report parsing, wearable sync, or the extraction pipeline. Wrong data here means wrong health information reaching a user.
  - **Guardrails** — the medical-query guard or the grounding/context-only prompt logic. These are safety-critical and can't be weakened casually.
  - **Member scoping** — anything passing `memberId` or filtering by `member_id`. A mistake here leaks one family member's health data into another's view. This is the single most sensitive class of change in the codebase.
- **Includes no secrets or real data**, as above.

Expect a maintainer to review before merge. Changes to the three areas above may take longer — that's deliberate, not neglect.

---

## Community expectations

Be respectful and constructive. Assume good faith, keep feedback about the code rather than the person, and remember that everyone here is working toward the same thing: a health tool people can actually trust. Disagreement is fine and useful; hostility isn't.

---

## Questions

If anything here is unclear, open an issue with the `question` label or reach out to a maintainer. Improvements to this guide are welcome too — open a `docs:` PR.
