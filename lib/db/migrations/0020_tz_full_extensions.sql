-- TZ full extensions: projects, templates, chat extras, CRM, leave chain, widgets

ALTER TYPE "chat_channel_type" ADD VALUE IF NOT EXISTS 'channel';

CREATE TABLE IF NOT EXISTS "task_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active',
  "color" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_projects_owner_idx" ON "task_projects" ("owner_id");
CREATE INDEX IF NOT EXISTS "task_projects_department_idx" ON "task_projects" ("department_id");

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "project_id" uuid
  REFERENCES "task_projects"("id") ON DELETE SET NULL;

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks" ("project_id");

CREATE TABLE IF NOT EXISTS "task_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "priority" text,
  "checklist_json" jsonb,
  "creator_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_templates_creator_idx" ON "task_templates" ("creator_id");

CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "trigger" text NOT NULL,
  "action" text NOT NULL,
  "config" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "automation_rules_created_by_idx" ON "automation_rules" ("created_by");

CREATE TABLE IF NOT EXISTS "chat_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_reactions_message_user_emoji_idx" UNIQUE ("message_id", "user_id", "emoji")
);

CREATE INDEX IF NOT EXISTS "chat_reactions_message_idx" ON "chat_reactions" ("message_id");

CREATE TABLE IF NOT EXISTS "chat_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_attachments_message_idx" ON "chat_attachments" ("message_id", "created_at");

CREATE TABLE IF NOT EXISTS "chat_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_folders_user_idx" ON "chat_folders" ("user_id", "sort_order");

CREATE TABLE IF NOT EXISTS "chat_folder_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "folder_id" uuid NOT NULL REFERENCES "chat_folders"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_folder_channels_folder_channel_idx" UNIQUE ("folder_id", "channel_id")
);

CREATE INDEX IF NOT EXISTS "chat_folder_channels_channel_idx" ON "chat_folder_channels" ("channel_id");

CREATE TABLE IF NOT EXISTS "chat_pinned_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "pinned_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_pinned_messages_channel_message_idx" UNIQUE ("channel_id", "message_id")
);

CREATE INDEX IF NOT EXISTS "chat_pinned_messages_channel_idx" ON "chat_pinned_messages" ("channel_id", "created_at");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_preferences_user_id_unique" UNIQUE ("user_id")
);

CREATE TABLE IF NOT EXISTS "ticket_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ticket_comments_ticket_idx" ON "ticket_comments" ("ticket_id", "created_at");

CREATE TABLE IF NOT EXISTS "ticket_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket_idx" ON "ticket_attachments" ("ticket_id", "created_at");

CREATE TABLE IF NOT EXISTS "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "inn" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "deal_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "color" text
);

CREATE INDEX IF NOT EXISTS "deal_stages_sort_order_idx" ON "deal_stages" ("sort_order");

CREATE TABLE IF NOT EXISTS "deals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "stage_id" uuid REFERENCES "deal_stages"("id") ON DELETE SET NULL,
  "amount" integer,
  "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "source" text,
  "tags" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "deals_company_idx" ON "deals" ("company_id");
CREATE INDEX IF NOT EXISTS "deals_stage_idx" ON "deals" ("stage_id");
CREATE INDEX IF NOT EXISTS "deals_owner_idx" ON "deals" ("owner_id");

CREATE TABLE IF NOT EXISTS "deal_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL REFERENCES "deals"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "deal_activities_deal_idx" ON "deal_activities" ("deal_id", "created_at");

CREATE TABLE IF NOT EXISTS "vacation_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vacation_id" uuid NOT NULL REFERENCES "vacations"("id") ON DELETE CASCADE,
  "step" text NOT NULL,
  "approver_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "comment" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "vacation_approvals_vacation_idx" ON "vacation_approvals" ("vacation_id", "created_at");

CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "widget_type" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "config" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dashboard_widgets_user_idx" ON "dashboard_widgets" ("user_id", "sort_order");
