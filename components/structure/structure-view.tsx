"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  List,
  Network,
  Search,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { DepartmentTreeNode } from "@/types/portal"

type ViewMode = "tree" | "list"

interface FlatDepartmentNode {
  node: DepartmentTreeNode
  depth: number
  path: DepartmentTreeNode[]
}

interface StructureViewProps {
  nodes: DepartmentTreeNode[]
}

function pluralEmployees(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} сотрудник`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} сотрудника`
  return `${count} сотрудников`
}

function flattenTree(nodes: DepartmentTreeNode[], depth = 0, path: DepartmentTreeNode[] = []): FlatDepartmentNode[] {
  const result: FlatDepartmentNode[] = []
  for (const node of nodes) {
    const nextPath = [...path, node]
    result.push({ node, depth, path: nextPath })
    result.push(...flattenTree(node.children, depth + 1, nextPath))
  }
  return result
}

function collectExpandableIds(nodes: DepartmentTreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id)
      ids.push(...collectExpandableIds(node.children))
    }
  }
  return ids
}

function filterTree(nodes: DepartmentTreeNode[], query: string): DepartmentTreeNode[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return nodes

  const walk = (list: DepartmentTreeNode[]): DepartmentTreeNode[] => {
    const result: DepartmentTreeNode[] = []
    for (const node of list) {
      const children = walk(node.children)
      const matchesSelf = node.name.toLowerCase().includes(normalized)
      if (matchesSelf || children.length > 0) {
        result.push({ ...node, children })
      }
    }
    return result
  }

  return walk(nodes)
}

function findFirstMatch(nodes: DepartmentTreeNode[], query: string): DepartmentTreeNode | null {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return nodes[0] ?? null

  for (const flat of flattenTree(nodes)) {
    if (flat.node.name.toLowerCase().includes(normalized)) {
      return flat.node
    }
  }
  return nodes[0] ?? null
}

