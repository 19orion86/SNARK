"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Employee } from "@/types/portal"

interface EmployeePickerProps {
  employees: Employee[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  allowEmpty?: boolean
  disabled?: boolean
  className?: string
}

function employeeLabel(employee: Employee): string {
  return employee.position ? `${employee.name} · ${employee.position}` : employee.name
}

export function EmployeePicker({
  employees,
  value,
  onChange,
  placeholder = "Выберите сотрудника",
  allowEmpty = true,
  disabled = false,
  className,
}: EmployeePickerProps) {
  return (
    <div className={cn("min-w-0 w-full flex-1", className)}>
      <Select
        value={value ?? "__none__"}
        onValueChange={(next) => onChange(next === "__none__" ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "h-auto min-h-9 w-full min-w-0 max-w-full overflow-hidden whitespace-normal py-2",
            "[&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,var(--radix-select-trigger-width))]">
          {allowEmpty ? <SelectItem value="__none__">Не назначен</SelectItem> : null}
          {employees.map((employee) => {
            const label = employeeLabel(employee)
            return (
              <SelectItem
                key={employee.userId}
                value={employee.userId}
                title={label}
                className="items-start whitespace-normal"
              >
                <span className="line-clamp-2 break-words text-left">{label}</span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
