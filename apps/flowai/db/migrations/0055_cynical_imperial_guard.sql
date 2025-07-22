ALTER TABLE "user" ADD COLUMN "private_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_private_key_unique" UNIQUE("private_key");