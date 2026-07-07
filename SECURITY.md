# Security Policy

Saathi handles sensitive personal health data. We take security and privacy issues seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Do not open a public GitHub issue for security or privacy problems.** Public issues are visible to everyone, and a disclosed vulnerability in a health app can put real user data at risk before it's fixed.

Instead, report privately to:

**bharatm23@gmail.com**

Please include:

- A description of the issue and the potential impact.
- Steps to reproduce, or a proof of concept.
- The affected area if you know it — frontend, backend, database, or a specific feature.
- Any relevant logs or screenshots, with all personal or health data removed first.

You can expect an acknowledgement within a few days. We'll confirm the issue, keep you updated on the fix, and let you know when it's resolved.

## What to report

Security- and privacy-sensitive issues include, but aren't limited to:

- **Cross-member data exposure** — one family member's health data becoming visible in another's account or answers. This is the most serious class of issue in Saathi.
- **Guardrail bypass** — getting the app to give medical advice, or to answer from data it shouldn't have access to.
- **Authentication or authorization flaws** — accessing accounts, sessions, or records that aren't yours.
- **Exposed secrets** — leaked API keys, tokens, or credentials in the code or history.
- **Data leakage** — sensitive health or personal data exposed through logs, URLs, error messages, or third-party calls.

## Scope

This policy covers the Saathi application in this repository. Saathi is currently a private, closed beta.

## Responsible disclosure

Please give us a reasonable chance to fix a reported issue before disclosing it publicly. We're grateful to everyone who reports responsibly and helps keep users' health data safe.
