import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import {
  mapContactsData,
  mapDashboardData,
  mapDocumentsData,
  mapProfileData,
  mapSidebarItems,
} from "@/lib/mappers/portal"
import type {
  AdminDepartmentItem,
  AdminDepartmentUpsertPayload,
  AdminDepartmentsResponse,
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  AdminPortalUserCreatePayload,
  AdminPortalUserItem,
  AdminPortalUsersResponse,
  AdminVacationItem,
  BirthdaysData,
  CalendarEvent,
  DepartmentTreeNode,
  DepartmentsTreeResponse,
  DocumentMetadataCreatePayload,
  Employee,
  EmployeesQuery,
  EventCreatePayload,
  EventsListResponse,
  EventsMonthQuery,
  KnowledgeArticle,
  KnowledgeDetailResponse,
  KnowledgeEditorPayload,
  KnowledgeListQuery,
  KnowledgeListResponse,
  NewEmployeeItem,
  EmployeeImportResult,
  DocumentsQuery,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
  ProfileUpdatePayload,
  Ticket,
  TicketAdminUpdatePayload,
  TicketCreatePayload,
  TicketsListResponse,
  TicketsQuery,
  VacationAdminUpdatePayload,
  VacationBalance,
  VacationCreatePayload,
  VacationItem,
  VacationStatus,
} from "@/types/portal"
import type { UserRole } from "@/types/auth"

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
        type: "annual",
        comment: null,
        approvedBy: null,
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
        type: "annual",
        comment: null,
        approvedBy: null,
        createdAt: "2024-02-15T09:00:00.000Z",
      },
    ],
    payslips: ["Апрель 2024", "Март 2024", "Февраль 2024", "Январь 2024"],
  }
}

const mockEmployees: Employee[] = [
  {
    id: 1,
    userId: "00000000-0000-0000-0000-000000000001",
    name: "Александр Петров",
    position: "Генеральный директор",
    department: "Управление",
    phone: "+7 (495) 123-45-67",
    email: "a.petrov@snark.ru",
    office: "Головной офис, каб. 101",
    status: "online",
    avatar: "АП",
    inn: null,
    snils: null,
    birthDate: null,
    address: null,
    citizenship: null,
    anniversaryYears: null,
    professions: null,
    education: null,
    managerPosition: null,
    contractEndDate: null,
    isContractor: false,
    hireDate: null,
    welcomeText: null,
    isNew: false,
  },
  {
    id: 2,
    userId: "00000000-0000-0000-0000-000000000002",
    name: "Елена Сидорова",
    position: "Руководитель направления",
    department: "СНАРК | Проект",
    phone: "+7 (495) 123-45-68",
    email: "e.sidorova@snark.ru",
    office: "Офис проектирования, каб. 205",
    status: "online",
    avatar: "ЕС",
    inn: null,
    snils: null,
    birthDate: null,
    address: null,
    citizenship: null,
    anniversaryYears: null,
    professions: null,
    education: null,
    managerPosition: null,
    contractEndDate: null,
    isContractor: false,
    hireDate: null,
    welcomeText: null,
    isNew: false,
  },
  {
    id: 3,
    userId: "00000000-0000-0000-0000-000000000003",
    name: "Иван Смирнов",
    position: "Главный инженер",
    department: "СНАРК | Инжиниринг",
    phone: "+7 (495) 123-45-69",
    email: "i.smirnov@snark.ru",
    office: "Технический центр, каб. 310",
    status: "offline",
    avatar: "ИС",
    inn: null,
    snils: null,
    birthDate: null,
    address: null,
    citizenship: null,
    anniversaryYears: null,
    professions: null,
    education: null,
    managerPosition: null,
    contractEndDate: null,
    isContractor: false,
    hireDate: null,
    welcomeText: null,
    isNew: false,
  },
]

interface MockDepartment {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  headUserId: string | null
  contactEmail?: string | null
}

