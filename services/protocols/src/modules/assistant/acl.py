"""Правило доступа к источникам — единственное место, где оно записано для ассистента.

Повторяет портал (`getDocumentsData` в portal-repository.drizzle.ts и
`lib/documents/access.ts`):
- admin и hr_manager видят все документы;
- остальные — `access = 'public'` или документы своего отдела;
- `documents.department_id` имеет тип text, `users.department_id` — uuid,
  поэтому uuid приводится к text; сотрудник без отдела сравнивается с ''.

Дополнительно для ассистента: документ должен быть опубликован для базы знаний
(`rag_status = 'actual'`), статья — `is_published`.

Фрагмент рассчитан на запрос с алиасами: s — rag.sources, d — public.documents,
a — public.knowledge_articles, r — строка запрашивающего пользователя.
Права читаются из public.users в том же запросе и не принимаются снаружи.
"""

from __future__ import annotations

PRIVILEGED_ROLES = ("admin", "hr_manager")

REQUESTER_CTE = """
requester AS (
  SELECT u.id, u.role::text AS role, u.department_id
  FROM public.users u
  WHERE u.id = :user_id AND u.is_active
)
"""

SOURCE_JOINS = """
LEFT JOIN public.documents d
  ON s.source_type = 'document' AND d.id = s.source_id
LEFT JOIN public.knowledge_articles a
  ON s.source_type = 'article' AND a.id = s.source_id
"""

VISIBLE_SOURCE_PREDICATE = """
(
  (
    s.source_type = 'document'
    AND d.rag_status = 'actual'
    AND (
      r.role IN ('admin', 'hr_manager')
      OR d.access = 'public'
      OR d.department_id = COALESCE(r.department_id::text, '')
    )
  )
  OR (s.source_type = 'article' AND a.is_published)
)
"""


def can_view_document(
    role: str, user_department_id: str | None, access: str, document_department_id: str | None
) -> bool:
    """То же правило на Python — для тестов-матриц и сверки с SQL."""
    if role in PRIVILEGED_ROLES:
        return True
    if access == "public":
        return True
    return document_department_id == (user_department_id or "")
