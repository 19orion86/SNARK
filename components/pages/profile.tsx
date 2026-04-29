import { User, Mail, Phone, MapPin, Building, Edit, LogOut } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function Profile() {
  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Мой профиль
        </h1>
        <p className="mt-2 text-muted-foreground">
          Личные данные и настройки учётной записи
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="p-8">
            <div className="text-center">
              <div className="mx-auto h-24 w-24 rounded-full bg-secondary/20 flex items-center justify-center">
                <User className="h-12 w-12 text-secondary" />
              </div>

              <h2 className="mt-4 font-heading text-2xl font-bold text-foreground">
                Иван Смирнов
              </h2>
              <p className="mt-1 text-secondary">Ведущий инженер</p>
              <p className="text-sm text-muted-foreground">
                Инжиниринг
              </p>

              <div className="mt-6 space-y-2">
                <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                  <Edit className="h-4 w-4" />
                  Редактировать профиль
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/5 transition-colors">
                  <LogOut className="h-4 w-4" />
                  Выход
                </button>
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Статус</p>
                    <p className="mt-1 font-medium text-accent">
                      ● В сети
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">На работе с</p>
                    <p className="mt-1 font-medium text-foreground">
                      2020 года
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Information Sections */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact Information */}
          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary mb-4">
              Контактные данные
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Mail className="mt-1 h-5 w-5 text-secondary flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">
                    i.smirnov@snark.ru
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Phone className="mt-1 h-5 w-5 text-secondary flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Телефон</p>
                  <p className="font-medium text-foreground">
                    +7 (495) 123-45-69
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <MapPin className="mt-1 h-5 w-5 text-secondary flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Офис</p>
                  <p className="font-medium text-foreground">
                    Кабинет 310
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Work Information */}
          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary mb-4">
              Рабочая информация
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Должность</p>
                <p className="mt-2 font-medium text-foreground">
                  Ведущий инженер
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Отдел</p>
                <p className="mt-2 font-medium text-foreground">
                  Инжиниринг
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Руководитель</p>
                <p className="mt-2 font-medium text-foreground">
                  Елена Сидорова
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Тип занятости</p>
                <p className="mt-2 font-medium text-foreground">
                  Полный день
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Трудовой договор
                </p>
                <p className="mt-2 font-medium text-foreground">
                  01.01.2020
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Локация</p>
                <p className="mt-2 font-medium text-foreground">
                  Москва, Россия
                </p>
              </div>
            </div>
          </Card>

          {/* Security Settings */}
          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary mb-4">
              Безопасность
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div>
                  <p className="font-medium text-foreground">Пароль</p>
                  <p className="text-sm text-muted-foreground">
                    Последнее изменение 3 месяца назад
                  </p>
                </div>
                <button className="rounded-lg border border-border px-4 py-2 font-medium text-primary hover:bg-border transition-colors">
                  Изменить
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div>
                  <p className="font-medium text-foreground">
                    Двухфакторная аутентификация
                  </p>
                  <p className="text-sm text-accent">
                    ✓ Включена
                  </p>
                </div>
                <button className="rounded-lg border border-border px-4 py-2 font-medium text-primary hover:bg-border transition-colors">
                  Управлять
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
