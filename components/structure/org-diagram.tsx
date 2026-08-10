"use client"

import type { DepartmentTreeNode } from "@/types/portal"
import { cn } from "@/lib/utils"

interface OrgDiagramProps {
  nodes: DepartmentTreeNode[]
}

function NodeBox({ node }: { node: DepartmentTreeNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[140px] max-w-[220px] rounded-lg border bg-card px-3 py-2 text-center shadow-sm">
        <p className="line-clamp-2 text-sm font-semibold">{node.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{node.employeeCount} чел.</p>
        {node.head?.fullName ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{node.head.fullName}</p>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <>
          <div className="h-4 w-px bg-border" />
          <div
            className={cn(
              "flex flex-wrap justify-center gap-4 border-t border-border pt-4",
              node.children.length > 1 && "px-2"
            )}
          >
            {node.children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                <div className="mb-0 h-4 w-px bg-border" />
                <NodeBox node={child} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function OrgDiagram({ nodes }: OrgDiagramProps) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет подразделений для схемы</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-muted/20 p-6">
      <div className="flex min-w-max flex-wrap justify-center gap-8">
        {nodes.map((node) => (
          <NodeBox key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}
