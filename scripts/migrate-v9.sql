-- v9: project member roles (KI-38)
-- Only `owner` and `developer` exist. Earlier the API stored any string (the web UI sent
-- `editor` / `viewer`), which the server treated like `developer`; normalise those rows and
-- let the database reject anything else from now on.
UPDATE project_members SET role = 'developer' WHERE role NOT IN ('owner', 'developer');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_role_check') THEN
    ALTER TABLE project_members ADD CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'developer'));
  END IF;
END
$$;
