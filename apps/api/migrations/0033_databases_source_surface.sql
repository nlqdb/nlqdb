-- SK-GTM-010 — creating surface on the DB row. The canonical NlqSurface
-- (hero | chat | embed | cli | mcp) derived server-side from the
-- authenticated principal (surfaceFromPrincipal) at create / BYO connect,
-- stamped off the response path alongside source_json. Orthogonal to
-- source_json: surface = which client minted the DB, source_json = which
-- marketing channel brought the visitor (web-only). NULL = created before
-- this instrument.
ALTER TABLE databases ADD COLUMN source_surface TEXT;
