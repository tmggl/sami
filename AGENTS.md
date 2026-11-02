# Sami training production

This is the independent samialzamzami.com training/registration project, not
Thahen, SamiLink or Munfith. Keep its containers, PostgreSQL cluster, volumes,
credentials and networks separate. Never reuse another project's database or
restart another service during a Sami release.

Use Node 22 and the committed package lock. Run `npm run check`, `npm test`,
dependency auditing and exact-image functional checks before a release. Never
test SMS delivery on real trainees. Preserve Firebase login and the existing
primary/junior administrator boundaries and family registration idempotency.

Follow the workspace's zero-interruption deployment rules. During migration,
the private server-only controls hold incoming API requests, drain existing
requests and notification work, then swap the database pool without restarting
the process. Read `/tmp/sami-migration-status.json` inside the Sami container;
do not signal, stop, replace or remove it while customer work is active. Do not
expose the control directory, runtime database configuration or Docker access
over HTTP. The controls are disabled in ordinary deployments without the
`MIGRATION_CONTROL_DIR` setting. Do not bypass the automatic pause watchdog.

Copy every table, sequence, notification result and audit entry. Verify row
counts and content fingerprints, not just HTTP health. An already-sent SMS job
must remain sent. Preserve the encrypted recoverable source backup before any
source deletion. Do not delete Render resources until the official domain,
local PostgreSQL, login, registrations and notification continuity are verified.
DNS TTLs and known legacy Firebase callback URLs must be accounted for.
