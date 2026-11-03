# Production Test for Claude Code

Keep unit test history, retests and corrective follow-up in your own database. A focused alternative for the production review work done with exported WATS results.

Built by Enterprise DNA. MIT licence. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free. Install the database and commands below. | Your products, process rules, export mapping and reports. | Installed, connected and operated through Omni by Enterprise DNA. Setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=wats) | [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=wats) |

## Quick start

Node 20 or newer. The demo needs no vendor account, equipment connection or hosted database.

```bash
git clone https://github.com/Enterprise-DNA-OS/production-test-for-claude-code.git
cd production-test-for-claude-code
npm install
npm run demo
npm run production -- failures
npm run view
npm run docs
```

The fictional dataset contains seven test attempts. One control unit fails and then passes, one passes at first observation, one errors, another fails its functional test but passes a different process. A sensor fails at a station lacking recorded calibration evidence. The first-observed pass rate for control units in functional test is 25 percent. Different processes never turn a failed functional test into a pass.

PGlite stores local data under .data/db. Set DATABASE_URL to use PostgreSQL and run npm run migrate. The CLI uses a trusted operator connection. A shared hosted deployment needs identity enforcement, least privilege, backups and a retention process.

## The working week

1. `/yield-review` compares first-observed pass rates by source, product, revision and process.
2. `/retest-review` keeps the original failure visible after a passing retest.
3. `/failure-pareto` identifies recurring failed leaf steps and affected reports.
4. `/attention` finds overdue follow-up, nonpassing units and missing record controls.
5. `/weekly-review` combines actual results, owners and compliance findings into a private draft.

32 slash commands live in .claude/commands. The single CLI has 28 verbs including help. Run `npm run production -- help`. Reads produce human-readable columns by default and --json for processing. Names match without case, ID prefixes work, and ambiguous matches list candidates and exit 1. Use IDs where multiple sources have the same station or report name.

## Bring WATS records across

Export UUT reports as WSJF, extract them into a folder, register the source and run one import command. It checks every record, reconciles the independent count and writes atomically. Repeat imports skip identical evidence and refuse changed reports with the same source ID. The dry run writes nothing. Read [the switching guide](docs/replace-wats.md).

```bash
npm run production -- import wats --source="Your source" --file=imports/export-folder --expected-count=100 --source-ref="Actual export job and filters" --actor="Actual operator" --dry-run
```

Use your actual count and identity. The committed example is fictional. It follows WATS's documented JSON format. CSV and repair reports require a separate mapping or custom implementation. The original raw object is retained, including unmapped fields. Review personal information before import.

## Evidence that survives a retest

The unit identity includes source, part, revision, serial and process. Only P counts as passed. Tied timestamps flag uncertain order and suppress the group's yield percentage. All yield covers observed history only, because an export can omit earlier attempts. Measurement values and verdicts come from the vendor report and are not recomputed here. Failure counts use leaf steps and failing measurement outcomes, avoiding duplicate parent-group counts.

Reports, steps, imports, calibrations, notes and events are append-only. Corrections require new evidence. Follow-up closures need an actor and evidence reference, but do not change original results or authorise shipment. Typed names are attribution, not authentication. The database owner can bypass application controls.

## Ten questions to ask

These are shipped queries, not claims that WATS cannot answer the same questions.

1. Which product has the lowest first-observed pass rate? `yield`
2. Which units passed only after a failed attempt? `retests`
3. Which test steps account for the most failed observations? `failures`
4. Which units still have a nonpassing latest result? `attention`
5. What happened to this serial number across different test processes? `trace --serial=SN-104`
6. Which station records lack calibration evidence for a test date? `compliance`
7. Which corrective actions are overdue, and who owns them? `actions`
8. How did daily test-attempt counts vary by product? `trends`
9. Which imported files and source counts support this review? `imports`
10. Who recorded each follow-up and closure? `history`

## Your first hour: ten things to ask for

1. Put our business name, colours and logo in brand.json.
2. Register our source system and actual owner.
3. Agree access and retention review dates.
4. Check the fields in our actual WATS export.
5. Reconcile the source count before importing.
6. Assign each test station an owner.
7. Add calibration period references for the test dates.
8. Review a failed unit through all its retests.
9. Assign a corrective action and record its evidence.
10. Create our weekly report and private review packet.

`/customise` changes a field or rule through a new tested migration. `/new-view` adds a read-only report. No front end is required for the review desk.

## Reports, controls and backups

`npm run docs` renders branded test histories and corrective action records into docs-out/. `npm run view` renders views/week.html. Both use brand.json and escape record values. They are internal reports, not certificates. [Why no front end](docs/why-no-front-end.md).

`/compliance` checks source review dates, station ownership, calibration evidence coverage and uncertain outcomes. The [rules and sources](docs/compliance.md) distinguish legal principles from local operating policy. Calibration dates alone do not establish traceability.

`npm run production -- export --file=exports/backup-YYYY-MM-DD.json` writes all nine domain record types to a new private JSON file and refuses overwrites. Keep native database backups and the original exports too. An automated JSON restore command is not included.

This base reviews saved test evidence. WATS also collects live data and supports repair workflows, alarms and other production functions. Enterprise DNA scopes the connections and screens needed for a custom version. Keep existing production controls until those requirements are met.

## Validation

`npm test` exercises every CLI verb, repeated seed and migration, first-observed denominators, process separation, retest history, source isolation, tied timestamps, import rejection and idempotency, original-evidence protection, closure evidence, backups and escaped HTML. The manual validation workflow covers Windows and Linux on Node 20 and 22, plus PostgreSQL 17. Actual execution results are recorded in [validation](docs/validation.md).

[Selection and research](docs/research.md). MIT. Built and optionally operated through [Omni by Enterprise DNA](https://enterprisedna.co/omni/instead-of/wats?utm_source=github&utm_medium=readme&utm_campaign=wats).
