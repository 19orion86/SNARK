-- Нагрузочные данные для baseline производительности (только dev/стенд!).
-- Объём ориентирован на компанию ~300 сотрудников за год работы портала:
--   300 сотрудников, 12 отделов, 5000 задач, 60 каналов / 30000 сообщений,
--   1500 заявок, 400 новостей, 300 документов, 200 статей, 900 отпусков,
--   6000 уведомлений.
-- Идемпотентно: все записи помечены префиксом perf- и пересоздаются.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed-perf.sql
--
-- Входа под perf-пользователями нет: password_hash намеренно невалидный.

BEGIN;

DELETE FROM users WHERE email LIKE 'perf-%@snark.test';
DELETE FROM departments WHERE code LIKE 'PERF-%';
DELETE FROM news WHERE title LIKE 'perf-%';
DELETE FROM documents WHERE file_name LIKE 'perf-%';
DELETE FROM knowledge_articles WHERE title LIKE 'perf-%';
DELETE FROM chat_channels WHERE name LIKE 'perf-%';

INSERT INTO departments (name, code)
SELECT 'Perf отдел ' || g, 'PERF-' || g FROM generate_series(1, 12) g;

INSERT INTO users (email, password_hash, first_name, last_name, role, department_id)
SELECT 'perf-' || g || '@snark.test', '!disabled', 'Имя' || g, 'Фамилия' || g, 'employee',
       (SELECT id FROM departments WHERE code = 'PERF-' || (1 + g % 12))
FROM generate_series(1, 300) g;

INSERT INTO employee_profiles (user_id, phone, position_title, office, birth_date, start_date, presence)
SELECT id, '+7 (900) ' || lpad((row_number() OVER ())::text, 7, '0'), 'Специалист', 'Офис ' || (1 + (row_number() OVER ()) % 5),
       (date '1975-01-01' + ((row_number() OVER ()) * 37 % 9000)::int),
       (current_date - ((row_number() OVER ()) * 11 % 2000)::int),
       'office'
FROM users WHERE email LIKE 'perf-%@snark.test';

CREATE TEMP TABLE perf_users ON COMMIT DROP AS
SELECT id, department_id, row_number() OVER (ORDER BY email) AS n
FROM users WHERE email LIKE 'perf-%@snark.test';

-- Реальные dev-учётки тоже получают данные, чтобы их страницы были «тяжёлыми».
CREATE TEMP TABLE real_users ON COMMIT DROP AS
SELECT id, row_number() OVER (ORDER BY email) AS n FROM users WHERE email NOT LIKE 'perf-%@snark.test';

INSERT INTO tasks (title, description, status, priority, assignee_id, creator_id, department_id, due_date, created_at)
SELECT 'perf-задача ' || g,
       'Описание задачи ' || g || ': согласовать документацию, подготовить отчёт, провести встречу.',
       (ARRAY['new','in_progress','review','done','cancelled'])[1 + g % 5]::task_status,
       (ARRAY['low','medium','high','critical'])[1 + g % 4]::task_priority,
       CASE WHEN g % 10 = 0 THEN (SELECT id FROM real_users WHERE n = 1 + g % (SELECT count(*) FROM real_users))
            ELSE (SELECT id FROM perf_users WHERE n = 1 + g % 300) END,
       CASE WHEN g % 15 = 0 THEN (SELECT id FROM real_users WHERE n = 1 + g % (SELECT count(*) FROM real_users))
            ELSE (SELECT id FROM perf_users WHERE n = 1 + (g * 7) % 300) END,
       (SELECT department_id FROM perf_users WHERE n = 1 + g % 300),
       current_date + ((g % 60) - 30),
       now() - (g % 365) * interval '1 day'
FROM generate_series(1, 5000) g;

INSERT INTO task_participants (task_id, user_id, role)
SELECT numbered.id, u.id, 'watcher'
FROM (
  SELECT t.id, row_number() OVER (ORDER BY t.created_at, t.id) AS rn
  FROM tasks t WHERE t.title LIKE 'perf-задача %' AND right(t.title, 1) IN ('1', '5')
) numbered
JOIN perf_users u ON u.n = 1 + numbered.rn % 300;

INSERT INTO chat_channels (name, type, created_by)
SELECT 'perf-канал ' || g, 'group', (SELECT id FROM perf_users WHERE n = g)
FROM generate_series(1, 60) g;

CREATE TEMP TABLE perf_channels ON COMMIT DROP AS
SELECT id, row_number() OVER (ORDER BY name) AS n FROM chat_channels WHERE name LIKE 'perf-%';

