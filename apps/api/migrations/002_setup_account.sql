-- The setup account (ADMIN_EMAIL / ADMIN_PASSWORD): signs in with the password alone and can only
-- manage the installation's admins. It is never an owner and never a project member.
ALTER TABLE users ADD COLUMN setup boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD CONSTRAINT users_setup_not_owner CHECK (NOT (setup AND owner));
CREATE UNIQUE INDEX users_single_setup ON users (setup) WHERE setup;

-- Installation-admin invitations have no project: accepting one creates an owner.
ALTER TABLE invitations ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
  CHECK ((project_id IS NULL AND role = 'owner') OR (project_id IS NOT NULL AND role IN ('admin', 'editor', 'viewer')));
CREATE UNIQUE INDEX invitations_admin_email_key ON invitations (email) WHERE project_id IS NULL;
