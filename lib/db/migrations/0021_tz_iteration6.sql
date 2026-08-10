-- 0021: polls, voice, PWA push, ticket SLA, document versions, FTS

-- Chat polls
CREATE TABLE IF NOT EXISTS chat_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  question text NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES chat_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_polls_message_idx ON chat_polls(message_id);
CREATE INDEX IF NOT EXISTS chat_poll_votes_poll_idx ON chat_poll_votes(poll_id);

-- Push subscriptions (PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

-- Ticket SLA
CREATE TABLE IF NOT EXISTS ticket_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES ticket_categories(id) ON DELETE CASCADE,
  first_response_minutes integer NOT NULL DEFAULT 60,
  resolve_minutes integer NOT NULL DEFAULT 1440,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_sla_policies_category_unique_idx
  ON ticket_sla_policies(category_id)
  WHERE category_id IS NOT NULL;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_responded_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false;

-- Extend ticket status enum if exists as check/text — tickets.status may be text or enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ticket_status'
  ) THEN
    BEGIN
      ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'waiting_response';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  file_url text,
  change_note text,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_versions_document_idx ON document_versions(document_id, created_at);

-- FTS for tasks and chat messages
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS tasks_search_vector_idx ON tasks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS chat_messages_search_vector_idx ON chat_messages USING GIN (search_vector);

UPDATE tasks SET search_vector =
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
WHERE search_vector IS NULL;

UPDATE chat_messages SET search_vector =
  to_tsvector('simple', coalesce(body, ''))
WHERE search_vector IS NULL;
