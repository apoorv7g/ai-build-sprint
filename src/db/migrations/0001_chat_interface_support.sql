CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text UNIQUE NOT NULL,
  claim_id text REFERENCES claims(claim_id),
  title text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
  sender text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id
  ON chat_messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_threads_claim_id
  ON chat_threads(claim_id);
