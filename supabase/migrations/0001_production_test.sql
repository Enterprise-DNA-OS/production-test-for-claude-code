CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION preserve_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only; record a new event'; END $$;
CREATE TABLE sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK(length(trim(name))>0),
 owner text NOT NULL CHECK(length(trim(owner))>0), purpose text NOT NULL CHECK(length(trim(purpose))>0),
 access_review_due date NOT NULL, retention_review_due date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES sources,
 name text NOT NULL CHECK(length(trim(name))>0), owner text NOT NULL DEFAULT 'Unassigned',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,name)
);
CREATE TABLE calibrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 valid_from date NOT NULL, valid_to date NOT NULL CHECK(valid_to>=valid_from), evidence text NOT NULL CHECK(length(trim(evidence))>0),
 actor text NOT NULL CHECK(length(trim(actor))>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES sources,
 fingerprint text NOT NULL, source_ref text NOT NULL, expected_count integer NOT NULL CHECK(expected_count>0),
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,fingerprint)
);
CREATE TABLE reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES sources,
 import_id uuid NOT NULL REFERENCES imports, source_report_id text NOT NULL, station_id uuid NOT NULL REFERENCES stations,
 part_number text NOT NULL, revision text NOT NULL, serial_number text NOT NULL, process_code text NOT NULL, process_name text NOT NULL,
 started_at timestamptz NOT NULL, result text NOT NULL CHECK(result IN ('P','F','E','T','S','D')),
 duration_seconds numeric CHECK(duration_seconds>=0), batch_serial text, raw jsonb NOT NULL, record_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,source_report_id)
);
CREATE TABLE steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports,
 path text NOT NULL, name text NOT NULL, status text NOT NULL CHECK(status IN ('P','F','E','T','S','D')),
 measurements jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(report_id,path)
);
CREATE TABLE actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports,
 title text NOT NULL CHECK(length(trim(title))>0), owner text NOT NULL CHECK(length(trim(owner))>0), due date NOT NULL,
 created_by text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 closure_evidence text, closed_by text, closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((state='open' AND closed_at IS NULL) OR (state='closed' AND length(trim(closure_evidence))>0 AND length(trim(closed_by))>0 AND closed_at IS NOT NULL))
);
CREATE TABLE notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports, actor text NOT NULL, body text NOT NULL CHECK(length(trim(body))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL, kind text NOT NULL, actor text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sources','stations','calibrations','imports','reports','steps','actions','notes','events'] LOOP
 EXECUTE format('CREATE TRIGGER touch_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM public',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['calibrations','imports','reports','steps','notes','events'] LOOP
 EXECUTE format('CREATE TRIGGER preserve_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION preserve_evidence()',t);
 END LOOP;
END $$;
CREATE INDEX report_unit_time ON reports(source_id,part_number,revision,serial_number,process_code,started_at);
CREATE INDEX step_report ON steps(report_id);
CREATE INDEX action_report ON actions(report_id);
CREATE VIEW v_ranked AS
 SELECT r.*, row_number() OVER(PARTITION BY source_id,part_number,revision,serial_number,process_code ORDER BY started_at,source_report_id) AS attempt,
 row_number() OVER(PARTITION BY source_id,part_number,revision,serial_number,process_code ORDER BY started_at DESC,source_report_id DESC) AS last_attempt,
 count(*) OVER(PARTITION BY source_id,part_number,revision,serial_number,process_code,started_at) AS tied_time
 FROM reports r;
CREATE VIEW v_units AS
 SELECT s.name AS source, r.source_id,part_number,revision,serial_number,process_code,
 count(*)::integer AS attempts, min(started_at) AS first_observed, max(started_at) AS latest_observed,
 max(result) FILTER(WHERE attempt=1) AS first_result, max(result) FILTER(WHERE last_attempt=1) AS latest_result,
 bool_or(tied_time>1) AS ambiguous_order,
 count(*) FILTER(WHERE result='P')::integer AS passed_attempts
 FROM v_ranked r JOIN sources s ON s.id=r.source_id GROUP BY s.name,r.source_id,part_number,revision,serial_number,process_code;
CREATE VIEW v_yield AS
 SELECT source,part_number,revision,process_code,count(*)::integer AS observed_units,
 count(*) FILTER(WHERE first_result='P' AND NOT ambiguous_order)::integer AS first_pass_units,
 count(*) FILTER(WHERE ambiguous_order)::integer AS ambiguous_units,
 CASE WHEN bool_or(ambiguous_order) THEN NULL ELSE round(100.0*count(*) FILTER(WHERE first_result='P')/count(*),2) END AS first_observed_pass_pct,
 count(*) FILTER(WHERE attempts>1)::integer AS retested_units,
 count(*) FILTER(WHERE latest_result='P' AND NOT ambiguous_order)::integer AS latest_pass_units
 FROM v_units GROUP BY source,part_number,revision,process_code;
CREATE VIEW v_failures AS
 SELECT so.name AS source,r.part_number,r.revision,r.process_code,st.name AS station,s.path,s.name AS step,
 count(*)::integer AS failed_step_occurrences,count(DISTINCT r.id)::integer AS affected_reports
 FROM steps s JOIN reports r ON r.id=s.report_id JOIN stations st ON st.id=r.station_id JOIN sources so ON so.id=r.source_id
 WHERE s.status IN ('F','E','T') OR EXISTS(SELECT 1 FROM jsonb_array_elements(s.measurements) m WHERE m->>'status' IN ('F','E','T'))
 GROUP BY so.name,r.part_number,r.revision,r.process_code,st.name,s.path,s.name;
CREATE VIEW v_actions AS
 SELECT a.id,a.title,a.owner,a.due,a.state,(a.state='open' AND a.due<CURRENT_DATE) AS overdue,
 r.source_report_id,r.part_number,r.serial_number,a.closure_evidence,a.closed_by FROM actions a JOIN reports r ON r.id=a.report_id;
CREATE VIEW v_compliance AS
 SELECT 'access-review' AS rule,s.name AS record,'Access review overdue' AS issue FROM sources s WHERE access_review_due<CURRENT_DATE
 UNION ALL SELECT 'retention-review',s.name,'Retention review overdue' FROM sources s WHERE retention_review_due<CURRENT_DATE
 UNION ALL SELECT 'station-owner',s.name,'Station owner unassigned' FROM stations s WHERE owner='Unassigned'
 UNION ALL SELECT 'calibration-evidence',r.source_report_id,'No recorded calibration period covers the test date' FROM reports r
 WHERE NOT EXISTS(SELECT 1 FROM calibrations c WHERE c.station_id=r.station_id AND (r.started_at AT TIME ZONE 'UTC')::date BETWEEN c.valid_from AND c.valid_to)
 UNION ALL SELECT 'result-review',source_report_id,'Nonfinal result needs review' FROM reports WHERE result IN ('E','T','S','D')
 UNION ALL SELECT 'time-order',serial_number,'Equal test times make first-pass order uncertain' FROM v_units WHERE ambiguous_order;
CREATE VIEW v_attention AS
 SELECT 'action' AS kind,id::text AS reference,title AS issue FROM v_actions WHERE overdue
 UNION ALL SELECT rule,record,issue FROM v_compliance
 UNION ALL SELECT 'latest-not-pass',serial_number,'Latest recorded outcome is '||latest_result FROM v_units WHERE latest_result<>'P';
REVOKE ALL ON v_ranked,v_units,v_yield,v_failures,v_actions,v_compliance,v_attention FROM public;
