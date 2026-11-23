-- What readers do in the published docs, for the admin's Analytics: page views and searches.
-- No IP or user agent is stored: `visitor` is a salted hash that changes every day, enough to count
-- unique visitors without being able to follow anyone.
CREATE TABLE docs_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('view', 'search')),
  -- view: the docs page (#hash id) with its label, and method + path when it is an endpoint.
  page       text,
  label      text,
  method     text,
  path       text,
  -- search: what was typed and how many results it had.
  query      text,
  results    integer,
  visitor    text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX docs_events_project_at ON docs_events (project_id, at DESC);
