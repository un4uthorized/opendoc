-- The docs always use the servers from the published spec; the per-project base URL is gone.
ALTER TABLE projects DROP COLUMN base_url;
