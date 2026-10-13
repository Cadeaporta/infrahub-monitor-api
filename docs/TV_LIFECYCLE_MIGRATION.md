# TV lifecycle schema migration

This migration is intentionally additive and is **not applied automatically** to Supabase.

## Included
- Approval/revocation state and hostname/device identity fields on `maquinas_tv`.
- JSON configuration and optional navigation-profile reference.
- Navigation profiles with validated interval bounds and JSON site lists.
- Command lifecycle statuses: `enviado`, `recebido`, `executando`, `concluido`, `falhou`.
- Event history independent of the machine row, so history can survive a TV being revoked or removed.
- Indexes for machine status, command queues, and event history.
- RLS enabled on the new profiles/events tables. The server uses the Supabase service role; browser clients must not access these tables directly.

## Compatibility choices
- Existing TVs are marked `aprovada` by default, preserving current tokens and heartbeats.
- The new registration endpoint must explicitly set `status_aprovacao = 'pendente'`.
- Existing command rows are backfilled from the legacy `executado` boolean.
- No data is deleted and no production database is modified by this PR.

## Apply and validate
1. Review the SQL against the current Supabase schema in a non-production project first.
2. Take a database backup/export.
3. Apply `supabase/migrations/202610130001_tv_lifecycle_foundation.sql` manually in Supabase SQL Editor.
4. Verify counts for `maquinas_tv` and `comandos`, and confirm existing TV heartbeat still works.
5. Deploy the matching API lifecycle endpoints only after the migration has been applied.

## Follow-up work still required
- Update the status mirror trigger to copy the added columns.
- Change machine deletion to revocation/soft deletion and retain command/event history for at least 14 days.
- Implement registration approval, per-device authentication, command acknowledgements/timeouts, event ingestion, and retention cleanup.
- Review the existing anonymous read policy on `maquinas_tv_status` carefully. Do not remove it until the public Plantão page has been verified to use a server-side read path, because Plantão must remain accessible without login.
- Implement native Windows hostname discovery. A browser extension alone cannot reliably read the Windows hostname; use an Atera-installed local helper/native-messaging host instead of pretending otherwise.
