-- One organization per installation; projects hold versions, pages, members and invitations.

CREATE TABLE organization (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id), -- single row
  name       text NOT NULL,
  branding   jsonb NOT NULL
);

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  email              text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash      text NOT NULL,
  owner              boolean NOT NULL DEFAULT false,
  -- Authenticator (TOTP), encrypted with MFA_ENCRYPTION_KEY. Mandatory: no access without it.
  mfa_secret         text,
  mfa_pending_secret text,
  mfa_last_counter   bigint NOT NULL DEFAULT -1,
  recovery_hashes    text[] NOT NULL DEFAULT '{}',
  last_active_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Opaque session tokens; only their SHA-256 is stored. `stage` is how far the login got:
-- password checked (mfa / enroll) or fully signed in (active).
CREATE TABLE sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage        text NOT NULL CHECK (stage IN ('mfa', 'enroll', 'active')),
  attempts     integer NOT NULL DEFAULT 0,
  user_agent   text,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

CREATE TABLE projects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug               text NOT NULL UNIQUE,
  description        text,
  visibility         text NOT NULL CHECK (visibility IN ('public', 'private')),
  branding           jsonb,
  playground         boolean NOT NULL DEFAULT true,
  base_url           text,
  default_version_id uuid,
  navigation         jsonb NOT NULL DEFAULT '{"order":[],"labels":{},"hidden":[]}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  spec         text NOT NULL DEFAULT '',
  draft        text,
  changelog    text,
  deprecated   boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

ALTER TABLE projects
  ADD CONSTRAINT projects_default_version FOREIGN KEY (default_version_id)
  REFERENCES versions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  slug       text NOT NULL,
  body       text NOT NULL DEFAULT '',
  position   integer NOT NULL,
  UNIQUE (project_id, slug)
);

CREATE TABLE members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX members_user_id ON members (user_id);

CREATE TABLE invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email      text NOT NULL CHECK (email = lower(email)),
  role       text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (project_id, email)
);

CREATE TABLE activity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('spec', 'content', 'access', 'settings')),
  message    text NOT NULL,
  snapshot   jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_project_at ON activity (project_id, at DESC);

-- Fixed-window counters for login and MFA attempts, shared by every API instance.
CREATE TABLE rate_limits (
  key        text PRIMARY KEY,
  count      integer NOT NULL,
  expires_at timestamptz NOT NULL
);
