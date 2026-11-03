# Validation

Checked 3 November 2026.

- Local Linux: npm install, npm test, npm run demo, npm run view and npm run docs passed. No dependency vulnerabilities were reported by npm install.
- npm test exercised all 28 CLI verbs, repeated migrations and seed, repeated fixture imports, first-observed yield, process separation, retests, source isolation, tied timestamps, conflicting reports, count mismatches, immutable evidence, closure evidence, complete export and escaped HTML.
- [Remote validation run](https://github.com/Enterprise-DNA-OS/production-test-for-claude-code/actions/runs/41565987430) passed all five jobs for implementation commit 5d270c0: Windows and Linux on Node 20 and 22, plus PostgreSQL 17.
- 31 slash-command recipes ship. The directory README is a guide and is excluded from the count.
- The fictional demo renders a weekly view and eight internal documents. A headless browser inspected the weekly view and corrective-action record, and the view was narrowed to useful review columns.
- The WATS comparison page passed the canonical page gate with all six displayed price figures sourced and zero brand errors. Three page demonstrations are captured from actual CLI runs in docs/demo-captures.json.

Tests ignore the operator's DATABASE_URL. TEST_DATABASE_URL is accepted only for an explicitly disposable empty database. Private exports and generated reports are not committed. The base has no automatic JSON restore, live collection, equipment control, authenticated multi-user service or product release authority.
