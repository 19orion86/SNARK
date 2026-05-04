CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"head_user_id" uuid,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text DEFAULT 'company' NOT NULL,
	"cover_url" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_total" integer NOT NULL,
	"days_remaining" integer NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "department_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "doc_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "linked_position" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "linked_department_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN "welcome_note" text;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_users_id_fk" FOREIGN KEY ("head_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_linked_department_id_departments_id_fk" FOREIGN KEY ("linked_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;