const mockDepartments: MockDepartment[] = [
  {
    id: "d0000001-0000-0000-0000-000000000001",
    name: "Управление",
    code: "MGMT",
    description: "Высший управленческий орган компании",
    parentId: null,
    headUserId: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "d0000002-0000-0000-0000-000000000002",
    name: "СНАРК | Проект",
    code: "PRJ",
    description: "Проектное направление",
    parentId: "d0000001-0000-0000-0000-000000000001",
    headUserId: "00000000-0000-0000-0000-000000000002",
  },
  {
    id: "d0000003-0000-0000-0000-000000000003",
    name: "СНАРК | Инжиниринг",
    code: "ENG",
    description: "Инжиниринговое направление",
    parentId: "d0000001-0000-0000-0000-000000000001",
    headUserId: "00000000-0000-0000-0000-000000000003",
  },
  {
    id: "d0000004-0000-0000-0000-000000000004",
    name: "СНАРК | Строй",
    code: "STR",
    description: "Строительное направление",
    parentId: "d0000001-0000-0000-0000-000000000001",
    headUserId: null,
  },
  {
    id: "d0000005-0000-0000-0000-000000000005",
    name: "СНАРК | Контактная сеть",
    code: "ENG-CS",
    description: null,
    parentId: "d0000003-0000-0000-0000-000000000003",
    headUserId: null,
  },
  {
    id: "d0000006-0000-0000-0000-000000000006",
    name: "СНАРК | Тяговые подстанции",
    code: "ENG-TP",
    description: null,
    parentId: "d0000003-0000-0000-0000-000000000003",
    headUserId: null,
  },
  {
    id: "d0000007-0000-0000-0000-000000000007",
    name: "СНАРК | Стальные решения",
    code: "STR-SR",
    description: null,
    parentId: "d0000004-0000-0000-0000-000000000004",
    headUserId: null,
  },
  {
    id: "d0000008-0000-0000-0000-000000000008",
    name: "СНАРК | Зарядные станции",
    code: "PRJ-ZS",
    description: null,
    parentId: "d0000002-0000-0000-0000-000000000002",
    headUserId: null,
  },
]

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

const mockPortalUsers: AdminPortalUserItem[] = [
  {
    id: "f1111111-1111-4111-a111-111111111101",
    email: "i.petrov@snark.ru",
    firstName: "Иван",
    lastName: "Петров",
    role: "employee",
    isActive: true,
    departmentName: "СНАРК | Инжиниринг",
    createdAt: "2026-01-15T10:00:00.000Z",
    lastLoginAt: "2026-05-01T08:30:00.000Z",
  },
  {
    id: "a0000001-0000-0000-0000-000000000099",
    email: "admin@snark.local",
    firstName: "Алексей",
    lastName: "Смирнов",
    role: "admin",
    isActive: true,
    departmentName: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    lastLoginAt: null,
  },
]

