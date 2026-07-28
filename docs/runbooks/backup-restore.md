# Runbook: Backup and restore

The production database/Storage provider and retention policy are not selected. The commands below
are a tested local equivalent and a template for provider-specific automation; they are not proof of
production point-in-time recovery.

## Before a deployment

1. Confirm the target and release/change ticket.
2. Quiesce or account for writes.
3. Capture provider-native database backup/PITR checkpoint and Storage version/snapshot.
4. Capture schema and logical data exports to encrypted, access-controlled storage.
5. Record checksums, encryption/key owner, retention, region, and expiry.
6. Restore into an isolated target and validate schema, row counts, Auth, RLS, and critical journeys.

Local logical export:

```bash
supabase db dump --local --schema public,auth,storage --file schema.sql
supabase db dump --local --data-only --schema public,auth,storage --use-copy --file data.sql
shasum -a 256 schema.sql data.sql
```

The data-only command warns about circular foreign keys (`profiles`, offer
thread/proposal, Admin notes). Restore schema first and use the database owner with
`ON_ERROR_STOP`; do not treat an export file existing as a successful recovery.

## Restore drill

1. Create a new isolated database—never overwrite the live target for a test.
2. Restore `schema.sql` then `data.sql` as the Supabase/database owner:

```bash
psql -v ON_ERROR_STOP=1 "$ISOLATED_DIRECT_DATABASE_URL" < schema.sql
psql -v ON_ERROR_STOP=1 "$ISOLATED_DIRECT_DATABASE_URL" < data.sql
```

3. Validate migration/schema version, public/Auth/Storage table counts, constraints, RLS, function
   grants, audit history, Auth login, private document denial, public listing reads, and signed URLs.
4. Run smoke tests, record timings/outcome, then destroy only the verified isolated target.

## Week 8 evidence

The disposable local stack produced a 271,958-byte schema export and an 18,541-byte data export.
After correcting the restore operator to the Supabase owner, both restored with
`ON_ERROR_STOP=1` into the isolated database `markaz_week8_restore_check_20260728`; 24 public tables
were verified and the isolated database was removed. The live application database was not targeted.

## Limitations

- No production provider, PITR/retention policy, encryption policy, RPO/RTO, or restore owner exists.
- Logical database exports do not back up Storage object bytes. The selected provider must supply
  versioning/snapshots and a manifest that reconciles `storage.objects` metadata to object content.
- Audit history must be preserved. Never “recover” by deleting inconvenient audit rows.
