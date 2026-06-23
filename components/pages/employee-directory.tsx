'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, Phone, Mail, MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmployeeAvatar } from '@/components/employees/employee-avatar'
import {
  employeeStatusDotColor,
  employeeStatusLabel,
} from '@/lib/portal-data/presence-ui'
import type { ContactsData } from '@/types/portal'

export function EmployeeDirectory({ data }: { data: ContactsData }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('Все')

  const filteredEmployees = data.employees.filter((emp) => {
    const matchesSearch = emp.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesDepartment =
      selectedDepartment === 'Все' || emp.department === selectedDepartment
    return matchesSearch && matchesDepartment
  })

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Справочник сотрудников
        </h1>
        <p className="mt-2 text-muted-foreground">
          Всего в организации {data.employees.length} сотрудников
        </p>
      </div>

      <Card className="mb-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или должности..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {data.departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors ${
                  selectedDepartment === dept
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((emp) => (
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

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${employeeStatusDotColor(emp.status)}`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{employeeStatusLabel(emp.status)}</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/contacts/${emp.userId}`}>
                  Подробнее
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Сотрудники не найдены
          </p>
        </Card>
      )}
    </div>
  )
}
