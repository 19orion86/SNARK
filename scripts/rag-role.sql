-- Роль БД для ассистента (Python-сервис): только SELECT на нужные таблицы public,
-- полный доступ к схеме rag. Запускает владелец базы портала ОДИН раз, до alembic_rag.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v rag_password="'<пароль>'" -f scripts/rag-role.sql
--
-- Затем в services/protocols/.env:
--   RAG_DATABASE_URL=postgresql+asyncpg://snark_rag:<пароль>@<host>:<port>/<база портала>

CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS rag;

SELECT format('CREATE ROLE snark_rag LOGIN PASSWORD %L', :rag_password)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'snark_rag')
\gexec

SELECT format('ALTER ROLE snark_rag PASSWORD %L', :rag_password)
\gexec

-- public: чтение ровно тех таблиц, которые нужны для ACL, персонализации и индексации.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM snark_rag;
GRANT USAGE ON SCHEMA public TO snark_rag;
GRANT SELECT ON public.documents, public.knowledge_articles, public.users,
                public.employee_profiles, public.departments TO snark_rag;

-- rag: схема целиком принадлежит ассистенту.
ALTER SCHEMA rag OWNER TO snark_rag;
GRANT USAGE, CREATE ON SCHEMA rag TO snark_rag;
GRANT ALL ON ALL TABLES IN SCHEMA rag TO snark_rag;
GRANT ALL ON ALL SEQUENCES IN SCHEMA rag TO snark_rag;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT ALL ON TABLES TO snark_rag;
