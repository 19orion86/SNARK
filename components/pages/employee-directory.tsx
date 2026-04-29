import { useState } from 'react'
import { Search, Filter, Phone, Mail, MapPin, Badge } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const employees = [
  {
    id: 1,
    name: 'Александр Петров',
    position: 'Генеральный директор',
    department: 'Управление',
    phone: '+7 (495) 123-45-67',
    email: 'a.petrov@snark.ru',
    office: 'Кабинет 101',
    status: 'online',
  },
  {
    id: 2,
    name: 'Елена Сидорова',
    position: 'Директор по технологиям',
    department: 'IT',
    phone: '+7 (495) 123-45-68',
    email: 'e.sidorova@snark.ru',
    office: 'Кабинет 205',
    status: 'online',
  },
  {
    id: 3,
    name: 'Иван Смирнов',
    position: 'Ведущий инженер',
    department: 'Инжиниринг',
    phone: '+7 (495) 123-45-69',
    email: 'i.smirnov@snark.ru',
    office: 'Кабинет 310',
    status: 'offline',
  },
  {
    id: 4,
    name: 'Ольга Кузнецова',
    position: 'Менеджер проектов',
    department: 'Проекты',
    phone: '+7 (495) 123-45-70',
    email: 'o.kuznetsova@snark.ru',
    office: 'Кабинет 212',
    status: 'online',
  },
  {
    id: 5,
    name: 'Дмитрий Волков',
    position: 'Системный администратор',
    department: 'IT',
    phone: '+7 (495) 123-45-71',
    email: 'd.volkov@snark.ru',
    office: 'Кабинет 206',
    status: 'online',
  },
  {
    id: 6,
    name: 'Мария Орлова',
    position: 'HR специалист',
    department: 'Кадры',
    phone: '+7 (495) 123-45-72',
    email: 'm.orlova@snark.ru',
    office: 'Кабинет 103',
    status: 'offline',
  },
]

const departments = ['Все', 'IT', 'Инжиниринг', 'Проекты', 'Управление', 'Кадры']

export function EmployeeDirectory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('Все')

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesDepartment =
      selectedDepartment === 'Все' || emp.department === selectedDepartment
    return matchesSearch && matchesDepartment
  })

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Справочник сотрудников
        </h1>
        <p className="mt-2 text-muted-foreground">
          Всего в организации {employees.length} сотрудников
        </p>
      </div>

      {/* Search and Filter */}
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
            {departments.map((dept) => (
              <button
                key={dept}
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

      {/* Employees List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((emp) => (
          <Card
            key={emp.id}
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Badge className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground">
                      {emp.name}
                    </h3>
                    <p className="text-sm text-secondary">{emp.position}</p>
                  </div>
                </div>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${
                  emp.status === 'online'
                    ? 'bg-accent'
                    : 'bg-muted-foreground'
                }`}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Отдел</p>
                <p className="font-medium text-foreground">{emp.department}</p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Phone className="h-4 w-4" />
                <a href={`tel:${emp.phone}`}>{emp.phone}</a>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${emp.email}`}>{emp.email}</a>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{emp.office}</span>
              </div>
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
