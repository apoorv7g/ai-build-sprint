import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token_hash: text("token_hash").notNull().unique(),
    expires_at: timestamp("expires_at").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_sessions_user_expires").on(table.user_id, table.expires_at)]
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    claim_id: text("claim_id").notNull(),
    description: text("description").notNull(),
    policy_type: text("policy_type").notNull(),
    claim_amount: integer("claim_amount").notNull(),
    past_claims: integer("past_claims").default(0).notNull(),
    documents_status: text("documents_status").notNull(),
    image_url: text("image_url"),
    submitted_at: timestamp("submitted_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("claims_user_claim_id_idx").on(table.user_id, table.claim_id),
    index("idx_claims_claim_id").on(table.claim_id),
    index("idx_claims_submitted_at").on(table.submitted_at),
    index("idx_claims_policy_type").on(table.policy_type),
  ]
);

export const claim_results = pgTable(
  "claim_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    index("idx_claim_results_user_claim").on(table.user_id, table.claim_id),
    index("idx_claim_results_claim_id").on(table.claim_id),
    index("idx_claim_results_status").on(table.status),
    index("idx_claim_results_created_at").on(table.created_at),
  ]
);

export const agent_logs = pgTable(
  "agent_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    index("idx_agent_logs_user_claim").on(table.user_id, table.claim_id),
    index("idx_agent_logs_claim_id").on(table.claim_id),
    index("idx_agent_logs_agent_name").on(table.agent_name),
    index("idx_agent_logs_step_number").on(table.step_number),
    index("idx_agent_logs_created_at").on(table.created_at),
  ]
);

export const chat_threads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    thread_id: text("thread_id").notNull().unique(),
    claim_id: text("claim_id"),
    title: text("title").notNull(),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_chat_threads_user_id").on(table.user_id),
    index("idx_chat_threads_thread_id").on(table.thread_id),
    index("idx_chat_threads_claim_id").on(table.claim_id),
    index("idx_chat_threads_created_at").on(table.created_at),
  ]
);

export const chat_messages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thread_id: text("thread_id").notNull().references(() => chat_threads.thread_id, { onDelete: "cascade" }),
    sender: text("sender").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_chat_messages_thread_id").on(table.thread_id),
    index("idx_chat_messages_sender").on(table.sender),
    index("idx_chat_messages_created_at").on(table.created_at),
  ]
);
