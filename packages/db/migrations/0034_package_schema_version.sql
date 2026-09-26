-- Increment 1.43: a month close records the package schema it was computed under.
--
-- Closing a month freezes the package hash, and the CPA page compares that
-- frozen hash against the package as it computes today. The comparison is only
-- meaningful while both sides are the same shape. `hashedView` folds the whole
-- weekly digest into the hash, so adding one field to the digest changes the
-- hash of every month already closed, and each one begins reporting a change it
-- never had — permanently, which also means nobody reads the flag again.
--
-- The schema version makes the two cases distinguishable. A close now records
-- the version it was computed under; where that differs from the version
-- running, the page says the hashes are not comparable rather than claiming a
-- figure moved, and falls back to the figures the close froze in their own
-- columns — the entry count and the journal total — which no schema change
-- touches.
--
-- Rows closed before this migration were computed under the first shape, so
-- they backfill to 'package-v1'. The default is then dropped: a close states
-- the schema it used, rather than inheriting one.

ALTER TABLE month_closes ADD COLUMN package_schema text NOT NULL DEFAULT 'package-v1';
ALTER TABLE month_closes ALTER COLUMN package_schema DROP DEFAULT;
