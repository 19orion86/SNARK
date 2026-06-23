'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Mail, Phone } from 'lucide-react'
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
import { EmployeeAvatar } from '@/components/employees/employee-avatar'
import { AvatarUploadField } from '@/components/profile/avatar-upload-field'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/use-profile'
import { VacationTab } from '@/components/profile/vacation-tab'
import type { CurrentUserResponse, ProfileData } from '@/types/portal'

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
  const { data: profileData, update, refetch, applyProfile, error: profileError } = useProfile()
  const display = profileData ?? data

  const [phone, setPhone] = useState(display.phone ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [status, setStatus] = useState<'office' | 'remote' | 'vacation'>(display.presence)
  const [saving, setSaving] = useState(false)
  const [presenceSaving, setPresenceSaving] = useState(false)
  const [presenceError, setPresenceError] = useState<string | null>(null)

  useEffect(() => {
    setPhone(display.phone ?? '')
    setStatus(display.presence)
  }, [display.phone, display.presence])

  useEffect(() => {
    if (!sheetOpen) {
      setAvatarFile(null)
      setUploadError(null)
    }
  }, [sheetOpen])

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
    setUploadError(null)

    let uploadedAvatar = false

    if (avatarFile) {
      try {
        const formData = new FormData()
        formData.append('file', avatarFile)
        const response = await fetch('/api/users/me/avatar', {
          method: 'POST',
          body: formData,
        })
        const body = (await response.json().catch(() => ({}))) as CurrentUserResponse & { error?: string }
        if (!response.ok) {
          setUploadError(body.error ?? 'Не удалось загрузить фото')
          setSaving(false)
          return
        }
        if (body.profile) {
          applyProfile(body.profile)
        }
        uploadedAvatar = true
        setAvatarFile(null)
      } catch {
        setUploadError('Сетевая ошибка при загрузке фото')
        setSaving(false)
        return
      }
    }

    const phoneChanged = phone !== (display.phone ?? '')
    if (phoneChanged) {
      const ok = await update({
        phone: phone || undefined,
      })
      if (!ok) {
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setSheetOpen(false)

    if (!uploadedAvatar && !phoneChanged) {
      await refetch()
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center p-6 text-center">
        <EmployeeAvatar
          name={display.fullName}
          initials={display.initials}
          avatarUrl={display.avatarUrl}
          className="h-20 w-20 text-lg"
          imageClassName="h-20 w-20"
        />
        <h1 className="mt-4 text-2xl font-bold text-card-foreground">{display.fullName}</h1>
        <p className="mt-1 text-muted-foreground">{display.roleTitle}</p>
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
            <p><strong>ФИО:</strong> {display.fullName}</p>
            <p><strong>Должность:</strong> {display.positionTitle ?? display.roleTitle}</p>
            <p><strong>Отдел:</strong> {display.department}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {display.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {display.email}</p>
          </div>

          <Button type="button" variant="outline" onClick={() => setSheetOpen(true)}>
            Редактировать
          </Button>
        </Card>
      )}

      {activeTab === 'my_department' && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold text-card-foreground">Моё подразделение</h2>
          <p className="text-sm"><strong>Отдел:</strong> {display.departmentTab?.departmentName ?? display.department}</p>
          {display.departmentTab?.manager ? (
            <p className="text-sm">
              <strong>Руководитель:</strong>{' '}
              <Link href={`/contacts?search=${encodeURIComponent(display.departmentTab.manager.fullName)}`} className="text-primary hover:underline">
                {display.departmentTab.manager.fullName}
              </Link>
            </p>
          ) : null}

          {display.departmentTab?.regulationsDoc && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Регламент подразделения</p>
              <iframe
                title="Превью регламента"
                src={`/api/documents/preview/${display.departmentTab.regulationsDoc.id}`}
                className="h-56 w-full rounded border"
              />
              {display.departmentTab.regulationsDoc.downloadUrl && (
                <a href={display.departmentTab.regulationsDoc.downloadUrl} className="text-sm text-primary hover:underline">
                  Скачать
                </a>
              )}
            </div>
          )}

          {display.departmentTab?.standardsDoc && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Стандарт подразделения</p>
              <iframe
                title="Превью стандарта"
                src={`/api/documents/preview/${display.departmentTab.standardsDoc.id}`}
                className="h-56 w-full rounded border"
              />
              {display.departmentTab.standardsDoc.downloadUrl && (
                <a href={display.departmentTab.standardsDoc.downloadUrl} className="text-sm text-primary hover:underline">
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
          {display.documentsTab?.jobInstruction ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{display.documentsTab.jobInstruction.title}</p>
              <iframe
                title="Должностная инструкция"
                src={`/api/documents/preview/${display.documentsTab.jobInstruction.id}`}
                className="h-72 w-full rounded border"
              />
              {display.documentsTab.jobInstruction.downloadUrl && (
                <a href={display.documentsTab.jobInstruction.downloadUrl} className="text-sm text-primary hover:underline">
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
        <VacationTab
          presenceLabel={statusButtons.find((item) => item.value === status)?.label ?? 'В офисе'}
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Редактирование профиля</SheetTitle>
            <SheetDescription>Вы можете изменить только фото и телефон.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <AvatarUploadField
              name={display.fullName}
              initials={display.initials}
              currentAvatarUrl={display.avatarUrl}
              file={avatarFile}
              onFileChange={setAvatarFile}
              error={uploadError}
            />
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
