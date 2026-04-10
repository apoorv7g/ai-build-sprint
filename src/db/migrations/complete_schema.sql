
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text UNIQUE NOT NULL,
  description text NOT NULL,
  policy_type text NOT NULL,
  claim_amount integer NOT NULL,
  past_claims integer DEFAULT 0 NOT NULL,
  documents_status text NOT NULL,
  image_url text,
  submitted_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_claim_id ON claims(claim_id);
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at);
CREATE INDEX IF NOT EXISTS idx_claims_policy_type ON claims(policy_type);

CREATE TABLE IF NOT EXISTS claim_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL,
  status text NOT NULL,
  estimated_payout integer NOT NULL,
  confidence_score numeric(4, 2) NOT NULL,
  damage_type text,
  payout_percentage integer,
  reason text,
  customer_message text,
  fraud_flags jsonb,
  coverage_valid boolean,
  processing_time_ms integer,
  groq_key_slot integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_results_claim_id ON claim_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_results_status ON claim_results(status);
CREATE INDEX IF NOT EXISTS idx_claim_results_created_at ON claim_results(created_at);

CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL,
  step_number integer NOT NULL,
  agent_name text NOT NULL,
  status text NOT NULL,
  input_summary text,
  output_summary text,
  tokens_used integer,
  latency_ms integer,
  model_used text,
  groq_key_slot integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_claim_id ON agent_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_step_number ON agent_logs(step_number);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at);

CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text UNIQUE NOT NULL,
  claim_id text NOT NULL,
  title text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_claim_id ON chat_threads(claim_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_created_at ON chat_threads(created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  sender text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

ALTER TABLE claim_results 
ADD CONSTRAINT IF NOT EXISTS fk_claim_results_claim_id 
FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;

ALTER TABLE agent_logs 
ADD CONSTRAINT IF NOT EXISTS fk_agent_logs_claim_id 
FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;

ALTER TABLE chat_threads 
ADD CONSTRAINT IF NOT EXISTS fk_chat_threads_claim_id 
FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
ADD CONSTRAINT IF NOT EXISTS fk_chat_messages_thread_id 
FOREIGN KEY (thread_id) REFERENCES chat_threads(thread_id) ON DELETE CASCADE;
