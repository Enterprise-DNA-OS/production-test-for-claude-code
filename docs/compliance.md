# Record controls for production test reviews

Checked 3 November 2026. These checks support the quality lead. They neither certify products nor make release decisions.

| Rule | Implemented check | Basis |
|---|---|---|
| Protect operator and other personal information | Source owner, purpose and access-review date required. Overdue reviews appear in compliance. | [NZ Privacy Principle 5](https://www.privacy.org.nz/privacy-principles/5/). A reminder does not prove safeguards are adequate. |
| Review how long personal information is needed | Source retention-review date required and overdue reviews flagged. No automatic deletion. | [NZ Privacy Principle 9](https://www.privacy.org.nz/privacy-principles/9/). The operator chooses dates based on lawful purpose and applicable obligations. |
| Support review of measurement evidence | Identify reports without a recorded station calibration period covering their UTC test date. | [NIST traceability guidance](https://www.nist.gov/metrology/metrological-traceability). A calibration date alone never proves traceability. Actual measurement uncertainty and the calibration chain remain for the qualified reviewer. |
| Assign responsibility for stations | Flag stations without a named owner. | Local operating policy, not a statutory requirement. |
| Review incomplete outcomes | Flag error, terminated, skipped and done reports. Only recorded P counts as passed. | Local review policy using WATS outcome codes. |
| Keep test order honest | Equal timestamps within a unit and process flag ambiguity and suppress the group yield percentage. | Local evidence policy. Export completeness is not inferred. |
| Preserve original results | Reports, imports, steps, calibration evidence, notes and events reject updates and deletes. | Local audit policy. The database owner can bypass controls. |
| Close follow-up with evidence | Closing an action requires an actor and evidence text and records an event. | Local review policy, not shipment approval. |

The compliance command reports missing or overdue evidence. Zero findings is not legal compliance, calibration accreditation, product conformity or a complete quality system. Review the relevant standards and product obligations with the business. Do not use this free base to carry regulated acceptance responsibility.

An actor name is not authenticated identity. Store the database, original exports, private backups, HTML reports and drafts under appropriate access controls. Imported raw objects may contain operator names. Review all fields before importing, minimise personal data where possible, and include every copy in the retention plan. The application provides no automatic retention purge.
