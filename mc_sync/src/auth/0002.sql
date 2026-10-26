CREATE TABLE mc_setup_state (
 id integer PRIMARY KEY CHECK (id = 1), completed_at timestamptz NOT NULL DEFAULT now()
);
-- Existing installations with an administrator are already initialized.
INSERT INTO mc_setup_state (id) SELECT 1 WHERE EXISTS (SELECT 1 FROM mc_users WHERE is_admin) ON CONFLICT DO NOTHING;
