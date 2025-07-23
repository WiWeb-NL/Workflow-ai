-- Migration to FlowAI Token System
-- Replace USD-based billing with FlowAI token system

-- Add FlowAI token balance tracking to users
ALTER TABLE "user_stats" ADD COLUMN "flowai_token_balance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_stats" ADD COLUMN "total_flowai_tokens_spent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_stats" ADD COLUMN "current_period_tokens_spent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_stats" ADD COLUMN "token_purchase_history" jsonb DEFAULT '[]'::jsonb;

-- Update existing cost columns to be nullable (for backward compatibility during migration)
ALTER TABLE "user_stats" ALTER COLUMN "current_usage_limit" DROP NOT NULL;
ALTER TABLE "user_stats" ALTER COLUMN "total_cost" DROP NOT NULL;
ALTER TABLE "user_stats" ALTER COLUMN "current_period_cost" DROP NOT NULL;

-- Add FlowAI token cost tracking to execution logs
ALTER TABLE "workflow_execution_logs" ADD COLUMN "total_flowai_tokens_cost" integer DEFAULT 0;
ALTER TABLE "workflow_execution_blocks" ADD COLUMN "flowai_tokens_cost" integer DEFAULT 0;

-- Create FlowAI token transaction log
CREATE TABLE "flowai_token_transactions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "transaction_type" text NOT NULL, -- 'purchase', 'spend', 'refund', 'bonus'
  "amount" integer NOT NULL, -- positive for credits, negative for debits
  "balance_after" integer NOT NULL,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "solana_transaction_signature" text,
  "workflow_execution_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for token transactions
CREATE INDEX "flowai_token_transactions_user_id_idx" ON "flowai_token_transactions"("user_id");
CREATE INDEX "flowai_token_transactions_type_idx" ON "flowai_token_transactions"("transaction_type");
CREATE INDEX "flowai_token_transactions_created_at_idx" ON "flowai_token_transactions"("created_at");
CREATE INDEX "flowai_token_transactions_solana_signature_idx" ON "flowai_token_transactions"("solana_transaction_signature");

-- Create FlowAI token pricing table (for different purchase tiers)
CREATE TABLE "flowai_token_pricing" (
  "id" text PRIMARY KEY,
  "token_amount" integer NOT NULL,
  "solana_price_lamports" bigint NOT NULL, -- Price in lamports (SOL base unit)
  "usd_equivalent" decimal(10,2), -- For display purposes
  "bonus_tokens" integer DEFAULT 0, -- Extra tokens for bulk purchases
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Insert initial FlowAI token pricing tiers
INSERT INTO "flowai_token_pricing" ("id", "token_amount", "solana_price_lamports", "usd_equivalent", "bonus_tokens") VALUES
  ('starter_100', 100, 100000000, 5.00, 0), -- 100 tokens for 0.1 SOL (~$5)
  ('basic_500', 500, 450000000, 22.50, 50), -- 500 tokens + 50 bonus for 0.45 SOL (~$22.50)
  ('pro_1000', 1000, 800000000, 40.00, 200), -- 1000 tokens + 200 bonus for 0.8 SOL (~$40)
  ('enterprise_5000', 5000, 3500000000, 175.00, 1500); -- 5000 tokens + 1500 bonus for 3.5 SOL (~$175)

-- Create wallet management table (if not exists from current system)
-- This stores encrypted private keys for automated payments
CREATE TABLE IF NOT EXISTS "user_solana_wallets" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE UNIQUE,
  "wallet_address" text NOT NULL UNIQUE,
  "encrypted_private_key" text, -- Encrypted with app secret
  "is_primary" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

COMMENT ON COLUMN "user_stats"."flowai_token_balance" IS 'Current FlowAI token balance (1 token = 1 workflow execution)';
COMMENT ON COLUMN "user_stats"."total_flowai_tokens_spent" IS 'Lifetime FlowAI tokens spent on workflow executions';
COMMENT ON COLUMN "user_stats"."current_period_tokens_spent" IS 'FlowAI tokens spent in current billing period';
COMMENT ON TABLE "flowai_token_transactions" IS 'All FlowAI token transactions (purchases, spending, refunds)';
COMMENT ON TABLE "flowai_token_pricing" IS 'FlowAI token pricing tiers for Solana purchases';
