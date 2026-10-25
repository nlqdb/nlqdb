-- Synthetic attach target for the GLOBAL-043 item-1a slices: a small app
-- schema an agent might ship — PKs and FKs, no secondary indexes. Each run
-- drops and recreates `dba_synth`, so the seed is idempotent.
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
-- Composite FK, covered only by a wrong-order index: still unindexed for the FK.
CREATE TABLE tenants_regions (tenant_id bigint, region text, PRIMARY KEY (tenant_id, region));
CREATE TABLE deployments (
  id bigint PRIMARY KEY,
  tenant_id bigint NOT NULL,
  region text NOT NULL,
  FOREIGN KEY (tenant_id, region) REFERENCES tenants_regions (tenant_id, region)
);
CREATE INDEX deployments_region_only_idx ON deployments (region);

INSERT INTO users SELECT g, 'u' || g || '@example.com' FROM generate_series(1, 2000) g;
INSERT INTO posts SELECT g, 1 + g % 2000, 'post ' || g FROM generate_series(1, 20000) g;
INSERT INTO comments SELECT g, 1 + g % 20000, 1 + g % 2000, 'c' FROM generate_series(1, 50000) g;
INSERT INTO tenants_regions SELECT g, 'r' || (g % 4) FROM generate_series(1, 100) g;
INSERT INTO deployments SELECT g, 1 + g % 100, 'r' || ((1 + g % 100) % 4) FROM generate_series(1, 1000) g;
ANALYZE;
