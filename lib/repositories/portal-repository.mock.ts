import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import {
  mapContactsData,
  mapDashboardData,
  mapDocumentsData,
  mapProfileData,
  mapSidebarItems,
} from "@/lib/mappers/portal"
import type {
  DocumentMetadataCreatePayload,
  EmployeesQuery,
  DocumentsQuery,
  ProfileData,
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
    tabs: [
      { id: "tasks", label: "Задачи", icon: "CheckCircle" },
      { id: "vacation", label: "Отпуск", icon: "Calendar" },
      { id: "evaluations", label: "Оценки", icon: "Award" },
      { id: "kpi", label: "KPI / РМТО", icon: "Wallet" },
      { id: "payslips", label: "Расчётные листы", icon: "FileText" },
    ],
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
      { id: 1, start: "15.06.2024", end: "28.06.2024", days: 14, status: "approved", type: "Ежегодный" },
      { id: 2, start: "23.12.2024", end: "08.01.2025", days: 14, status: "pending", type: "Ежегодный" },
    ],
    payslips: ["Апрель 2024", "Март 2024", "Февраль 2024", "Январь 2024"],
  }
}

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
          id: 1,
          title: "Запущен новый проект по модернизации контактной сети в Казани",
          date: "2 дня назад",
          category: "Проект",
          isUrgent: false,
        },
        {
          id: 2,
          title: "Плановое техническое обслуживание корпоративных систем 15-17 мая",
          date: "5 дней назад",
          category: "Объявление",
          isUrgent: true,
        },
        {
          id: 3,
          title: "Результаты квартального совещания руководителей подразделений",
          date: "1 неделю назад",
          category: "Отчёт",
          isUrgent: false,
        },
        {
          id: 4,
          title: "Приглашение на корпоративный праздник День энергетика",
          date: "1 неделю назад",
          category: "Событие",
          isUrgent: false,
        },
      ],
      todayBirthdays: [
        { name: "Мария Иванова", department: "СНАРК | Проект", avatar: "МИ" },
        { name: "Алексей Козлов", department: "СНАРК | Строй", avatar: "АК" },
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
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: `${payload.firstName} ${payload.lastName}`,
      initials: `${payload.firstName.charAt(0)}${payload.lastName.charAt(0)}`.toUpperCase(),
      phone: payload.phone ?? current.phone,
      avatarUrl: payload.avatarUrl ?? current.avatarUrl,
    }
    return mapProfileData(next)
  },

  async getSidebarItems() {
    await delay(20)
    return mapSidebarItems([
      { id: "dashboard", label: "Главная", icon: "LayoutDashboard", description: "Дашборд", href: "/dashboard" },
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
