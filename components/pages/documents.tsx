import { useState } from 'react'
import { Search, Download, Eye, Filter, FileText, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const documents = [
  {
    id: 1,
    title: 'Политика информационной безопасности',
    category: 'Политики',
    date: '15 апреля 2024',
    version: '2.1',
    size: '2.4 МБ',
    owner: 'Служба безопасности',
    access: 'all',
  },
  {
    id: 2,
    title: 'Политика обработки персональных данных',
    category: 'Политики',
    date: '10 апреля 2024',
    version: '1.3',
    size: '1.2 МБ',
    owner: 'Юридический отдел',
    access: 'all',
  },
  {
    id: 3,
    title: 'Инструкция по охране труда при работе на высоте',
    category: 'Инструкции',
    date: '8 апреля 2024',
    version: '3.0',
    size: '5.2 МБ',
    owner: 'Отдел ОТ и ПБ',
    access: 'all',
  },
  {
    id: 4,
    title: 'Регламент согласования проектной документации',
    category: 'Регламенты',
    date: '1 апреля 2024',
    version: '1.5',
    size: '3.1 МБ',
    owner: 'СНАРК | Проект',
    access: 'all',
  },
  {
    id: 5,
    title: 'Регламент работы с подрядными организациями',
    category: 'Регламенты',
    date: '25 марта 2024',
    version: '2.0',
    size: '4.8 МБ',
    owner: 'СНАРК | Строй',
    access: 'restricted',
  },
  {
    id: 6,
    title: 'Инструкция по эксплуатации тяговых подстанций',
    category: 'Инструкции',
    date: '20 марта 2024',
    version: '1.2',
    size: '8.5 МБ',
    owner: 'СНАРК | Тяговые подстанции',
    access: 'restricted',
  },
  {
    id: 7,
    title: 'Приказ о назначении ответственных лиц',
    category: 'Приказы',
    date: '15 марта 2024',
    version: '1.0',
    size: '0.5 МБ',
    owner: 'Управление',
    access: 'all',
  },
]

const categories = [
  'Все',
  'Политики',
  'Инструкции',
  'Регламенты',
  'Приказы',
  'Архив',
]

export function Documents() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Все')

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesCategory =
      selectedCategory === 'Все' || doc.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Документы
        </h1>
        <p className="mt-2 text-muted-foreground">
          Вся необходимая корпоративная документация в одном месте
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6 p-6">
        <div className="grid gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск документов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Documents List */}
      <div className="space-y-3">
        {filteredDocuments.map((doc) => (
          <Card
            key={doc.id}
            className="p-6 hover:shadow-lg transition-all cursor-pointer hover:border-secondary/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-4">
                <div className="mt-1 rounded-lg bg-secondary/10 p-3">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-foreground">
                    {doc.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-secondary">
                      {doc.category}
                    </span>
                    <span>v{doc.version}</span>
                    <span>{doc.date}</span>
                    <span>{doc.size}</span>
                    <span className="text-muted-foreground">{doc.owner}</span>
                    {doc.access === 'restricted' && (
                      <span className="flex items-center gap-1 text-destructive">
                        <Lock className="h-3 w-3" />
                        Ограничен
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="rounded-lg border border-border p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Eye className="h-5 w-5" />
                </button>
                <button className="rounded-lg border border-border p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Документы не найдены
          </p>
        </Card>
      )}
    </div>
  )
}