INSERT INTO chat_channel_members (channel_id, user_id)
SELECT c.id, u.id FROM perf_channels c JOIN perf_users u ON (u.n + c.n) % 6 = 0;

-- Dev-учётки состоят во всех perf-каналах: список чатов у них максимальный.
INSERT INTO chat_channel_members (channel_id, user_id)
SELECT c.id, r.id FROM perf_channels c CROSS JOIN real_users r;

INSERT INTO chat_messages (channel_id, author_id, body, created_at)
SELECT (SELECT id FROM perf_channels WHERE n = 1 + g % 60),
       (SELECT id FROM perf_users WHERE n = 1 + ((g % 60) * 5 + (g % 50) * 6) % 300),
       'perf сообщение ' || g || ': коллеги, прошу согласовать сроки по объекту и прислать замечания.',
       now() - (30000 - g) * interval '5 minutes'
FROM generate_series(1, 30000) g;

INSERT INTO tickets (author_id, category, subject, description, status, priority, created_at)
SELECT CASE WHEN g % 20 = 0 THEN (SELECT id FROM real_users WHERE n = 1 + g % (SELECT count(*) FROM real_users))
            ELSE (SELECT id FROM perf_users WHERE n = 1 + g % 300) END,
       (SELECT slug FROM ticket_categories ORDER BY sort_order LIMIT 1 OFFSET g % GREATEST((SELECT count(*) FROM ticket_categories), 1)),
       'perf-заявка ' || g, 'Не работает принтер на этаже ' || (g % 9),
       (ARRAY['new','in_progress','resolved','closed'])[1 + g % 4],
       (ARRAY['low','medium','high'])[1 + g % 3],
       now() - (g % 365) * interval '1 day'
FROM generate_series(1, 1500) g;

INSERT INTO news (title, body, category, status, is_pinned, author_id, published_at, created_at)
SELECT 'perf-новость ' || g, repeat('Текст новости о работе компании и её проектах. ', 40),
       (ARRAY['company','hr','it','projects'])[1 + g % 4], 'published', g % 50 = 0,
       (SELECT id FROM perf_users WHERE n = 1 + g % 300),
       now() - g * interval '1 day', now() - g * interval '1 day'
FROM generate_series(1, 400) g;

INSERT INTO documents (title, category, version, file_name, content_type, size_bytes, file_path, access, department_id, created_at)
SELECT 'perf-документ ' || g, (ARRAY['policies','instructions','templates','reports','other'])[1 + g % 5],
       '1.' || (g % 4), 'perf-' || g || '.docx',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       20000 + g * 13, 'documents/perf/perf-' || g || '.docx',
       CASE WHEN g % 3 = 0 THEN 'department' ELSE 'public' END,
       CASE WHEN g % 3 = 0 THEN (SELECT department_id::text FROM perf_users WHERE n = 1 + g % 300) END,
       now() - g * interval '1 day'
FROM generate_series(1, 300) g;

INSERT INTO knowledge_articles (title, content, category, is_published, author_id, created_at)
SELECT 'perf-статья ' || g, repeat('## Раздел\n\nТекст статьи базы знаний с инструкцией для сотрудников.\n\n', 30),
       (ARRAY['general','hr','it','safety'])[1 + g % 4], g % 10 <> 0,
       (SELECT id FROM perf_users WHERE n = 1 + g % 300), now() - g * interval '1 day'
FROM generate_series(1, 200) g;

INSERT INTO vacations (user_id, start_date, end_date, days_total, days_remaining, status, type)
SELECT (SELECT id FROM perf_users WHERE n = 1 + g % 300),
       current_date + ((g * 5) % 360 - 120), current_date + ((g * 5) % 360 - 120) + 13,
       14, 14, (ARRAY['approved','pending','rejected'])[1 + g % 3], 'annual'
FROM generate_series(1, 900) g;

INSERT INTO notifications (user_id, type, title, entity_type, read_at, created_at)
SELECT CASE WHEN g % 4 = 0 THEN (SELECT id FROM real_users WHERE n = 1 + g % (SELECT count(*) FROM real_users))
            ELSE (SELECT id FROM perf_users WHERE n = 1 + g % 300) END,
       'task_assigned', 'perf уведомление ' || g, 'task',
       CASE WHEN g % 3 = 0 THEN now() END, now() - g * interval '10 minutes'
FROM generate_series(1, 6000) g;

COMMIT;

ANALYZE;
