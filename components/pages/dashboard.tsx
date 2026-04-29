import {
  TrendingUp,
  Users,
  FileText,
  Calendar,
  Bell,
  CheckCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

const stats = [
  {
    label: 'Всего сотрудников',
    value: '247',
    icon: Users,
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Активные задачи',
    value: '12',
    icon: CheckCircle,
    color: 'bg-accent/10 text-accent',
  },
  {
    label: 'Документов',
    value: '1,243',
    icon: FileText,
    color: 'bg-secondary/10 text-secondary',
  },
  {
    label: 'События',
    value: '8',
    icon: Calendar,
    color: 'bg-orange-500/10 text-orange-600',
  },
]

const recentNews = [
  {
    id: 1,
    title: 'Запущен новый проект по модернизации электротранспорта',
    date: '2 дня назад',
    category: 'Новость',
  },
  {
    id: 2,
    title: 'Плановое техническое обслуживание систем 15-17 мая',
    date: '5 дней назад',
    category: 'Объявление',
  },
  {
    id: 3,
    title: 'Результаты квартального совещания руководителей',
    date: '1 неделю назад',
    category: 'Отчёт',
  },
  {
    id: 4,
    title: 'Приглашение на корпоративный праздник 20 мая',
    date: '1 неделю назад',
    category: 'Событие',
  },
]

const upcomingEvents = [
  {
    id: 1,
    title: 'Планёрка IT-отдела',
    time: '10:00 - 11:00',
    location: 'Конференц-зал А',
  },
  {
    id: 2,
    title: 'Презентация квартального отчёта',
    time: '14:00 - 15:30',
    location: 'Аудитория 1',
  },
  {
    id: 3,
    title: 'Встреча с клиентом',
    time: '16:00 - 17:00',
    location: 'Офис',
  },
]

export function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Добро пожаловать в СНАРК
        </h1>
        <p className="mt-2 text-muted-foreground">
          Корпоративный портал интегратора инфраструктуры городского электротранспорта
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 font-heading text-3xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent News */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-primary">
                Последние новости
              </h2>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-4">
              {recentNews.map((news) => (
                <div
                  key={news.id}
                  className="border-b border-border pb-4 last:border-b-0 hover:bg-muted/30 rounded-lg p-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">
                        {news.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {news.date}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                      {news.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button className="mt-6 w-full rounded-lg border border-border py-2 font-medium text-primary hover:bg-muted transition-colors">
              Посмотреть все новости
            </button>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <Card className="p-6">
            <h2 className="mb-6 font-heading text-xl font-bold text-primary">
              Предстоящие события
            </h2>

            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-l-4 border-accent bg-accent/5 p-4 rounded-r-lg hover:bg-accent/10 transition-colors cursor-pointer"
                >
                  <h3 className="font-medium text-foreground">
                    {event.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    🕐 {event.time}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    📍 {event.location}
                  </p>
                </div>
              ))}
            </div>

            <button className="mt-6 w-full rounded-lg border border-border py-2 font-medium text-primary hover:bg-muted transition-colors">
              Календарь событий
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
