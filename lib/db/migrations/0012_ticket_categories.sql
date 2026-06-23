CREATE TABLE IF NOT EXISTS "ticket_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "ticket_categories" ("slug", "label", "description", "sort_order", "is_active")
VALUES
  ('it', 'ИТ-поддержка', 'Технические проблемы, доступы, ПО и оборудование', 1, true),
  ('aho', 'АХО', 'Офис, хозяйственные вопросы, пропуска', 2, true),
  ('hr', 'HR', 'Кадровые вопросы, справки, отпуска', 3, true),
  ('other', 'Другое', 'Прочие обращения', 4, true)
ON CONFLICT ("slug") DO NOTHING;
