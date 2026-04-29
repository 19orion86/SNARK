import {
  Users,
  FileText,
  Calendar,
  Bell,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Newspaper,
  DoorOpen,
  Cake,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

const quickActions = [
  { label: 'Создать заявку в ИТ', icon: HelpCircle, href: '/support/new' },
  { label: 'Забронировать переговорную', icon: DoorOpen, href: '/rooms' },
  { label: 'Новости компании', icon: Newspaper, href: '/culture/news' },
  { label: 'Найти сотрудника', icon: Users, href: '/contacts' },
  { label: 'Нормативная база', icon: FileText, href: '/documents' },
  { label: 'Электронная библиотека', icon: BookOpen, href: '/library' },
]

const recentNews = [
  {
    id: 1,
    title: 'Запущен новый проект по модернизации контактной сети в Казани',
    date: '2 дня назад',
    category: 'Проект',
    isUrgent: false,
  },
  {
    id: 2,
    title: 'Плановое техническое обслуживание корпоративных систем 15-17 мая',
    date: '5 дней назад',
    category: 'Объявление',
    isUrgent: true,
  },
  {
    id: 3,
    title: 'Результаты квартального совещания руководителей подразделений',
    date: '1 неделю назад',
    category: 'Отчёт',
    isUrgent: false,
  },
  {
    id: 4,
    title: 'Приглашение на корпоративный праздник День энергетика',
    date: '1 неделю назад',
    category: 'Событие',
    isUrgent: false,
  },
]

const todayBirthdays = [
  { name: 'Мария Иванова', department: 'СНАРК | Проект', avatar: 'МИ' },
  { name: 'Алексей Козлов', department: 'СНАРК | Строй', avatar: 'АК' },
]

const myTasks = [
  { title: 'Согласовать проектную документацию', deadline: 'Сегодня', priority: 'high' },
  { title: 'Подготовить отчёт за апрель', deadline: 'Завтра', priority: 'medium' },
  { title: 'Провести встречу с подрядчиком', deadline: '3 мая', priority: 'low' },
]

const serviceCards = [
  {
    title: 'Личный кабинет',
    description: 'Ваш профиль, задачи, отпуск, оценки',
    icon: Users,
    color: 'bg-secondary',
  },
  {
    title: 'Кадровые вопросы',
    description: 'Всё о работе в СНАРК',
    icon: FileText,
    color: 'bg-accent',
  },
  {
    title: 'Корп. культура',
    description: 'Мероприятия, фото, жизнь компании',
    icon: Calendar,
    color: 'bg-success',
  },
  {
    title: 'Нормативная база',
    description: 'Политики, регламенты, инструкции',
    icon: BookOpen,
    color: 'bg-destructive',
  },
]

export function Dashboard() {
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div 
        className="relative overflow-hidden rounded-xl p-6 md:p-8"
        style={{ background: 'linear-gradient(135deg, #16223b 0%, #28367b 100%)' }}
      >
        {/* Decorative lines */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 400 200">
            <path d="M0 100 Q 100 50, 200 100 T 400 100" stroke="#6f9ed4" strokeWidth="2" fill="none" />
            <path d="M0 150 Q 100 100, 200 150 T 400 150" stroke="#6f9ed4" strokeWidth="1" fill="none" />
            <path d="M0 50 Q 100 0, 200 50 T 400 50" stroke="#6f9ed4" strokeWidth="1" fill="none" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Добрый день, Иван!
          </h1>
          <p className="mt-2 text-white/70">{currentDate}</p>
          {todayBirthdays.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <Cake className="h-4 w-4" />
              <span>Сегодня день рождения: {todayBirthdays.map(b => b.name).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              className="group flex flex-col items-center gap-3 rounded-xl bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-center text-sm font-medium text-card-foreground">
                {action.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* News Feed - 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-bold text-card-foreground">
                Последние новости
              </h2>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="divide-y divide-border">
              {recentNews.map((news) => (
                <button
                  key={news.id}
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="h-16 w-24 shrink-0 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <h3 className="font-medium text-card-foreground line-clamp-2">
                      {news.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{news.date}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          news.isUrgent
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {news.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>

            <div className="border-t border-border p-4">
              <button className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted">
                Все новости
              </button>
            </div>
          </Card>
        </div>

        {/* Sidebar - 1/3 width */}
        <div className="space-y-6">
          {/* Today Block */}
          <Card className="p-4">
            <h3 className="mb-4 font-bold text-card-foreground">Сегодня</h3>
            
            {/* Birthdays */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Cake className="h-4 w-4" />
                <span>Именинники</span>
              </div>
              <div className="space-y-2">
                {todayBirthdays.map((person, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {person.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.department}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* My Tasks */}
          <Card className="p-4">
            <h3 className="mb-4 font-bold text-card-foreground">Мои задачи</h3>
            <div className="space-y-3">
              {myTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <CheckCircle className={`h-5 w-5 shrink-0 ${
                    task.priority === 'high' ? 'text-destructive' :
                    task.priority === 'medium' ? 'text-accent' : 'text-muted-foreground'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{task.title}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{task.deadline}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {serviceCards.map((service) => {
          const Icon = service.icon
          return (
            <button
              key={service.title}
              className="group relative overflow-hidden rounded-xl bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-4 inline-flex rounded-lg p-3 ${service.color} text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-card-foreground">{service.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
