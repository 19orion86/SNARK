import Link from "next/link"
import type { DashboardData } from "@/types/portal"
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  DoorOpen,
  FileText,
  HelpCircle,
  Newspaper,
  Pin,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { BirthdayWidget } from "@/components/widgets/BirthdayWidget"
import { NewEmployeesWidget } from "@/components/widgets/NewEmployeesWidget"

const iconMap = {
  Users,
  FileText,
  Calendar,
  HelpCircle,
  BookOpen,
  Newspaper,
  DoorOpen,
} as const

const NEWS_CATEGORY_LABELS: Record<string, string> = {
  company: "Компания",
  projects: "Проекты",
  people: "Люди",
  important: "Важно",
}

function newsCategoryLabel(category: string): string {
  return NEWS_CATEGORY_LABELS[category] ?? category
}

function formatNewsDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU")
}

export function Dashboard({ data }: { data: DashboardData }) {
  const now = new Date()
  const currentDate = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const hour = now.getHours()
  const greeting =
    hour < 6 ? 'Доброй ночи' :
    hour < 12 ? 'Доброе утро' :
    hour < 18 ? 'Добрый день' : 'Добрый вечер'

  const pinnedHero = data.recentNews.find((n) => n.isPinned) ?? null
  const restNews = pinnedHero
    ? data.recentNews.filter((n) => n.id !== pinnedHero.id)
    : data.recentNews

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
            {data.welcomeName ? `${greeting}, ${data.welcomeName}!` : `${greeting}!`}
          </h1>
          <p className="mt-2 text-white/70">{currentDate}</p>
          {data.birthdays.today.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <span aria-hidden="true">🎂</span>
              <span>
                Сегодня день рождения: {data.birthdays.today.map((b) => b.name).join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {data.quickActions.map((action) => {
          const Icon = iconMap[action.icon as keyof typeof iconMap] ?? Users
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col items-center gap-3 rounded-xl bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-center text-sm font-medium text-card-foreground">
                {action.label}
              </span>
            </Link>
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

            {data.recentNews.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Newspaper className="mb-2 h-10 w-10 opacity-40" aria-hidden="true" />
                <p className="text-sm">Пока нет опубликованных новостей</p>
              </div>
            ) : (
              <>
                {pinnedHero && (
                  <Link
                    href={`/news/${pinnedHero.id}`}
                    className="block border-b border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#16223b] to-[#28367b]">
                        <Newspaper className="h-7 w-7 text-white opacity-40" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          <Pin className="h-3 w-3" aria-hidden="true" />
                          Важно
                        </span>
                        <h3 className="mt-2 font-semibold text-card-foreground line-clamp-2">
                          {pinnedHero.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatNewsDate(pinnedHero.publishedAt ?? pinnedHero.createdAt)}</span>
                          <span>{newsCategoryLabel(pinnedHero.category)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                )}

                <div className="divide-y divide-border">
                  {restNews.map((news) => (
                    <Link
                      key={news.id}
                      href={`/news/${news.id}`}
                      className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#16223b] to-[#28367b]">
                        <Newspaper className="h-6 w-6 text-white opacity-40" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-card-foreground line-clamp-2">
                          {news.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatNewsDate(news.publishedAt ?? news.createdAt)}
                          </span>
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                            {newsCategoryLabel(news.category)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-border p-4">
              <Link
                href="/news"
                className="block w-full rounded-lg border border-border py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                Все новости
              </Link>
            </div>
          </Card>
        </div>

        {/* Sidebar - 1/3 width */}
        <div className="space-y-6">
          {/* Birthdays */}
          <BirthdayWidget data={data.birthdays} />

          {/* New Employees */}
          <NewEmployeesWidget items={data.newEmployees} />

          {/* My Tasks */}
          <Card className="p-4">
            <h3 className="mb-4 font-bold text-card-foreground">Мои задачи</h3>
            <div className="space-y-3">
              {data.myTasks.map((task, i) => (
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
        {data.serviceCards.map((service) => {
          const Icon = iconMap[service.icon as keyof typeof iconMap] ?? Users
          return (
            <Link
              key={service.title}
              href={service.href}
              className="group relative overflow-hidden rounded-xl bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-4 inline-flex rounded-lg p-3 ${service.color} text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-card-foreground">{service.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
