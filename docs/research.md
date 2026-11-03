# Target selection and evidence

Checked 3 November 2026. Family: electronics-test-records. Existing manufacturing-quality, calibration, software-testing and statistical-process-analysis builds were checked. This build is specifically the exported electronics unit test history and production yield review desk, not a duplicate of those broader tools.

WATS annual list-price scenario: EUR 21,816, calculated as twelve times the Enterprise EUR 578 monthly base plus twelve times its EUR 1,240 monthly 1,000 MB upgrade, both annually prepaid. This is a scenario based on the vendor's list, not an actual NZ or AU customer invoice or a statement about a typical factory. No customer paying WATS was verified in the available customer files or CRM snapshot. No live customer system was read. No measured search volume was available.

| Candidate | Annual bill | Data-shaped | Buyers | Search | Buildable | Import | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| WATS production test review | 3 | 5 | 1 | 2 | 4 | 5 | 20 |
| Tonic Structural test data management | 1 | 3 | 1 | 3 | 2 | 3 | 13 |
| PagerDuty on-call response | 3 | 3 | 2 | 4 | 1 | 4 | 17 |

These are editorial assessments, not measured demand. Tonic's current professional pricing is quoted privately, so its annual bill could not be established from the vendor. PagerDuty's live alert response needs integrations and delivery infrastructure to be useful, making it unsuitable for this export-first build. WATS has a supported structured export, substantial published volume charges and a useful offline review workflow.

## Primary sources

- [WATS pricing](https://www.wats.com/pricing): Enterprise base and data-volume upgrade charges, annual billing, user limits and deployment options. Exact excerpts stored in the target's prices list.
- [WATS export wizard](https://support.wats.com/hc/en-us/articles/207424743-Export-Reports-from-the-WATS-Server): UUT and repair exports, supported formats, filters and download flow.
- [WSJF](https://support.wats.com/hc/en-us/articles/360015705199-WATS-Standard-JSON-Format-WSJF): structured export format and vendor examples. The fictional fixture follows the published field structure, not customer records.
- [WATS technology](https://www.wats.com/technology): collection and integration scope beyond the review base.
- [Tonic pricing](https://www.tonic.ai/pricing): custom Professional and Enterprise pricing checked this run.
- [PagerDuty pricing](https://www.pagerduty.com/pricing/): candidate review only, not a public comparison claim.

The questions in the README demonstrate shipped queries. WATS also provides analysis and configurable reporting. No claim is made that its platform cannot answer them. The value is an owned workflow combining exported results, local evidence and follow-up.
