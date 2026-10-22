CREATE TABLE "subscription_invoice" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"issued_at" timestamp with time zone NOT NULL
);
