
-- ========================================
-- COMPLETE DATABASE SCHEMA
-- Generated from src/db/schema.ts
-- ========================================

-- ========================================
-- Extensions
-- ========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- Users Table
-- ========================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ========================================
-- Sessions Table
-- ========================================
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at);

-- ========================================
-- Claims Table
-- ========================================
CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id text NOT NULL,
  description text NOT NULL,
  policy_type text NOT NULL,
  claim_amount integer NOT NULL,
  past_claims integer DEFAULT 0 NOT NULL,
  documents_status text NOT NULL,
  image_url text,
  submitted_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX claims_user_claim_id_idx ON claims(user_id, claim_id);
CREATE INDEX idx_claims_claim_id ON claims(claim_id);
CREATE INDEX idx_claims_submitted_at ON claims(submitted_at);
CREATE INDEX idx_claims_policy_type ON claims(policy_type);

-- ========================================
-- Claim Results Table
-- ========================================
CREATE TABLE claim_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_claim_results_user_claim ON claim_results(user_id, claim_id);
CREATE INDEX idx_claim_results_claim_id ON claim_results(claim_id);
CREATE INDEX idx_claim_results_status ON claim_results(status);
CREATE INDEX idx_claim_results_created_at ON claim_results(created_at);

-- ========================================
-- Agent Logs Table
-- ========================================
CREATE TABLE agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_agent_logs_user_claim ON agent_logs(user_id, claim_id);
CREATE INDEX idx_agent_logs_claim_id ON agent_logs(claim_id);
CREATE INDEX idx_agent_logs_agent_name ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_step_number ON agent_logs(step_number);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at);

-- ========================================
-- Chat Threads Table
-- ========================================
CREATE TABLE chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id text UNIQUE NOT NULL,
  claim_id text,
  title text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_chat_threads_user_id ON chat_threads(user_id);
CREATE INDEX idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX idx_chat_threads_claim_id ON chat_threads(claim_id);
CREATE INDEX idx_chat_threads_created_at ON chat_threads(created_at);

-- ========================================
-- Chat Messages Table
-- ========================================
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
  sender text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