export const mockPortalRepository: PortalRepository = {
  async getDashboardData(userId?: string) {
    await delay()
    let welcomeName = "Иван"
    if (userId) {
      const profile = await this.getProfileData(userId)
      welcomeName = profile.firstName?.trim() || profile.fullName.split(" ")[0] || welcomeName
    }
    return mapDashboardData({
      welcomeName,
      quickActions: [
        { label: "Создать заявку в ИТ", icon: "HelpCircle", href: "/support" },
        { label: "Забронировать переговорную", icon: "DoorOpen", href: "/booking" },
        { label: "Новости компании", icon: "Newspaper", href: "/news" },
        { label: "Найти сотрудника", icon: "Users", href: "/contacts" },
        { label: "Нормативная база", icon: "FileText", href: "/documents" },
        { label: "Электронная библиотека", icon: "BookOpen", href: "/knowledge" },
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
      birthdays: {
        today: [
          {
            id: "mock-birthday-1",
            name: "Мария Иванова",
            department: "СНАРК | Проект",
            position: "Главный специалист",
            avatar: "МИ",
            avatarUrl: null,
            birthDate: "1990-01-15",
            age: 36,
          },
          {
            id: "mock-birthday-2",
            name: "Алексей Козлов",
            department: "СНАРК | Строй",
            position: "Инженер",
            avatar: "АК",
            avatarUrl: null,
            birthDate: "1988-06-20",
            age: 38,
          },
        ],
        thisWeek: [
          {
            id: "mock-birthday-3",
            name: "Ольга Никитина",
            department: "Отдел кадров",
            position: "Инспектор",
            avatar: "ОН",
            avatarUrl: null,
            birthDate: "1992-08-22",
            age: 34,
          },
        ],
        upcoming: [
          {
            id: "mock-birthday-4",
            name: "Дмитрий Волков",
            department: "Бухгалтерия",
            position: "Экономист",
            avatar: "ДВ",
            avatarUrl: null,
            birthDate: "1985-09-05",
            age: 41,
          },
        ],
      },
      newEmployees: [
        {
          id: "employee-1",
          name: "Николай Степанов",
          position: "Инженер",
          department: "СНАРК | Инжиниринг",
          avatar: "НС",
          avatarUrl: null,
          startDate: "2026-04-21",
          welcomeText:
            "Коллеги, рады представить Николая! Он усилит команду инжиниринга и поможет с новыми проектами.",
        },
        {
          id: "employee-2",
          name: "Ольга Егорова",
          position: "Специалист по кадрам",
          department: "Управление",
          avatar: "ОЕ",
          avatarUrl: null,
          startDate: "2026-04-18",
          welcomeText: null,
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
          href: "/profile",
        },
        {
          title: "Кадровые вопросы",
          description: "Всё о работе в СНАРК",
          icon: "FileText",
          color: "bg-accent",
          href: "/documents?category=hr",
        },
        {
          title: "Корп. культура",
          description: "Мероприятия, фото, жизнь компании",
          icon: "Calendar",
          color: "bg-success",
          href: "/news?category=company",
        },
        {
          title: "Нормативная база",
          description: "Политики, регламенты, инструкции",
          icon: "BookOpen",
          color: "bg-destructive",
          href: "/documents",
        },
      ],
    })
  },

  async getBirthdays(): Promise<BirthdaysData> {
    await delay()
    const dashboard = await this.getDashboardData()
    return dashboard.birthdays
  },

  async getNewEmployees(): Promise<NewEmployeeItem[]> {
    await delay()
    const dashboard = await this.getDashboardData()
    return dashboard.newEmployees
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
      employees: mockEmployees,
    })
  },

  async getEmployeeById(id: string): Promise<{ item: Employee | null }> {
    await delay()
    const found = mockEmployees.find((employee) => employee.userId === id) ?? null
    if (!found) return { item: null }

    const dept = mockDepartments.find((d) => d.name === found.department)
    if (dept?.headUserId && dept.headUserId !== found.userId) {
      const head = mockEmployees.find((e) => e.userId === dept.headUserId)
      if (head) {
        return {
          item: {
            ...found,
            manager: { id: head.userId, fullName: head.name, positionTitle: head.position },
          },
        }
      }
    }
    return { item: { ...found, manager: null } }
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
        inn: null,
        snils: null,
        address: null,
        citizenship: null,
        anniversaryYears: null,
        professions: null,
        education: null,
        managerPosition: null,
        contractEndDate: null,
        isContractor: false,
        isNew: false,
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
      email: payload.email ?? `imported.${Math.random().toString(36).slice(2, 10)}@imported.local`,
      birthDate: payload.birthDate ?? null,
      startDate: payload.startDate ?? null,
      welcomeNote: payload.welcomeNote ?? null,
      status: payload.status ?? "active",
      isActive: payload.status !== "dismissed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inn: payload.inn ?? null,
      snils: payload.snils ?? null,
      address: payload.address ?? null,
      citizenship: payload.citizenship ?? null,
      anniversaryYears: payload.anniversaryYears ?? null,
      professions: payload.professions ?? null,
      education: payload.education ?? null,
      managerPosition: payload.managerPosition ?? null,
      contractEndDate: payload.contractEndDate ?? null,
      isContractor: payload.isContractor ?? false,
      isNew: Boolean(payload.welcomeNote?.trim()),
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
      if (!row.fullName.trim()) {
        errors.push({ row: idx + 2, reason: "Не указано ФИО" })
        return
      }
      if (row.email?.includes("existing")) {
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
      { id: "structure", label: "Структура", icon: "Building2", description: "Оргструктура", href: "/structure" },
      { id: "documents", label: "Документы", icon: "FileText", description: "Нормативная база", href: "/documents" },
      {
        id: "protocols",
        label: "Протоколы",
        icon: "Mic",
        description: "Аудио → текст → протокол",
        href: "/protocols",
      },
      { id: "tasks", label: "Задачи", icon: "CheckSquare", description: "Таск-менеджер", href: "/tasks" },
      { id: "chat", label: "Чат", icon: "MessageSquare", description: "Внутренняя переписка", href: "/chat" },
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

  async getDepartmentsTree(): Promise<DepartmentsTreeResponse> {
    await delay(40)

    const countByName = new Map<string, number>()
    for (const emp of mockEmployees) {
      countByName.set(emp.department, (countByName.get(emp.department) ?? 0) + 1)
    }

    const headByUserId = new Map<string, Employee>()
    for (const emp of mockEmployees) {
      headByUserId.set(emp.userId, emp)
    }

    const nodeById = new Map<string, DepartmentTreeNode & { parentId: string | null }>()
    for (const dept of mockDepartments) {
      const headEmp = dept.headUserId ? headByUserId.get(dept.headUserId) : undefined
      nodeById.set(dept.id, {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        head: headEmp
          ? {
              id: headEmp.userId,
              fullName: headEmp.name,
              positionTitle: headEmp.position,
              avatarUrl: headEmp.avatarUrl ?? null,
            }
          : null,
        employeeCount: countByName.get(dept.name) ?? 0,
        children: [],
        parentId: dept.parentId,
      })
    }

    const roots: DepartmentTreeNode[] = []
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortRecursive = (list: DepartmentTreeNode[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name, "ru"))
      for (const item of list) sortRecursive(item.children)
    }
    sortRecursive(roots)

    const strip = (node: DepartmentTreeNode & { parentId?: string | null }): DepartmentTreeNode => {
      const { parentId: _parentId, children, ...rest } = node
      return { ...rest, children: children.map(strip) }
    }

    return { departments: roots.map(strip) }
  },

  async listMyTickets(authorId: string, query?: TicketsQuery): Promise<TicketsListResponse> {
    await delay(20)
    const filtered = mockTickets.filter((ticket) => {
      if (ticket.authorId !== authorId) return false
      if (query?.status && query.status !== "all" && ticket.status !== query.status) return false
      return true
    })
    return paginateTickets(filtered, query)
  },

  async listAdminTickets(query?: TicketsQuery): Promise<TicketsListResponse> {
    await delay(20)
    const filtered = mockTickets.filter((ticket) => {
      if (query?.status && query.status !== "all" && ticket.status !== query.status) return false
      return true
    })
    return paginateTickets(filtered, query)
  },

  async getTicketById(
    id: string,
    requester: { userId: string; role: UserRole }
  ): Promise<{ item: Ticket | null }> {
    await delay(10)
    const ticket = mockTickets.find((entry) => entry.id === id) ?? null
    if (!ticket) return { item: null }
    if (requester.role !== "admin" && ticket.authorId !== requester.userId) {
      return { item: null }
    }
    return { item: { ...ticket } }
  },

  async createTicket(payload: TicketCreatePayload & { authorId: string }): Promise<Ticket> {
    await delay(40)
    const now = new Date().toISOString()
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `ticket-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e6).toString(16)}`
    const author = mockEmployees.find((emp) => emp.userId === payload.authorId)
    const ticket: Ticket = {
      id,
      authorId: payload.authorId,
      authorName: author?.name ?? "Не указан",
      category: payload.category,
      subject: payload.subject,
      description: payload.description ?? null,
      status: "new",
      priority: payload.priority,
      assigneeId: null,
      assigneeName: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    mockTickets.unshift(ticket)
    return { ...ticket }
  },

  async updateAdminTicket(id: string, payload: TicketAdminUpdatePayload): Promise<Ticket> {
    await delay(30)
    const index = mockTickets.findIndex((entry) => entry.id === id)
    if (index === -1) throw new Error("Заявка не найдена")
    const current = mockTickets[index]

    const next: Ticket = { ...current }
    if (payload.status !== undefined) {
      const previousStatus = current.status
      next.status = payload.status
      if (payload.status === "resolved" && previousStatus !== "resolved") {
        next.resolvedAt = new Date().toISOString()
      } else if (payload.status !== "resolved" && current.resolvedAt) {
        next.resolvedAt = null
      }
    }
    if (payload.assigneeId !== undefined) {
      next.assigneeId = payload.assigneeId
      const assignee = payload.assigneeId
        ? mockEmployees.find((emp) => emp.userId === payload.assigneeId)
        : null
      next.assigneeName = assignee?.name ?? (payload.assigneeId ? "Не указан" : null)
    }
    next.updatedAt = new Date().toISOString()

    mockTickets[index] = next
    return { ...next }
  },

  async listMyVacations(userId: string): Promise<VacationItem[]> {
    await delay(10)
    return mockVacations
      .filter((item) => item.userId === userId)
      .map((item) => ({ ...item }))
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
  },

  async getMyVacationBalance(userId: string): Promise<VacationBalance> {
    await delay(10)
    const annual = 28
    const year = new Date().getFullYear()
    const used = mockVacations
      .filter(
        (item) =>
          item.userId === userId &&
          item.status === "approved" &&
          item.type === "annual" &&
          item.startDate.startsWith(`${year}-`)
      )
      .reduce((sum, item) => sum + item.daysTotal, 0)
    return { annual, used, remaining: annual - used }
  },

  async createVacation(
    payload: VacationCreatePayload & { userId: string; daysTotal: number }
  ): Promise<VacationItem> {
    await delay(30)
    const balance = await this.getMyVacationBalance(payload.userId)
    const daysRemainingSnapshot =
      payload.type === "annual" ? balance.remaining - payload.daysTotal : balance.remaining
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `vacation-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e6).toString(16)}`
    const item: VacationItem = {
      id,
      userId: payload.userId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      daysTotal: payload.daysTotal,
      daysRemaining: daysRemainingSnapshot,
      status: "pending",
      type: payload.type,
      comment: payload.comment ?? null,
      approvedBy: null,
      createdAt: new Date().toISOString(),
    }
    mockVacations.unshift(item)
    return { ...item }
  },

  async listAdminVacations(filter?: { status?: VacationStatus }): Promise<AdminVacationItem[]> {
    await delay(20)
    const statusFilter = filter?.status ?? "pending"
    return mockVacations
      .filter((item) => item.status === statusFilter)
      .map((item) => {
        const author = mockEmployees.find((emp) => emp.userId === item.userId)
        return {
          ...item,
          authorName: author?.name ?? "Сотрудник",
          authorDepartment: author?.department ?? null,
        }
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  async updateAdminVacation(
    id: string,
    payload: VacationAdminUpdatePayload & { approvedBy: string }
  ): Promise<VacationItem> {
    await delay(20)
    const index = mockVacations.findIndex((item) => item.id === id)
    if (index === -1) throw new Error("Заявка на отпуск не найдена")
    const current = mockVacations[index]
    const next: VacationItem = {
      ...current,
      status: payload.status,
      comment:
        payload.comment !== undefined && payload.comment !== null ? payload.comment : current.comment,
      approvedBy: payload.approvedBy,
    }
    mockVacations[index] = next
    return { ...next }
  },

  async listEventsForMonth(query: EventsMonthQuery): Promise<EventsListResponse> {
    await delay(20)
    const [yearStr, monthStr] = query.month.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr)
    const categoryFilter = query.category && query.category !== "all" ? query.category : null
    const includeBirthdays = !categoryFilter || categoryFilter === "birthday"
    const includeStored = !categoryFilter || categoryFilter !== "birthday"

    const items: CalendarEvent[] = []

    if (includeStored) {
      for (const event of mockEvents) {
        const startDate = new Date(event.startAt)
        if (
          startDate.getUTCFullYear() === year &&
          startDate.getUTCMonth() === month - 1 &&
          (!categoryFilter || event.category === categoryFilter)
        ) {
          items.push({ ...event })
        }
      }
    }

    if (includeBirthdays) {
      for (const employee of mockEmployees) {
        if (!employee.birthDate) continue
        const birth = new Date(employee.birthDate)
        if (Number.isNaN(birth.getTime())) continue
        if (birth.getUTCMonth() + 1 !== month) continue
        const day = birth.getUTCDate()
        const startAt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
        items.push({
          id: `birthday-${employee.userId}-${startAt.toISOString().slice(0, 10)}`,
          title: `День рождения: ${employee.name}`,
          description: null,
          startAt: startAt.toISOString(),
          endAt: null,
          location: null,
          category: "birthday",
          isAllDay: true,
          createdBy: null,
          createdAt: startAt.toISOString(),
          isVirtual: true,
        })
      }
    }

    items.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0))
    return { items, month: query.month }
  },

  async createEvent(payload: EventCreatePayload & { createdBy: string }): Promise<CalendarEvent> {
    await delay(30)
    const now = new Date().toISOString()
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `event-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e6).toString(16)}`
    const event: CalendarEvent = {
      id,
      title: payload.title,
      description: payload.description ?? null,
      startAt: new Date(payload.startAt).toISOString(),
      endAt: payload.endAt ? new Date(payload.endAt).toISOString() : null,
      location: payload.location ?? null,
      category: payload.category,
      isAllDay: payload.isAllDay ?? false,
      createdBy: payload.createdBy,
      createdAt: now,
      isVirtual: false,
    }
    mockEvents.push(event)
    return { ...event }
  },

  async deleteEvent(id: string): Promise<void> {
    await delay(20)
    if (id.startsWith("birthday-")) {
      const error = new Error("Дни рождения нельзя удалить — они формируются автоматически") as Error & {
        status: number
        code: string
      }
      error.status = 400
      error.code = "INVALID_PAYLOAD"
      throw error
    }
    const index = mockEvents.findIndex((event) => event.id === id)
    if (index !== -1) mockEvents.splice(index, 1)
  },

  async listKnowledgeArticles(
    query?: KnowledgeListQuery,
    includeDrafts = false
  ): Promise<KnowledgeListResponse> {
    await delay(20)
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const search = query?.search?.trim().toLowerCase() ?? ""
    const filterCategory =
      query?.category && query.category !== "all" ? query.category : undefined

    const filtered = mockKnowledgeArticles
      .filter((article) => (includeDrafts ? true : article.isPublished))
      .filter((article) => (filterCategory ? article.category === filterCategory : true))
      .filter((article) =>
        search
          ? article.title.toLowerCase().includes(search) ||
            article.content.toLowerCase().includes(search)
          : true
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

    const start = (page - 1) * limit
    return {
      items: filtered.slice(start, start + limit).map((item) => ({ ...item })),
      total: filtered.length,
      page,
      limit,
    }
  },

  async getKnowledgeArticleById(
    id: string,
    includeDrafts = false
  ): Promise<KnowledgeDetailResponse> {
    await delay(20)
    const article = mockKnowledgeArticles.find((item) => item.id === id)
    if (!article) return { item: null }
    if (!includeDrafts && !article.isPublished) return { item: null }
    return { item: { ...article } }
  },

  async incrementKnowledgeArticleViews(id: string): Promise<void> {
    await delay(10)
    const article = mockKnowledgeArticles.find((item) => item.id === id)
    if (article) {
      article.viewsCount += 1
    }
  },

  async createKnowledgeArticle(
    payload: KnowledgeEditorPayload & { authorId: string }
  ): Promise<KnowledgeArticle> {
    await delay(20)
    const now = new Date().toISOString()
    const article: KnowledgeArticle = {
      id: `kb-${Date.now()}`,
      title: payload.title,
      content: payload.content,
      category: payload.category,
      tags: (payload.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      authorId: payload.authorId,
      authorName: "Мок Автор",
      isPublished: payload.isPublished ?? false,
      viewsCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    mockKnowledgeArticles.push(article)
    return { ...article }
  },

  async updateKnowledgeArticle(
    id: string,
    payload: KnowledgeEditorPayload
  ): Promise<KnowledgeArticle> {
    await delay(20)
    const article = mockKnowledgeArticles.find((item) => item.id === id)
    if (!article) {
      throw new Error("Статья базы знаний не найдена")
    }
    article.title = payload.title
    article.content = payload.content
    article.category = payload.category
    article.tags = (payload.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    article.isPublished = payload.isPublished ?? false
    article.updatedAt = new Date().toISOString()
    return { ...article }
  },

  async deleteKnowledgeArticle(id: string): Promise<void> {
    await delay(20)
    const index = mockKnowledgeArticles.findIndex((item) => item.id === id)
    if (index !== -1) mockKnowledgeArticles.splice(index, 1)
  },

  async listAdminDepartments(): Promise<AdminDepartmentsResponse> {
    await delay(20)
    const items = mockDepartments
      .map((dept) => buildAdminDepartmentItem(dept))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    return { items }
  },

  async getAdminDepartmentById(id: string): Promise<{ item: AdminDepartmentItem | null }> {
    await delay(20)
    const dept = mockDepartments.find((d) => d.id === id)
    return { item: dept ? buildAdminDepartmentItem(dept) : null }
  },

  async createDepartment(
    payload: AdminDepartmentUpsertPayload
  ): Promise<AdminDepartmentItem> {
    await delay(20)
    const trimmedName = payload.name.trim()
    const duplicate = mockDepartments.find(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      throw createDepartmentMutationError(
        "Подразделение с таким названием уже существует",
        "DUPLICATE_NAME"
      )
    }
    const dept: MockDepartment = {
      id: `mock-dept-${Date.now()}`,
      name: trimmedName,
      code: payload.code ?? null,
      description: payload.description ?? null,
      parentId: payload.parentId ?? null,
      headUserId: payload.headUserId ?? null,
      contactEmail: payload.contactEmail ?? null,
    }
    mockDepartments.push(dept)
    return buildAdminDepartmentItem(dept)
  },

  async updateDepartment(
    id: string,
    payload: AdminDepartmentUpsertPayload
  ): Promise<AdminDepartmentItem> {
    await delay(20)
    if (payload.parentId && payload.parentId === id) {
      throw createDepartmentMutationError(
        "Подразделение не может быть родителем самому себе",
        "INVALID_PARENT"
      )
    }
    const trimmedName = payload.name.trim()
    const duplicate = mockDepartments.find(
      (d) => d.id !== id && d.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      throw createDepartmentMutationError(
        "Подразделение с таким названием уже существует",
        "DUPLICATE_NAME"
      )
    }
    const dept = mockDepartments.find((d) => d.id === id)
    if (!dept) {
      throw createDepartmentMutationError("Подразделение не найдено", "NOT_FOUND")
    }
    dept.name = trimmedName
    dept.code = payload.code ?? null
    dept.description = payload.description ?? null
    dept.parentId = payload.parentId ?? null
    dept.headUserId = payload.headUserId ?? null
    dept.contactEmail = payload.contactEmail ?? null
    return buildAdminDepartmentItem(dept)
  },

  async deleteDepartment(id: string): Promise<void> {
    await delay(20)
    const hasChildren = mockDepartments.some((d) => d.parentId === id)
    if (hasChildren) {
      throw createDepartmentMutationError(
        "Нельзя удалить подразделение с дочерними подразделениями.",
        "HAS_CHILDREN"
      )
    }
    const dept = mockDepartments.find((d) => d.id === id)
    if (dept) {
      const hasEmployees = mockEmployees.some((emp) => emp.department === dept.name)
      if (hasEmployees) {
        throw createDepartmentMutationError(
          "Нельзя удалить подразделение с сотрудниками. Сначала переведите их.",
          "HAS_EMPLOYEES"
        )
      }
    }
    const index = mockDepartments.findIndex((d) => d.id === id)
    if (index !== -1) mockDepartments.splice(index, 1)
  },

  async listAdminPortalUsers(): Promise<AdminPortalUsersResponse> {
    await delay()
    return { items: mockPortalUsers.map((u) => ({ ...u })) }
  },

  async getAdminPortalUserById(id: string): Promise<AdminPortalUserItem | null> {
    await delay()
    const item = mockPortalUsers.find((u) => u.id === id)
    return item ? { ...item } : null
  },

  async createAdminPortalUser(payload: AdminPortalUserCreatePayload): Promise<AdminPortalUserItem> {
    await delay()
    const email = payload.email.trim().toLowerCase()
    if (mockPortalUsers.some((u) => u.email.toLowerCase() === email)) {
      const err = new Error("Пользователь с таким email уже существует") as Error & {
        status: number
        code: string
      }
      err.status = 409
      err.code = "CONFLICT"
      throw err
    }
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `mock-user-${Date.now()}`
    const deptName = payload.departmentId
      ? mockDepartments.find((d) => d.id === payload.departmentId)?.name ?? null
      : null
    const now = new Date().toISOString()
    const item: AdminPortalUserItem = {
      id,
      email,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      role: payload.role,
      isActive: true,
      departmentName: deptName,
      createdAt: now,
      lastLoginAt: null,
    }
    mockPortalUsers.push(item)
    return { ...item }
  },

  async updateAdminPortalUserRole(id: string, role: UserRole): Promise<AdminPortalUserItem> {
    await delay()
    const index = mockPortalUsers.findIndex((u) => u.id === id)
    if (index === -1) {
      const err = new Error("Пользователь не найден") as Error & { status: number; code: string }
      err.status = 404
      err.code = "NOT_FOUND"
      throw err
    }
    mockPortalUsers[index] = { ...mockPortalUsers[index], role }
    return { ...mockPortalUsers[index] }
  },

  async updateAdminPortalUserCredentials(
    id: string,
    payload: { email?: string; password?: string }
  ): Promise<AdminPortalUserItem> {
    await delay()
    const index = mockPortalUsers.findIndex((u) => u.id === id)
    if (index === -1) {
      const err = new Error("Пользователь не найден") as Error & { status: number; code: string }
      err.status = 404
      err.code = "NOT_FOUND"
      throw err
    }
    const current = mockPortalUsers[index]
    if (payload.email !== undefined && payload.email.length > 0) {
      const nextEmail = payload.email.trim().toLowerCase()
      if (nextEmail !== current.email && mockPortalUsers.some((u) => u.email.toLowerCase() === nextEmail)) {
        const err = new Error("Пользователь с таким email уже существует") as Error & {
          status: number
          code: string
        }
        err.status = 409
        err.code = "CONFLICT"
        throw err
      }
      if (nextEmail !== current.email) {
        mockPortalUsers[index] = { ...current, email: nextEmail }
      }
    }
    if (payload.password !== undefined && payload.password.length > 0) {
      mockPortalUsers[index] = { ...mockPortalUsers[index] }
    }
    return { ...mockPortalUsers[index] }
  },

  async updateAdminPortalUserStatus(id: string, isActive: boolean): Promise<AdminPortalUserItem> {
    await delay()
    const index = mockPortalUsers.findIndex((u) => u.id === id)
    if (index === -1) {
      const err = new Error("Пользователь не найден") as Error & { status: number; code: string }
      err.status = 404
      err.code = "NOT_FOUND"
      throw err
    }
    mockPortalUsers[index] = { ...mockPortalUsers[index], isActive }
    return { ...mockPortalUsers[index] }
  },

  async deleteAdminPortalUser(id: string): Promise<void> {
    await delay()
    const index = mockPortalUsers.findIndex((u) => u.id === id)
    if (index === -1) {
      const err = new Error("Пользователь не найден") as Error & { status: number; code: string }
      err.status = 404
      err.code = "NOT_FOUND"
      throw err
    }
    mockPortalUsers.splice(index, 1)
  },
}

function buildAdminDepartmentItem(dept: MockDepartment): AdminDepartmentItem {
  const parent = dept.parentId
    ? mockDepartments.find((d) => d.id === dept.parentId)
    : null
  const head = dept.headUserId
    ? mockEmployees.find((emp) => emp.userId === dept.headUserId)
    : null
  const employeeCount = mockEmployees.filter((emp) => emp.department === dept.name).length
  return {
    id: dept.id,
    name: dept.name,
    code: dept.code ?? null,
    description: dept.description ?? null,
    parentId: dept.parentId ?? null,
    parentName: parent?.name ?? null,
    headUserId: dept.headUserId ?? null,
    headName: head?.name ?? null,
    contactEmail: dept.contactEmail ?? null,
    employeeCount,
  }
}

function createDepartmentMutationError(message: string, code: string): Error & {
  status: number
  code: string
} {
  const error = new Error(message) as Error & { status: number; code: string }
  error.status = 400
  error.code = code
  return error
}

const mockEvents: CalendarEvent[] = []

const mockTickets: Ticket[] = []

const mockVacations: VacationItem[] = []

const mockKnowledgeArticles: KnowledgeArticle[] = [
  {
    id: "kb-welcome",
    title: "Добро пожаловать в базу знаний",
    content:
      "## Зачем нужна база знаний\n\nЗдесь собраны инструкции, регламенты и подсказки для повседневной работы. Используйте поиск или категории слева, чтобы быстро найти нужную статью.",
    category: "general",
    tags: ["введение", "обзор"],
    authorId: null,
    authorName: "Редакция портала",
    isPublished: true,
    viewsCount: 0,
    createdAt: "2026-04-01T08:00:00.000Z",
    updatedAt: "2026-04-01T08:00:00.000Z",
  },
  {
    id: "kb-it-vpn",
    title: "Как подключиться к корпоративному VPN",
    content:
      "## Пошаговая инструкция\n\n1. Откройте клиент VPN.\n2. Введите логин из корпоративной почты.\n3. Подтвердите вход по второму фактору.\n\nЕсли возникли сложности — напишите в службу поддержки через раздел «Заявки».",
    category: "it",
    tags: ["vpn", "удалённая работа", "ит"],
    authorId: null,
    authorName: "Служба ИТ",
    isPublished: true,
    viewsCount: 0,
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-10T08:00:00.000Z",
  },
]

function paginateTickets(list: Ticket[], query?: TicketsQuery): TicketsListResponse {
  const page = query?.page ?? 1
  const limit = query?.limit ?? 20
  const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const start = (page - 1) * limit
  return {
    items: sorted.slice(start, start + limit),
    total: sorted.length,
    page,
    limit,
  }
}
