'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Check, ChevronRight, ChevronsUpDown, MessageSquare, Search, Phone, Mail, MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { EmployeeAvatar } from '@/components/employees/employee-avatar'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  employeeStatusDotColor,
  employeeStatusLabel,
} from '@/lib/portal-data/presence-ui'
import type { ContactsData } from '@/types/portal'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function buildPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 1) return [1]
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]
  if (current > 3) pages.push('ellipsis')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (current < total - 2) pages.push('ellipsis')
  if (!pages.includes(total)) pages.push(total)

  return pages
}

export function EmployeeDirectory({
  data,
  currentUserId,
}: {
  data: ContactsData
  currentUserId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') ?? '')
  const [departmentOpen, setDepartmentOpen] = useState(false)

  const selectedDepartment = searchParams.get('department') ?? 'Все'
  const total = data.total ?? data.employees.length
  const page = data.page ?? 1
  const limit = data.limit ?? PAGE_SIZE
  const pageCount = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1
  const pageNumbers = buildPageNumbers(page, pageCount)

  const buildHref = useCallback(
    (nextPage: number, overrides?: { search?: string; department?: string }) => {
      const params = new URLSearchParams()
      const search = (overrides?.search ?? searchTerm).trim()
      const department = overrides?.department ?? selectedDepartment

      if (search) params.set('search', search)
      if (department && department !== 'Все') params.set('department', department)
      if (nextPage > 1) params.set('page', String(nextPage))
      if (limit !== PAGE_SIZE) params.set('limit', String(limit))

      const query = params.toString()
      return query ? `/contacts?${query}` : '/contacts'
    },
    [limit, searchTerm, selectedDepartment]
  )

  const applySearch = () => {
    router.push(buildHref(1))
  }

  const selectDepartment = (department: string) => {
    router.push(buildHref(1, { department }))
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Справочник сотрудников
        </h1>
        <p className="mt-2 text-muted-foreground">
          Всего в организации {total} сотрудников
        </p>
      </div>

      <Card className="mb-6 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employee-search">Поиск</Label>
            <form
              className="relative"
              onSubmit={(event) => {
                event.preventDefault()
                applySearch()
              }}
            >
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                id="employee-search"
                placeholder="Поиск по имени или должности..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </form>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department-filter">Подразделение</Label>
            <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="department-filter"
                  variant="outline"
                  role="combobox"
                  aria-expanded={departmentOpen}
                  className="h-10 w-full justify-between font-normal"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedDepartment}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Найти подразделение..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Подразделение не найдено</CommandEmpty>
                    <CommandGroup>
                      {data.departments.map((dept) => (
                        <CommandItem
                          key={dept}
                          value={dept}
                          onSelect={() => {
                            selectDepartment(dept)
                            setDepartmentOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4 shrink-0',
                              selectedDepartment === dept ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="line-clamp-2 leading-snug">{dept}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.employees.map((emp) => (
          <Card
            key={emp.id}
            className="flex flex-col p-6 transition-shadow hover:shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <EmployeeAvatar
                    name={emp.name}
                    initials={emp.avatar}
                    avatarUrl={emp.avatarUrl}
                    className="h-12 w-12 text-sm"
                    imageClassName="h-12 w-12"
                  />
                  <div
                    className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-card ${employeeStatusDotColor(emp.status)}`}
                    title={employeeStatusLabel(emp.status)}
                    aria-label={employeeStatusLabel(emp.status)}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-card-foreground">
                    {emp.name}
                  </h3>
                  <p className="text-sm text-secondary">{emp.position}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 border-t border-border pt-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Отдел</p>
                <p className="font-medium text-foreground">{emp.department}</p>
              </div>

              {emp.phone && emp.phone !== 'Не указан' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <a href={`tel:${emp.phone}`} className="hover:text-primary">
                    {emp.phone}
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <a href={`mailto:${emp.email}`} className="hover:text-primary">
                  {emp.email}
                </a>
              </div>

              {emp.office && emp.office !== 'Не указан' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>{emp.office}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${employeeStatusDotColor(emp.status)}`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{employeeStatusLabel(emp.status)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentUserId && emp.userId !== currentUserId ? (
                  <Button variant="default" size="sm" className="bg-[#16223b] hover:bg-[#16223b]/90" asChild>
                    <Link href={`/chat?peer=${emp.userId}`}>
                      <MessageSquare className="mr-1 h-4 w-4" aria-hidden="true" />
                      Написать
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/contacts/${emp.userId}`}>
                    Подробнее
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {data.employees.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Сотрудники не найдены
          </p>
        </Card>
      )}

      {pageCount > 1 ? (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <PaginationPrevious href={buildHref(page - 1)} />
              ) : (
                <PaginationPrevious href="#" className="pointer-events-none opacity-50" tabIndex={-1} />
              )}
            </PaginationItem>

            {pageNumbers.map((item, index) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink href={buildHref(item)} isActive={item === page}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              {page < pageCount ? (
                <PaginationNext href={buildHref(page + 1)} />
              ) : (
                <PaginationNext href="#" className="pointer-events-none opacity-50" tabIndex={-1} />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
