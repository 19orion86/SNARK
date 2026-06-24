import Link from "next/link"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { EmployeeAvatar } from "@/components/employees/employee-avatar"
import {
  employeeStatusBadgeClasses,
  employeeStatusDotColor,
  employeeStatusLabel,
} from "@/lib/portal-data/presence-ui"
import { getServerSession } from "@/lib/auth/server-session"
import { loadEmployeeById } from "@/lib/portal-data/loaders"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

function formatDateRu(iso?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function hasValue(value?: string | null): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed !== "Не указан"
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession()
  const { item } = await loadEmployeeById(id)

  if (!item) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Сотрудник не найден.</p>
        <Link
          href="/contacts"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Назад к справочнику
        </Link>
      </Card>
    )
  }

  const hireDate = formatDateRu(item.hireDate)
  const birthDate = formatDateRu(item.birthDate)
  const hasPhone = hasValue(item.phone)
  const hasOffice = hasValue(item.office)
  const hasPersonal = !!(birthDate || hasValue(item.education) || hasValue(item.address) || hasValue(item.citizenship))

  return (
    <article className="space-y-6">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Назад к справочнику
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Карточка сотрудника</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Контактная информация и сведения о подразделении
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="flex flex-col items-center p-6 text-center md:col-span-1">
          <EmployeeAvatar
            name={item.name}
            initials={item.avatar}
            avatarUrl={item.avatarUrl}
            className="h-[120px] w-[120px] text-3xl"
            imageClassName="h-[120px] w-[120px]"
          />

          <h2 className="mt-4 text-xl font-bold text-foreground">{item.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{item.position}</p>

          <span
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${employeeStatusBadgeClasses(item.status)}`}
          >
            <span className={`h-2 w-2 rounded-full ${employeeStatusDotColor(item.status)}`} aria-hidden="true" />
            {employeeStatusLabel(item.status)}
          </span>

          <div className="mt-6 flex w-full flex-col gap-2">
            {hasPhone ? (
              <a
                href={`tel:${item.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Позвонить
              </a>
            ) : null}
            {session?.userId && session.userId !== item.userId ? (
              <Link
                href={`/chat?peer=${item.userId}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#16223b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16223b]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Написать в чат
              </Link>
            ) : null}
            <a
              href={`mailto:${item.email}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </a>
          </div>
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Рабочая информация</h2>
            <dl className="space-y-4">
              <InfoRow icon={Building2} label="Подразделение">
                <Link
                  href={`/contacts?department=${encodeURIComponent(item.department)}`}
                  className="text-primary hover:underline"
                >
                  {item.department}
                </Link>
              </InfoRow>

              {item.manager ? (
                <InfoRow icon={User} label="Руководитель">
                  <Link
                    href={`/contacts/${item.manager.id}`}
                    className="text-primary hover:underline"
                  >
                    {item.manager.fullName}
                  </Link>
                  {item.manager.positionTitle ? (
                    <span className="block text-xs text-muted-foreground">
                      {item.manager.positionTitle}
                    </span>
                  ) : null}
                </InfoRow>
              ) : null}

              {hireDate ? (
                <InfoRow icon={Calendar} label="Дата приёма">
                  {hireDate}
                </InfoRow>
              ) : null}

              {hasOffice ? (
                <InfoRow icon={Briefcase} label="Офис">
                  {item.office}
                </InfoRow>
              ) : null}
            </dl>
          </Card>

          {hasPersonal ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Личная информация</h2>
              <dl className="space-y-4">
                {birthDate ? (
                  <InfoRow icon={Calendar} label="Дата рождения">
                    {birthDate}
                  </InfoRow>
                ) : null}
                {hasValue(item.education) ? (
                  <InfoRow icon={GraduationCap} label="Образование">
                    {item.education}
                  </InfoRow>
                ) : null}
                {hasValue(item.address) ? (
                  <InfoRow icon={MapPin} label="Адрес">
                    {item.address}
                  </InfoRow>
                ) : null}
                {hasValue(item.citizenship) ? (
                  <InfoRow icon={Globe} label="Гражданство">
                    {item.citizenship}
                  </InfoRow>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    </article>
  )
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  children: React.ReactNode
}

function InfoRow({ icon: Icon, label, children }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
      </div>
    </div>
  )
}
