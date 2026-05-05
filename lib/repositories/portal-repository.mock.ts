import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import {
  mapContactsData,
  mapDashboardData,
  mapDocumentsData,
  mapProfileData,
  mapSidebarItems,
} from "@/lib/mappers/portal"
import type {
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  DocumentMetadataCreatePayload,
  EmployeesQuery,
  EmployeeImportResult,
  DocumentsQuery,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
  ProfileUpdatePayload,
} from "@/types/portal"

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defaultProfileData(): ProfileData {
  return {
    userId: "mock-user-1",
    fullName: "Иван Петров",
    firstName: "Иван",
    lastName: "Петров",
    initials: "ИП",
    roleTitle: "Руководитель проекта",
    role: "employee",
    department: "СНАРК | Инжиниринг",
    departmentId: "СНАРК | Инжиниринг",
    phone: "+7 (495) 123-45-67",
    email: "i.petrov@snark.ru",
    office: "Головной офис, каб. 301",
    avatarUrl: undefined,
    presence: "office",
    legacyPresence: "office",
    tabs: [
      { id: "my_profile", label: "Мой профиль", icon: "User" },
      { id: "my_department", label: "Моё подразделение", icon: "Building2" },
      { id: "documents", label: "Документы", icon: "FileText" },
      { id: "vacation", label: "Отпуск", icon: "Calendar" },
    ],
    profileTab: { status: "office" },
    departmentTab: { departmentName: "СНАРК | Инжиниринг", manager: null, regulationsDoc: null, standardsDoc: null },
    documentsTab: { jobInstruction: null },
    vacationTab: { daysRemaining: 14, nextVacation: null, history: [] },
    tasks: [
      {
        id: 1,
        title: "Согласовать проектную документацию",
        system: "Документооборот",
        deadline: "Сегодня",
        priority: "high",
        status: "В работе",
      },
      {
        id: 2,
        title: "Подготовить отчёт по проекту КС-2",
        system: "BPMS",
        deadline: "Завтра",
        priority: "medium",
        status: "Новая",
      },
    ],
    vacations: [
      {
        id: "vacation-1",
        userId: "mock-user-1",
        startDate: "2024-06-15",
        endDate: "2024-06-28",
        daysTotal: 14,
        daysRemaining: 14,
        status: "approved",
        createdAt: "2024-01-10T09:00:00.000Z",
      },
      {
        id: "vacation-2",
        userId: "mock-user-1",
        startDate: "2024-12-23",
        endDate: "2025-01-08",
        daysTotal: 14,
        daysRemaining: 0,
        status: "pending",
        createdAt: "2024-02-15T09:00:00.000Z",
      },
    ],
    payslips: ["Апрель 2024", "Март 2024", "Февраль 2024", "Январь 2024"],
  }
}

const mockNewsItems: NewsListResponse["items"] = [
  {
    id: "news-1",
    title: "Запущен новый проект по модернизации контактной сети в Казани",
    body: "Короткий анонс: сформирована команда проекта, утвержден график работ.",
    category: "projects",
    coverUrl: null,
    isPinned: false,
    status: "published",
    authorId: "mock-user-1",
    authorName: "Петров Иван",
    publishedAt: "2026-04-30T09:00:00.000Z",
    createdAt: "2026-04-29T09:00:00.000Z",
    updatedAt: "2026-04-30T09:00:00.000Z",
  },
  {
    id: "news-2",
    title: "Плановое техническое обслуживание корпоративных систем",
    body: "В указанный период возможны кратковременные перерывы в работе внутренних сервисов.",
    category: "important",
    coverUrl: null,
    isPinned: true,
    status: "published",
    authorId: "mock-user-1",
    authorName: "Петров Иван",
    publishedAt: "2026-04-27T09:00:00.000Z",
    createdAt: "2026-04-26T09:00:00.000Z",
    updatedAt: "2026-04-27T09:00:00.000Z",
  },
]

