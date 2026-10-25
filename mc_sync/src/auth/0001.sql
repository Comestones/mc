CREATE TABLE mc_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, display_name text NOT NULL, is_admin boolean NOT NULL DEFAULT false,
 disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT mc_email_normalized CHECK(email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)
);
CREATE TABLE mc_workspaces (
 id text PRIMARY KEY, name text NOT NULL, created_by uuid NOT NULL REFERENCES mc_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mc_memberships (
 workspace_id text NOT NULL REFERENCES mc_workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES mc_users(id) ON DELETE CASCADE, role text NOT NULL,
 PRIMARY KEY(workspace_id,user_id), CONSTRAINT mc_membership_role CHECK(role IN ('owner','editor'))
);
CREATE TABLE mc_invite_tokens (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES mc_workspaces(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES mc_users(id), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, max_uses integer NOT NULL DEFAULT 1, uses integer NOT NULL DEFAULT 0, revoked_at timestamptz,
 CONSTRAINT mc_invite_uses CHECK(max_uses > 0 AND uses >= 0 AND uses <= max_uses)
);
CREATE TABLE mc_document_meta (
 workspace_id text NOT NULL REFERENCES mc_workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL, id text NOT NULL, created_by uuid NOT NULL REFERENCES mc_users(id),
 deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,kind,id),
 CONSTRAINT mc_document_kind CHECK(kind IN ('page','database'))
);
CREATE TABLE mc_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES mc_users(id) ON DELETE CASCADE,
 refresh_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
