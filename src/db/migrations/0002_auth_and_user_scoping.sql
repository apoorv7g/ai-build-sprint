CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO users (username, password_hash)
SELECT 'legacy_admin', 'legacy:temporary'
WHERE NOT EXISTS (SELECT 1 FROM users);

ALTER TABLE claims ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE claims
SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;
ALTER TABLE claims ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE claims
  ADD CONSTRAINT claims_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE claim_results ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE claim_results
SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;
ALTER TABLE claim_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE claim_results
  ADD CONSTRAINT claim_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE agent_logs
SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;
ALTER TABLE agent_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE agent_logs
  ADD CONSTRAINT agent_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE chat_threads
SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;
ALTER TABLE chat_threads ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE chat_threads
  ADD CONSTRAINT chat_threads_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS claims_claim_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS claims_user_claim_id_idx ON claims(user_id, claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_results_user_claim ON claim_results(user_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_claim ON agent_logs(user_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);
