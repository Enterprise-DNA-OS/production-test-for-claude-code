# Bring WATS test history into your own database

Checked 3 November 2026. This moves exported UUT test records into a production review system. It does not migrate the entire WATS platform.

## Export from WATS

Use the authorised account's Export wizard. Select UUT reports and WSJF format, set the intended filters and step selection, then download the completed job from My exports. Record the independent report count and filter scope. Keep the original archive. Extract the JSON files into a private imports/ folder before import.

Sources: [WATS export instructions](https://support.wats.com/hc/en-us/articles/207424743-Export-Reports-from-the-WATS-Server), [WSJF format and examples](https://support.wats.com/hc/en-us/articles/360015705199-WATS-Standard-JSON-Format-WSJF). WATS also exports CSV, but this importer deliberately uses its documented structured format to preserve step evidence. CSV layouts require mapping as part of a custom migration. No CSV support is claimed by this base.

## Prepare and import

```bash
npm run production -- add-source --name="Factory WATS" --owner="Actual quality lead" --purpose="Production test review" --access-review=2027-01-01 --retention-review=2027-02-01 --actor="Actual operator"
npm run production -- import wats --source="Factory WATS" --file=imports/wats-export --expected-count=100 --source-ref="Your actual filters and export job" --actor="Actual operator" --dry-run
```

Replace the count, dates, source and people with the actual values. After checking the dry run, repeat the import command without --dry-run. A prepared WSJF export is a one-command import. Inspect sources, imports, reports, yield, retests and compliance afterwards. Register the same physical system under one stable source name across later exports.

The path accepts one report, a JSON array of reports, or a directory of JSON files. Directory reading is flat: put all report files in that folder. Archives and nested folders must be extracted and checked first. Every report needs its own stable id, pn, sn, rev, processCode, processName, machineName, start, result and root. The start field needs a timezone. Empty revisions and missing source identifiers are rejected instead of guessed. Vendor versions and filters vary, so inspect your real export before planning the move.

| WATS field | Owned record |
|---|---|
| id | Source report ID, unique within its source system |
| pn, rev, sn | Part, revision and unit serial |
| processCode, processName | Test process identity and label |
| machineName | Station, scoped to the source |
| start | Time with timezone, normalised to UTC |
| result | Recorded P, F, E, T, S or D outcome |
| uut.execTime, uut.batchSN | Recorded duration and batch serial |
| root.steps | Leaf step outcomes and measurements, with positional paths |
| Whole original object | Preserved source evidence |

The importer validates the whole batch before adding records and commits atomically. It reconciles the independent count, rejects duplicate IDs in a file and refuses changed content for an existing source report. Identical reports already loaded are skipped. Reordered JSON properties count as changed content, so retain the original export for repeat runs. Each import keeps its source reference, actor and fingerprint. Different source systems may use the same report ID safely.

## Scope and checks

UUR repair reports are rejected. WATS attachments, charts, workflows, alarms, station software distribution, identities, repair screens and live collection do not become working features here. Other fields remain in the raw record. Numeric and string measurements retain the vendor's recorded verdict. This base does not recompute comparator logic or statistical capability indices. Failure counts use failing leaf steps or failing measurements, not every failed parent group.

Compare serial histories, process boundaries, source counts and results against WATS before relying on the new record. A filtered export can omit the original first attempt, so yield is always labelled first observed. Equal timestamps suppress a confident yield percentage. Recorded station calibration periods are reminders for an evidence review, not a certificate or proof of measurement traceability.

Enterprise DNA maps the actual records and required connections for the custom version. Keep the incumbent until the agreed workflows and evidence checks are complete. No full-platform switch-in-a-day promise is made.
