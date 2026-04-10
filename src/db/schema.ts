import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  claim_id: text("claim_id").unique().notNull(),
  description: text("description").notNull(),
  policy_type: text("policy_type").notNull(),
  claim_amount: integer("claim_amount").notNull(),
  past_claims: integer("past_claims").default(0).notNull(),
  documents_status: text("documents_status").notNull(),
  image_url: text("image_url"),
  submitted_at: timestamp("submitted_at").defaultNow(),
});

export const claim_results = pgTable("claim_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  claim_id: text("claim_id").notNull(),
  status: text("status").notNull(),
  estimated_payout: integer("estimated_payout").notNull(),
  confidence_score: numeric("confidence_score", { precision: 4, scale: 2 }).notNull(),
  damage_type: text("damage_type"),
  payout_percentage: integer("payout_percentage"),
  reason: text("reason"),
  customer_message: text("customer_message"),
  fraud_flags: jsonb("fraud_flags"),
  coverage_valid: boolean("coverage_valid"),
  processing_time_ms: integer("processing_time_ms"),
  groq_key_slot: integer("groq_key_slot"),
  created_at: timestamp("created_at").defaultNow(),
});

export const agent_logs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  claim_id: text("claim_id").notNull(),
  step_number: integer("step_number").notNull(),
  agent_name: text("agent_name").notNull(),
  status: text("status").notNull(),
  input_summary: text("input_summary"),
  output_summary: text("output_summary"),
  tokens_used: integer("tokens_used"),
  latency_ms: integer("latency_ms"),
  model_used: text("model_used"),
  groq_key_slot: integer("groq_key_slot"),
  created_at: timestamp("created_at").defaultNow(),
});