function TreeNavItem({
  node,
  depth,
  selectedId,
  expandedIds,
  searchQuery,
  onSelect,
  onToggle,
}: {
  node: DepartmentTreeNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  searchQuery: string
  onSelect: (node: DepartmentTreeNode) => void
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const expanded = expandedIds.has(node.id) || searchQuery.trim().length > 0
  const isSelected = selectedId === node.id
  const highlighted =
    searchQuery.trim().length > 0 && node.name.toLowerCase().includes(searchQuery.trim().toLowerCase())

  return (
    <li>
      <div
        className={cn(
          "flex items-start gap-1 rounded-md pr-2",
          isSelected && "bg-primary/10",
          highlighted && !isSelected && "bg-amber-50 dark:bg-amber-950/20",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label={expanded ? "Свернуть" : "Развернуть"}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="h-7 w-7" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-2 text-left hover:bg-muted/60"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2 text-sm font-medium leading-snug">{node.name}</span>
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul>
          {node.children.map((child) => (
            <TreeNavItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              searchQuery={searchQuery}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function DepartmentDetailCard({ node }: { node: DepartmentTreeNode }) {
  const contactsHref = `/contacts?department=${encodeURIComponent(node.name)}`
  const headInitials = node.head?.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">{node.name}</h2>
          {node.code ? <Badge variant="secondary">{node.code}</Badge> : null}
        </div>
        {node.description ? <p className="text-sm text-muted-foreground">{node.description}</p> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">В портале</p>
          <p className="text-lg font-semibold">{pluralEmployees(node.employeeCount)}</p>
        </div>
        {node.plannedHeadcount !== null ? (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">По штату</p>
            <p className="text-lg font-semibold">{node.plannedHeadcount}</p>
          </div>
        ) : null}
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Дочерних подразделений</p>
          <p className="text-lg font-semibold">{node.children.length}</p>
        </div>
      </div>

      {node.head ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Руководитель</p>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {node.head.avatarUrl ? <AvatarImage src={node.head.avatarUrl} alt={node.head.fullName} /> : null}
              <AvatarFallback>{headInitials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{node.head.fullName}</p>
              {node.head.positionTitle ? (
                <p className="text-sm text-muted-foreground">{node.head.positionTitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {node.children.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Дочерние подразделения</p>
          <div className="flex flex-wrap gap-2">
            {node.children.map((child) => (
              <Badge key={child.id} variant="outline">
                {child.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <Link href={contactsHref}>
        <Button className="bg-[#16223b] hover:bg-[#16223b]/90">
          <Users className="mr-2 h-4 w-4" />
          Сотрудники подразделения
        </Button>
      </Link>
    </div>
  )
}

export function StructureView({ nodes }: StructureViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("tree")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(collectExpandableIds(nodes).slice(0, 8)))

  const filteredNodes = useMemo(() => filterTree(nodes, searchQuery), [nodes, searchQuery])
  const flatNodes = useMemo(() => flattenTree(filteredNodes), [filteredNodes])

  const selectedNode = useMemo(() => {
    const findById = (list: DepartmentTreeNode[]): DepartmentTreeNode | null => {
      for (const node of list) {
        if (node.id === selectedId) return node
        const nested = findById(node.children)
        if (nested) return nested
      }
      return null
    }
    return findById(nodes)
  }, [nodes, selectedId])

  const selectedPath = useMemo(() => {
    if (!selectedNode) return []
    const match = flatNodes.find((item) => item.node.id === selectedNode.id)
    return match?.path ?? []
  }, [flatNodes, selectedNode])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      const match = findFirstMatch(nodes, value)
      if (match) {
        setSelectedId(match.id)
        if (value.trim()) {
          setExpandedIds(new Set(collectExpandableIds(nodes)))
        }
      }
    },
    [nodes]
  )

  const handleSelect = useCallback((node: DepartmentTreeNode) => {
    setSelectedId(node.id)
  }, [])

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = () => setExpandedIds(new Set(collectExpandableIds(nodes)))
  const collapseAll = () => setExpandedIds(new Set())

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
        <Building2 className="mb-3 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Структура пока не настроена</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Поиск по подразделениям..."
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={viewMode === "tree" ? "default" : "outline"} onClick={() => setViewMode("tree")}>
            <Network className="mr-2 h-4 w-4" />
            Дерево
          </Button>
          <Button type="button" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}>
            <List className="mr-2 h-4 w-4" />
            Список
          </Button>
          {viewMode === "tree" ? (
            <>
              <Button type="button" variant="outline" size="icon" onClick={expandAll} aria-label="Развернуть всё">
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={collapseAll} aria-label="Свернуть всё">
                <ChevronsDownUp className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {selectedPath.length > 0 ? (
        <nav aria-label="Навигация по структуре" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {selectedPath.map((node, index) => (
            <span key={node.id} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
              <button
                type="button"
                className={cn(
                  "rounded px-1 hover:text-foreground",
                  index === selectedPath.length - 1 && "font-medium text-foreground",
                )}
                onClick={() => setSelectedId(node.id)}
              >
                {node.name}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <div className="rounded-lg border border-border bg-card p-3 lg:max-h-[70vh] lg:min-w-0 lg:overflow-auto">
          {viewMode === "tree" ? (
            <ul className="space-y-1">
              {filteredNodes.map((node) => (
                <TreeNavItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  searchQuery={searchQuery}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                />
              ))}
            </ul>
          ) : (
            <ul className="space-y-1">
              {flatNodes.map(({ node, depth }) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60",
                      selectedId === node.id && "bg-primary/10",
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
                    <span className="text-xs text-muted-foreground">{node.employeeCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 lg:min-h-[320px]">
          {selectedNode ? (
            <DepartmentDetailCard node={selectedNode} />
          ) : (
            <p className="text-sm text-muted-foreground">Выберите подразделение слева</p>
          )}
        </div>
      </div>
    </div>
  )
}
