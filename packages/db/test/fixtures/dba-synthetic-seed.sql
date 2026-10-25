-- Synthetic attach target for the GLOBAL-043 item-1a slices: a small app
-- schema an agent might ship — PKs, FKs and a few non-covering indexes. Each run
-- drops and recreates `dba_synth`, so the seed is idempotent.
-- Tier 1 reads the workload from pg_stat_statements (preloaded by CI).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
DROP SCHEMA IF EXISTS dba_synth CASCADE;
CREATE SCHEMA dba_synth;
SET search_path = dba_synth;

CREATE TABLE users (id bigint PRIMARY KEY, email text NOT NULL);
CREATE TABLE posts (
  id bigint PRIMARY KEY,
  author_id bigint NOT NULL REFERENCES users (id),
  title text NOT NULL
);
CREATE TABLE comments (
  id bigint PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts (id),
  user_id bigint NOT NULL REFERENCES users (id),
  body text NOT NULL
);
-- Already indexed: comments.user_id must not be proposed.
CREATE INDEX comments_user_id_idx ON comments (user_id);
-- The app's own partial index under the conventional name: it doesn't cover
-- the FK, and the proposal's name must not collide with it.
CREATE INDEX posts_author_id_idx ON posts (author_id) WHERE author_id > 1000;
-- Composite FK with only a (region) index, which doesn't lead with tenant_id.
CREATE TABLE tenants_regions (tenant_id bigint, region text, PRIMARY KEY (tenant_id, region));
CREATE TABLE deployments (
  id bigint PRIMARY KEY,
  tenant_id bigint NOT NULL,
  region text NOT NULL,
  FOREIGN KEY (tenant_id, region) REFERENCES tenants_regions (tenant_id, region)
);
CREATE INDEX deployments_region_only_idx ON deployments (region);
-- Neither covers its FK: an INCLUDE column isn't a key column, and BRIN can't
-- serve the equality lookup.
CREATE TABLE memberships (
  user_id bigint NOT NULL,
  tenant_id bigint NOT NULL,
  region text NOT NULL,
  FOREIGN KEY (tenant_id, region) REFERENCES tenants_regions (tenant_id, region),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX memberships_tenant_incl_region_idx ON memberships (tenant_id) INCLUDE (region);
CREATE INDEX memberships_user_brin_idx ON memberships USING brin (user_id);
-- Partitioned: Postgres can't build an index on the parent `CONCURRENTLY`, so
-- its FK is not a Tier 0 proposal yet; nor is the partition's cloned FK.
CREATE TABLE events (
  user_id bigint NOT NULL REFERENCES users (id),
  at date NOT NULL
) PARTITION BY RANGE (at);
CREATE TABLE events_2026 PARTITION OF events FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

INSERT INTO users SELECT g, 'u' || g || '@example.com' FROM generate_series(1, 2000) g;
INSERT INTO posts SELECT g, 1 + g % 2000, 'post ' || g FROM generate_series(1, 20000) g;
INSERT INTO comments SELECT g, 1 + g % 20000, 1 + g % 2000, 'c' FROM generate_series(1, 50000) g;
INSERT INTO tenants_regions SELECT g, 'r' || (g % 4) FROM generate_series(1, 100) g;
INSERT INTO memberships SELECT 1 + g % 2000, 1 + g % 100, 'r' || ((1 + g % 100) % 4) FROM generate_series(1, 100) g;
INSERT INTO deployments SELECT g, 1 + g % 100, 'r' || ((1 + g % 100) % 4) FROM generate_series(1, 1000) g;
ANALYZE;
