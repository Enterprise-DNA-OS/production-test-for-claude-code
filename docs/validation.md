# Validation

Local Linux execution on 3 November 2026: npm install completed without reported vulnerabilities. npm test passed all 28 CLI verbs, with meaningful assertions on imports, yield, source isolation, evidence, closures, exports and HTML escaping. npm run demo, npm run view and npm run docs are part of the final checks.

The manually triggered workflow runs Windows and Linux with Node 20 and 22, and PostgreSQL 17 in a disposable service. Its actual result is added after the private push. Tests never use DATABASE_URL from the operator's environment. TEST_DATABASE_URL must point at an explicitly disposable empty database.
