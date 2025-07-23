CREATE TABLE "flowai_token_pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"token_amount" integer NOT NULL,
	"solana_price_lamports" text NOT NULL,
	"usd_equivalent" numeric(10, 2),
	"bonus_tokens" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowai_token_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}',
	"solana_transaction_signature" text,
	"workflow_execution_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_solana_wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"encrypted_private_key" text,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_solana_wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_solana_wallets_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "user_stats" ALTER COLUMN "total_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ALTER COLUMN "current_usage_limit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ALTER COLUMN "current_period_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "flowai_token_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "total_flowai_tokens_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "current_period_tokens_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "token_purchase_history" json DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "flowai_token_transactions" ADD CONSTRAINT "flowai_token_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_solana_wallets" ADD CONSTRAINT "user_solana_wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flowai_token_transactions_user_id_idx" ON "flowai_token_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flowai_token_transactions_type_idx" ON "flowai_token_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "flowai_token_transactions_created_at_idx" ON "flowai_token_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "flowai_token_transactions_solana_signature_idx" ON "flowai_token_transactions" USING btree ("solana_transaction_signature");--> statement-breakpoint

-- Insert initial FlowAI token pricing tiers
INSERT INTO "flowai_token_pricing" ("id", "token_amount", "solana_price_lamports", "usd_equivalent", "bonus_tokens") VALUES
  ('starter_100', 100, '100000000', 5.00, 0),
  ('basic_500', 500, '450000000', 22.50, 50),
  ('pro_1000', 1000, '800000000', 40.00, 200),
  ('enterprise_5000', 5000, '3500000000', 175.00, 1500);