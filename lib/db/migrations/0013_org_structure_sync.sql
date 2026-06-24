ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "external_key" text;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "planned_headcount" integer;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "departments_external_key_unique" ON "departments" ("external_key") WHERE "external_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "org_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "file_name" text,
  "sync_mode" text DEFAULT 'merge' NOT NULL,
  "apply_departments" boolean DEFAULT false NOT NULL,
  "apply_employees" boolean DEFAULT false NOT NULL,
  "stats" text,
  "warnings_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
