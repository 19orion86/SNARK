"use client"

import { useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import { Label } from "@/components/ui/label"
import { EmployeeAvatar } from "@/components/employees/employee-avatar"
import { AvatarImageEditor } from "@/components/profile/avatar-image-editor"
import { cn } from "@/lib/utils"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

interface AvatarUploadFieldProps {
  name: string
  initials: string
  currentAvatarUrl?: string | null
  file: File | null
  onFileChange: (file: File | null) => void
  error?: string | null
}

function pickImageFile(event: React.ChangeEvent<HTMLInputElement>) {
  const next = event.target.files?.[0] ?? null
  event.target.value = ""
  return next
}

export function AvatarUploadField({
  name,
  initials,
  currentAvatarUrl,
  file,
  onFileChange,
  error,
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const openEditor = (next: File) => {
    setSourceFile(next)
    setEditorOpen(true)
  }

  const applyFile = (next: File | null) => {
    if (!next) {
      onFileChange(null)
      setPreviewUrl(null)
      return
    }
    if (!next.type.startsWith("image/")) {
      return
    }
    openEditor(next)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault()
        const pasted = item.getAsFile()
        if (pasted) applyFile(pasted)
        return
      }
    }
  }

  const displayUrl = previewUrl ?? currentAvatarUrl ?? undefined

  return (
    <>
      <div className="space-y-2">
        <Label>Фото</Label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onPaste={handlePaste}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            const dropped = event.dataTransfer.files?.[0] ?? null
            applyFile(dropped)
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-4 transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
          )}
        >
          <EmployeeAvatar
            name={name}
            initials={initials}
            avatarUrl={displayUrl}
            className="h-20 w-20 text-xl"
            imageClassName="h-20 w-20"
          />
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Выберите фото, вставьте или перетащите
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              После выбора откроется редактор: масштаб и кадрирование
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => applyFile(pickImageFile(event))}
          />
        </div>
        {file ? (
          <p className="text-xs text-muted-foreground">Готово к сохранению: {file.name}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <AvatarImageEditor
        file={sourceFile}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onConfirm={(cropped) => {
          onFileChange(cropped)
          setPreviewUrl(URL.createObjectURL(cropped))
        }}
      />
    </>
  )
}
