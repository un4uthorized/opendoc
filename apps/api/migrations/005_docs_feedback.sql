-- "Esta página ajudou?" from the published docs: a yes/no per page, with an optional comment.
-- Like docs_events, the visitor is a daily salted hash, never an IP or a browser string.
CREATE TABLE docs_feedback (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page       text NOT NULL,
  label      text,
  helpful    boolean NOT NULL,
  comment    text CHECK (length(comment) <= 2000),
  visitor    text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX docs_feedback_project_at ON docs_feedback (project_id, at DESC);
