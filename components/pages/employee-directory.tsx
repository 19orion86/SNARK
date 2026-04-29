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
    office: 'Головной офис, каб. 101',
    status: 'online',
    avatar: 'АП',
  },
  {
    id: 2,
    name: 'Елена Сидорова',
    position: 'Руководитель направления',
    department: 'СНАРК | Проект',
    phone: '+7 (495) 123-45-68',
    email: 'e.sidorova@snark.ru',
    office: 'Офис проектирования, каб. 205',
    status: 'online',
    avatar: 'ЕС',
  },
  {
    id: 3,
    name: 'Иван Смирнов',
    position: 'Главный инженер',
    department: 'СНАРК | Инжиниринг',
    phone: '+7 (495) 123-45-69',
    email: 'i.smirnov@snark.ru',
    office: 'Технический центр, каб. 310',
    status: 'offline',
    avatar: 'ИС',
  },
  {
    id: 4,
    name: 'Ольга Кузнецова',
    position: 'Руководитель проектов',
    department: 'СНАРК | Строй',
    phone: '+7 (495) 123-45-70',
    email: 'o.kuznetsova@snark.ru',
    office: 'Строительное управление, каб. 212',
    status: 'online',
    avatar: 'ОК',
  },
  {
    id: 5,
    name: 'Дмитрий Волков',
    position: 'Инженер контактной сети',
    department: 'СНАРК | Контактная сеть',
    phone: '+7 (495) 123-45-71',
    email: 'd.volkov@snark.ru',
    office: 'Производственная база, каб. 106',
    status: 'online',
    avatar: 'ДВ',
  },
  {
    id: 6,
    name: 'Мария Орлова',
    position: 'Инженер-проектировщик',
    department: 'СНАРК | Тяговые подстанции',
    phone: '+7 (495) 123-45-72',
    email: 'm.orlova@snark.ru',
    office: 'Проектный офис, каб. 203',
    status: 'away',
    avatar: 'МО',
  },
  {
    id: 7,
    name: 'Сергей Козлов',
    position: 'Инженер-конструктор',
    department: 'СНАРК | Стальные решения',
    phone: '+7 (495) 123-45-73',
    email: 's.kozlov@snark.ru',
    office: 'Конструкторское бюро, каб. 401',
    status: 'online',
    avatar: 'СК',
  },
  {
    id: 8,
    name: 'Анна Белова',
    position: 'Специалист по зарядным станциям',
    department: 'СНАРК | Зарядные станции',
    phone: '+7 (495) 123-45-74',
    email: 'a.belova@snark.ru',
    office: 'Инновационный центр, каб. 305',
    status: 'online',
    avatar: 'АБ',
  },
]

const departments = [
  'Все',
  'Управление',
  'СНАРК | Проект',
  'СНАРК | Строй',
  'СНАРК | Инжиниринг',
  'СНАРК | Контактная сеть',
  'СНАРК | Тяговые подстанции',
  'СНАРК | Стальные решения',
  'СНАРК | Зарядные станции',
]

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
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {emp.avatar}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${
                      emp.status === 'online'
                        ? 'bg-success'
                        : emp.status === 'away'
                        ? 'bg-accent'
                        : 'bg-muted-foreground'
                    }`}
                    title={emp.status === 'online' ? 'В офисе' : emp.status === 'away' ? 'Отошёл' : 'Не в сети'}
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
