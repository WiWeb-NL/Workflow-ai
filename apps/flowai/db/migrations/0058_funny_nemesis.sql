ALTER TABLE "user" DROP CONSTRAINT "user_wallet_address_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_private_key_unique";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "wallet_address";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "private_key";