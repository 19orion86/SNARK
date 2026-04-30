'use client'

import { useState } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera,
  CheckCircle,
  Calendar,
  Award,
  Wallet,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/use-profile'
import type { ProfileData } from '@/types/portal'

const tabIconMap = {
  CheckCircle,
  Calendar,
  Award,
  Wallet,
  FileText,
} as const

export function Profile({ data }: { data: ProfileData }) {
  const [activeTab, setActiveTab] = useState<ProfileData["tabs"][number]["id"]>('tasks')
  const [firstName, setFirstName] = useState(data.firstName ?? data.fullName.split(" ")[0] ?? "")
  const [lastName, setLastName] = useState(data.lastName ?? data.fullName.split(" ")[1] ?? "")
  const [phone, setPhone] = useState(data.phone ?? "")
  const [avatarUrl, setAvatarUrl] = useState(data.avatarUrl ?? "")
  const [saving, setSaving] = useState(false)
  const { update, error: profileError } = useProfile()

  const handleSaveProfile = async () => {
    setSaving(true)
    await update({
      firstName,
      lastName,
      phone: phone || undefined,
      avatarUrl: avatarUrl || undefined,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-secondary p-6 md:p-8">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white md:h-24 md:w-24">
                {data.initials}
              </div>
              <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-110">
                <Camera className="h-4 w-4" />
              </button>
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-success">
                <span className="sr-only">В офисе</span>
              </div>
            </div>

            {/* Info */}
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-white">{data.fullName}</h1>
              <p className="text-white/80">{data.roleTitle}</p>
              <p className="text-sm text-white/60">{data.department}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-white/70 md:justify-start">
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {data.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {data.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {data.office}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <div className="md:ml-auto">
              <span className="inline-flex items-center gap-2 rounded-full bg-success/20 px-4 py-2 text-sm font-medium text-white">
                <span className="h-2 w-2 rounded-full bg-success" />
                {data.presence === 'office' ? 'В офисе' : data.presence === 'away' ? 'Отошёл' : 'Не в сети'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-border">
          {data.tabs.map((tab) => {
            const Icon = tabIconMap[tab.icon as keyof typeof tabIconMap] ?? CheckCircle
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="mb-4 font-bold text-card-foreground">Редактирование профиля</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Имя" />
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Фамилия" />
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Телефон" />
          <Input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="URL аватара"
          />
        </div>
        {profileError && <p className="mt-3 text-sm text-destructive">{profileError}</p>}
        <Button type="button" className="mt-4" onClick={handleSaveProfile} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить профиль"}
        </Button>
      </Card>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="font-bold text-card-foreground">Мои задачи</h2>
          </div>
          <div className="divide-y divide-border">
            {data.tasks.map((task) => (
              <button
                key={task.id}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
              >
                <CheckCircle className={cn(
                  'h-5 w-5 shrink-0',
                  task.priority === 'high' ? 'text-destructive' :
                  task.priority === 'medium' ? 'text-accent' : 'text-muted-foreground'
                )} />
                <div className="flex-1">
                  <p className="font-medium text-card-foreground">{task.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{task.system}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.deadline}
                    </span>
                  </div>
                </div>
                <span className={cn(
                  'rounded-full px-2 py-1 text-xs font-medium',
                  task.status === 'В работе' ? 'bg-accent/10 text-accent' :
                  task.status === 'Новая' ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'
                )}>
                  {task.status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'vacation' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-card-foreground">Мои отпуска</h2>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  Запланировать отпуск
                </button>
              </div>
              <div className="space-y-3">
                {data.vacations.map((vacation) => (
                  <div
                    key={vacation.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-4',
                      vacation.status === 'approved' ? 'border-success/30 bg-success/5' : 'border-accent/30 bg-accent/5'
                    )}
                  >
                    <div>
                      <p className="font-medium text-card-foreground">
                        {vacation.start} — {vacation.end}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vacation.type} ({vacation.days} дней)
                      </p>
                    </div>
                    <span className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      vacation.status === 'approved' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                    )}>
                      {vacation.status === 'approved' ? 'Утверждён' : 'На согласовании'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card className="p-6">
            <h3 className="mb-4 font-bold text-card-foreground">Остаток дней</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Доступно</p>
                <p className="text-3xl font-bold text-success">14 дней</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Запланировано</p>
                <p className="text-xl font-bold text-accent">28 дней</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Использовано</p>
                <p className="text-xl font-bold text-muted-foreground">0 дней</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'evaluations' && (
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-card-foreground">Оценки руководителя</h2>
          <div className="rounded-lg border border-border p-8 text-center">
            <Award className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Оценки за текущий период ещё не выставлены</p>
          </div>
        </Card>
      )}

      {activeTab === 'kpi' && (
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-card-foreground">KPI / РМТО</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-success/10 p-4">
              <p className="text-sm text-muted-foreground">Баланс баллов</p>
              <p className="text-3xl font-bold text-success">1,250</p>
            </div>
            <div className="rounded-lg bg-accent/10 p-4">
              <p className="text-sm text-muted-foreground">Начислено за месяц</p>
              <p className="text-3xl font-bold text-accent">+350</p>
            </div>
            <div className="rounded-lg bg-secondary/10 p-4">
              <p className="text-sm text-muted-foreground">Использовано</p>
              <p className="text-3xl font-bold text-secondary">-100</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'payslips' && (
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="font-bold text-card-foreground">Расчётные листы</h2>
          </div>
          <div className="divide-y divide-border">
            {data.payslips.map((month) => (
              <div key={month} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-secondary" />
                  <span className="font-medium text-card-foreground">{month}</span>
                </div>
                <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted">
                  Скачать PDF
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
