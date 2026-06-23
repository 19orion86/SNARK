"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface EmployeeAvatarProps {
  name: string
  initials: string
  avatarUrl?: string | null
  className?: string
  imageClassName?: string
}

export function EmployeeAvatar({
  name,
  initials,
  avatarUrl,
  className,
  imageClassName,
}: EmployeeAvatarProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [avatarUrl])

  const showImage = Boolean(avatarUrl?.trim()) && !failed

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl!}
        alt={`Фото: ${name}`}
        className={cn("rounded-full object-cover", imageClassName, className)}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground",
        className
      )}
      aria-hidden={!name}
    >
      {initials}
    </div>
  )
}
