'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Building2, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/use-profile'
import type { ProfileData } from '@/types/portal'

type ProfileTabId = 'my_profile' | 'my_department' | 'documents' | 'vacation'

const tabs: Array<{ id: ProfileTabId; label: string }> = [
  { id: 'my_profile', label: 'Мой профиль' },
  { id: 'my_department', label: 'Моё подразделение' },
  { id: 'documents', label: 'Документы' },
  { id: 'vacation', label: 'Отпуск' },
]

export function Profile({ data }: { data: ProfileData }) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>('my_profile')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [phone, setPhone] = useState(data.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(data.avatarUrl ?? '')
  const [status, setStatus] = useState<'office' | 'remote' | 'vacation'>(data.presence)
  const [saving, setSaving] = useState(false)
  const [presenceSaving, setPresenceSaving] = useState(false)
  const [presenceError, setPresenceError] = useState<string | null>(null)
  const { update, refetch, error: profileError } = useProfile()

  const statusButtons = useMemo(
    () => [
      { value: 'office' as const, label: 'В офисе' },
      { value: 'remote' as const, label: 'На удалёнке' },
      { value: 'vacation' as const, label: 'В отпуске' },
    ],
    []
  )

  const updatePresence = async (next: 'office' | 'remote' | 'vacation') => {
    setPresenceSaving(true)
    setPresenceError(null)
    try {
      const response = await fetch('/api/users/me/presence', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ presence: next }),
      })
      if (!response.ok) {
        throw new Error('PRESENCE_UPDATE_FAILED')
      }
      setStatus(next)
      await refetch()
    } catch {
      setPresenceError('Не удалось обновить статус присутствия')
    } finally {
      setPresenceSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    await update({
      phone: phone || undefined,
      avatarUrl: avatarUrl || undefined,
    })
    setSaving(false)
    setSheetOpen(false)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground">{data.fullName}</h1>
        <p className="mt-1 text-muted-foreground">{data.roleTitle}</p>
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors',
              activeTab === tab.id ? 'bg-[#16223b] text-white' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'my_profile' && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-semibold text-card-foreground">Статус</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusButtons.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={status === item.value ? 'default' : 'outline'}
                  className={status === item.value ? 'bg-[#16223b] hover:bg-[#16223b]/90' : ''}
                  disabled={presenceSaving}
                  onClick={() => void updatePresence(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            {presenceError && <p className="mt-2 text-sm text-destructive">{presenceError}</p>}
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>ФИО:</strong> {data.fullName}</p>
            <p><strong>Должность:</strong> {data.positionTitle ?? data.roleTitle}</p>
            <p><strong>Отдел:</strong> {data.department}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {data.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {data.email}</p>
          </div>

          <Button type="button" variant="outline" onClick={() => setSheetOpen(true)}>
            Редактировать
          </Button>
        </Card>
      )}

      {activeTab === 'my_department' && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold text-card-foreground">Моё подразделение</h2>
          <p className="text-sm"><strong>Отдел:</strong> {data.departmentTab?.departmentName ?? data.department}</p>
          {data.departmentTab?.manager ? (
            <p className="text-sm">
              <strong>Руководитель:</strong>{' '}
              <Link href={`/contacts?search=${encodeURIComponent(data.departmentTab.manager.fullName)}`} className="text-primary hover:underline">
                {data.departmentTab.manager.fullName}
              </Link>
            </p>
          ) : null}

          {data.departmentTab?.regulationsDoc && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Регламент подразделения</p>
              <iframe
                title="Превью регламента"
                src={`/api/documents/preview/${data.departmentTab.regulationsDoc.id}`}
                className="h-56 w-full rounded border"
              />
              {data.departmentTab.regulationsDoc.downloadUrl && (
                <a href={data.departmentTab.regulationsDoc.downloadUrl} className="text-sm text-primary hover:underline">
                  Скачать
                </a>
              )}
            </div>
          )}

          {data.departmentTab?.standardsDoc && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Стандарт подразделения</p>
              <iframe
                title="Превью стандарта"
                src={`/api/documents/preview/${data.departmentTab.standardsDoc.id}`}
                className="h-56 w-full rounded border"
              />
              {data.departmentTab.standardsDoc.downloadUrl && (
                <a href={data.departmentTab.standardsDoc.downloadUrl} className="text-sm text-primary hover:underline">
                  Скачать
                </a>
              )}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold text-card-foreground">Документы</h2>
          {data.documentsTab?.jobInstruction ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{data.documentsTab.jobInstruction.title}</p>
              <iframe
                title="Должностная инструкция"
                src={`/api/documents/preview/${data.documentsTab.jobInstruction.id}`}
                className="h-72 w-full rounded border"
              />
              {data.documentsTab.jobInstruction.downloadUrl && (
                <a href={data.documentsTab.jobInstruction.downloadUrl} className="text-sm text-primary hover:underline">
                  Скачать
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Документ ещё не загружен.
            </div>
          )}
        </Card>
      )}

      {activeTab === 'vacation' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Остаток дней</p>
            <p className="text-3xl font-bold text-card-foreground">{data.vacationTab?.daysRemaining ?? 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Следующий отпуск</p>
            <p className="text-sm font-medium text-card-foreground">
              {data.vacationTab?.nextVacation
                ? `${data.vacationTab.nextVacation.startDate} — ${data.vacationTab.nextVacation.endDate}`
                : 'Не запланирован'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Дней до отпуска: {data.vacationTab?.nextVacation ? data.vacationTab.nextVacation.daysUntil : '-'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Статус</p>
            <p className="mt-1 flex items-center gap-2 text-sm"><Building2 className="h-4 w-4" /> {statusButtons.find((item) => item.value === status)?.label}</p>
          </Card>

          <Card className="lg:col-span-3 p-4">
            <h3 className="mb-3 font-semibold text-card-foreground">История отпусков</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Период</TableHead>
                  <TableHead>Дней</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.vacationTab?.history ?? data.vacations).map((vacation) => (
                  <TableRow key={vacation.id}>
                    <TableCell>{vacation.startDate} — {vacation.endDate}</TableCell>
                    <TableCell>{vacation.daysTotal}</TableCell>
                    <TableCell>{vacation.status === 'approved' ? 'Утверждён' : 'На согласовании'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Редактирование профиля</SheetTitle>
            <SheetDescription>Вы можете изменить только фото и телефон.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Фото (URL)</Label>
              <Input id="avatarUrl" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              Отмена
            </Button>
            <Button type="button" className="bg-[#16223b] hover:bg-[#16223b]/90" onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