export const mockPortalRepository: PortalRepository = {
  async getDashboardData() {
    await delay()
    return mapDashboardData({
      welcomeName: "Иван",
      quickActions: [
        { label: "Создать заявку в ИТ", icon: "HelpCircle", href: "/support/new" },
        { label: "Забронировать переговорную", icon: "DoorOpen", href: "/rooms" },
        { label: "Новости компании", icon: "Newspaper", href: "/culture/news" },
        { label: "Найти сотрудника", icon: "Users", href: "/contacts" },
        { label: "Нормативная база", icon: "FileText", href: "/documents" },
        { label: "Электронная библиотека", icon: "BookOpen", href: "/library" },
      ],
      recentNews: [
        {
          id: "news-1",
          title: "Запущен новый проект по модернизации контактной сети в Казани",
          body: "Короткий анонс: сформирована команда проекта, утвержден график работ.",
          category: "Проект",
          coverUrl: null,
          isPinned: false,
          status: "published",
          authorId: "mock-user-1",
          publishedAt: "2026-04-30T09:00:00.000Z",
          createdAt: "2026-04-29T09:00:00.000Z",
          updatedAt: "2026-04-30T09:00:00.000Z",
        },
        {
          id: "news-2",
          title: "Плановое техническое обслуживание корпоративных систем 15-17 мая",
          body: "В указанный период возможны кратковременные перерывы в работе внутренних сервисов.",
          category: "Объявление",
          coverUrl: null,
          isPinned: true,
          status: "published",
          authorId: "mock-user-1",
          publishedAt: "2026-04-27T09:00:00.000Z",
          createdAt: "2026-04-26T09:00:00.000Z",
          updatedAt: "2026-04-27T09:00:00.000Z",
        },
        {
          id: "news-3",
          title: "Результаты квартального совещания руководителей подразделений",
          body: "Опубликованы ключевые решения по производственным и административным инициативам.",
          category: "Отчёт",
          coverUrl: null,
          isPinned: false,
          status: "published",
          authorId: "mock-user-1",
          publishedAt: "2026-04-24T09:00:00.000Z",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-24T09:00:00.000Z",
        },
        {
          id: "news-4",
          title: "Приглашение на корпоративный праздник День энергетика",
          body: "Регистрация открыта в разделе корпоративной культуры до конца недели.",
          category: "Событие",
          coverUrl: null,
          isPinned: false,
          status: "published",
          authorId: "mock-user-1",
          publishedAt: "2026-04-22T09:00:00.000Z",
          createdAt: "2026-04-21T09:00:00.000Z",
          updatedAt: "2026-04-22T09:00:00.000Z",
        },
      ],
      todayBirthdays: [
        { name: "Мария Иванова", department: "СНАРК | Проект", avatar: "МИ" },
        { name: "Алексей Козлов", department: "СНАРК | Строй", avatar: "АК" },
      ],
      newEmployees: [
        {
          id: "employee-1",
          name: "Николай Степанов",
          position: "Инженер",
          department: "СНАРК | Инжиниринг",
          avatar: "НС",
          startDate: "2026-04-21",
        },
        {
          id: "employee-2",
          name: "Ольга Егорова",
          position: "Специалист по кадрам",
          department: "Управление",
          avatar: "ОЕ",
          startDate: "2026-04-18",
        },
      ],
      myTasks: [
        { title: "Согласовать проектную документацию", deadline: "Сегодня", priority: "high" },
        { title: "Подготовить отчёт за апрель", deadline: "Завтра", priority: "medium" },
        { title: "Провести встречу с подрядчиком", deadline: "3 мая", priority: "low" },
      ],
      serviceCards: [
        {
          title: "Личный кабинет",
          description: "Ваш профиль, задачи, отпуск, оценки",
          icon: "Users",
          color: "bg-secondary",
        },
        {
          title: "Кадровые вопросы",
          description: "Всё о работе в СНАРК",
          icon: "FileText",
          color: "bg-accent",
        },
        {
          title: "Корп. культура",
          description: "Мероприятия, фото, жизнь компании",
          icon: "Calendar",
          color: "bg-success",
        },
        {
          title: "Нормативная база",
          description: "Политики, регламенты, инструкции",
          icon: "BookOpen",
          color: "bg-destructive",
        },
      ],
    })
  },

  async getContactsData(_query?: EmployeesQuery) {
    await delay()
    return mapContactsData({
      departments: [
        "Все",
        "Управление",
        "СНАРК | Проект",
        "СНАРК | Строй",
        "СНАРК | Инжиниринг",
        "СНАРК | Контактная сеть",
        "СНАРК | Тяговые подстанции",
        "СНАРК | Стальные решения",
        "СНАРК | Зарядные станции",
      ],
      employees: [
        {
          id: 1,
          name: "Александр Петров",
          position: "Генеральный директор",
          department: "Управление",
          phone: "+7 (495) 123-45-67",
          email: "a.petrov@snark.ru",
          office: "Головной офис, каб. 101",
          status: "online",
          avatar: "АП",
        },
        {
          id: 2,
          name: "Елена Сидорова",
          position: "Руководитель направления",
          department: "СНАРК | Проект",
          phone: "+7 (495) 123-45-68",
          email: "e.sidorova@snark.ru",
          office: "Офис проектирования, каб. 205",
          status: "online",
          avatar: "ЕС",
        },
        {
          id: 3,
          name: "Иван Смирнов",
          position: "Главный инженер",
          department: "СНАРК | Инжиниринг",
          phone: "+7 (495) 123-45-69",
          email: "i.smirnov@snark.ru",
          office: "Технический центр, каб. 310",
          status: "offline",
          avatar: "ИС",
        },
      ],
    })
  },

  async getDocumentsData(
    query?: DocumentsQuery,
    _requester?: { role: string; userId?: string; departmentId?: string | null }
  ) {
    await delay()
    const items = [
      {
        id: "mock-doc-1",
        title: "Политика информационной безопасности",
        category: "Политики",
        date: "15 апреля 2024",
        version: "2.1",
        size: "2.4 МБ",
        owner: "Служба безопасности",
        access: "public" as const,
        departmentId: null,
      },
      {
        id: "mock-doc-2",
        title: "Политика обработки персональных данных",
        category: "Политики",
        date: "10 апреля 2024",
        version: "1.3",
        size: "1.2 МБ",
        owner: "Юридический отдел",
        access: "public" as const,
        departmentId: null,
      },
      {
        id: "mock-doc-3",
        title: "Регламент работы с подрядными организациями",
        category: "Регламенты",
        date: "25 марта 2024",
        version: "2.0",
        size: "4.8 МБ",
        owner: "СНАРК | Строй",
        access: "restricted" as const,
        departmentId: "СНАРК | Строй",
      },
    ]
    const category = query?.category && query.category !== "Все" ? query.category : undefined
    const search = query?.search?.toLowerCase()
    const filtered = items.filter((doc) => {
      const categoryPass = category ? doc.category === category : true
      const searchPass = search
        ? doc.title.toLowerCase().includes(search) || doc.owner.toLowerCase().includes(search)
        : true
      return categoryPass && searchPass
    })
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const start = (page - 1) * limit
    const pageItems = filtered.slice(start, start + limit)
    return mapDocumentsData({
      categories: ["Все", "Политики", "Инструкции", "Регламенты", "Приказы", "Архив"],
      documents: pageItems,
      total: filtered.length,
      page,
      limit,
    })
  },

  async getDocumentById(id: string) {
    await delay()
    const docs = await this.getDocumentsData()
    return { item: docs.documents.find((doc) => doc.id === id) ?? null }
  },

  async createDocumentMetadata(payload: DocumentMetadataCreatePayload & { createdBy: string }) {
    await delay()
    const documentId = `mock-doc-${Date.now()}`
    return {
      documentId,
      objectKey: `documents/${payload.createdBy}/${documentId}/${payload.fileName}`,
      uploadUrl: `https://mock-storage.local/upload/${documentId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
  },

  async getProfileData(_userId?: string) {
    await delay()
    return mapProfileData(defaultProfileData())
  },

  async getCurrentUserProfile(_userId: string) {
    await delay()
    return mapProfileData(defaultProfileData())
  },

  async updateProfile(_userId: string, payload: ProfileUpdatePayload) {
    await delay()
    const current = defaultProfileData()
    const next = {
      ...current,
      phone: payload.phone ?? current.phone,
      avatarUrl: payload.avatarUrl ?? current.avatarUrl,
    }
    return mapProfileData(next)
  },

  async updateMyPresence(_userId: string, payload: ProfilePresenceUpdatePayload) {
    await delay()
    const current = defaultProfileData()
    const legacyPresence = payload.presence === "remote" ? "offline" : payload.presence === "vacation" ? "away" : "office"
    return mapProfileData({
      ...current,
      presence: payload.presence,
      legacyPresence,
      profileTab: {
        status: payload.presence,
      },
    })
  },

  async listAdminEmployees() {
    await delay()
    const base = defaultProfileData()
    const items: AdminEmployeeItem[] = [
      {
        id: "mock-user-1",
        fullName: base.fullName,
        firstName: base.firstName ?? "Иван",
        lastName: base.lastName ?? "Петров",
        middleName: null,
        positionTitle: base.roleTitle,
        departmentId: "dept-mock-1",
        departmentName: base.department,
        phone: base.phone,
        email: base.email,
        birthDate: "1990-01-10",
        startDate: "2020-09-01",
        welcomeNote: "Добро пожаловать в команду.",
        status: "active",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    return { items }
  },

  async createAdminEmployee(payload: AdminEmployeeUpsertPayload) {
    await delay()
    return {
      id: `mock-user-${Date.now()}`,
      fullName: payload.fullName,
      firstName: payload.fullName.split(" ")[1] ?? payload.fullName,
      lastName: payload.fullName.split(" ")[0] ?? payload.fullName,
      middleName: null,
      positionTitle: payload.positionTitle,
      departmentId: null,
      departmentName: payload.departmentName,
      phone: payload.phone ?? null,
      email: payload.email,
      birthDate: payload.birthDate ?? null,
      startDate: payload.startDate ?? null,
      welcomeNote: payload.welcomeNote ?? null,
      status: payload.status ?? "active",
      isActive: payload.status !== "dismissed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  async updateAdminEmployee(id: string, payload: AdminEmployeeUpsertPayload) {
    await delay()
    const created = await this.createAdminEmployee(payload)
    return { ...created, id }
  },

  async hideAdminEmployee(id: string, hidden: boolean) {
    await delay()
    const items = await this.listAdminEmployees()
    const item = items.items[0]
    return {
      ...item,
      id,
      isActive: !hidden,
      status: hidden ? "dismissed" : "active",
      updatedAt: new Date().toISOString(),
    }
  },

  async deleteAdminEmployee(_id: string): Promise<void> {
    return
  },

  async importEmployees(rows: AdminEmployeeUpsertPayload[]): Promise<EmployeeImportResult> {
    await delay()
    let created = 0
    let updated = 0
    const errors: EmployeeImportResult["errors"] = []
    rows.forEach((row, idx) => {
      if (!row.email.includes("@")) {
        errors.push({ row: idx + 2, reason: "Некорректный email" })
      } else if (row.email.includes("existing")) {
        updated += 1
      } else {
        created += 1
      }
    })
    return { created, updated, errors }
  },

  async getNewsList(query?: NewsListQuery, includeDrafts = false): Promise<NewsListResponse> {
    await delay()
    const page = query?.page ?? 1
    const limit = query?.limit ?? 10
    const category = query?.category && query.category !== "all" ? query.category : undefined
    const filtered = mockNewsItems.filter((item) => {
      const statusPass = includeDrafts ? true : item.status === "published"
      const categoryPass = category ? item.category === category : true
      return statusPass && categoryPass
    })
    const sorted = [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime()
    })
    const start = (page - 1) * limit
    return {
      items: sorted.slice(start, start + limit),
      total: sorted.length,
      page,
      limit,
    }
  },

  async getNewsById(id: string, includeDrafts = false): Promise<NewsDetailResponse> {
    await delay()
    const item = mockNewsItems.find((entry) => entry.id === id) ?? null
    if (!item) return { item: null }
    if (!includeDrafts && item.status !== "published") return { item: null }
    return { item }
  },

  async createNews(payload: NewsEditorPayload & { authorId: string }) {
    await delay()
    return {
      id: `news-${Date.now()}`,
      title: payload.title,
      body: payload.body,
      category: payload.category,
      coverUrl: payload.coverUrl ?? null,
      isPinned: payload.isPinned ?? false,
      status: payload.status ?? "draft",
      authorId: payload.authorId,
      authorName: "Петров Иван",
      publishedAt: payload.status === "published" ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  async updateNews(id: string, payload: NewsEditorPayload) {
    await delay()
    const existing = mockNewsItems.find((entry) => entry.id === id)
    if (!existing) return null
    return {
      ...existing,
      title: payload.title,
      body: payload.body,
      category: payload.category,
      coverUrl: payload.coverUrl ?? null,
      isPinned: payload.isPinned ?? false,
      status: payload.status ?? "draft",
      publishedAt: payload.status === "published" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }
  },

  async deleteNews(_id: string): Promise<void> {
    await delay(20)
  },

  async getSidebarItems() {
    await delay(20)
    return mapSidebarItems([
      { id: "dashboard", label: "Главная", icon: "LayoutDashboard", description: "Дашборд", href: "/dashboard" },
      { id: "news", label: "Новости", icon: "Newspaper", description: "Лента новостей", href: "/news" },
      { id: "contacts", label: "Сотрудники", icon: "Users", description: "Справочник", href: "/contacts" },
      { id: "documents", label: "Документы", icon: "FileText", description: "Нормативная база", href: "/documents" },
      { id: "profile", label: "Мой профиль", icon: "User", description: "Личный кабинет", href: "/profile" },
      {
        id: "admin",
        label: "Админ-панель",
        icon: "ShieldCheck",
        description: "Управление доступом",
        href: "/admin",
        roles: ["admin", "hr_manager"],
      },
    ])
  },
}
