"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  AVATAR_VIEWPORT_SIZE,
  cropAvatarFile,
  DEFAULT_AVATAR_CROP,
  type AvatarCropState,
} from "@/lib/image/crop-avatar"
import { cn } from "@/lib/utils"

interface AvatarImageEditorProps {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (file: File) => void
}

export function AvatarImageEditor({ file, open, onOpenChange, onConfirm }: AvatarImageEditorProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<AvatarCropState>(DEFAULT_AVATAR_CROP)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setCrop(DEFAULT_AVATAR_CROP)
    setError(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.offsetX,
      originY: crop.offsetY,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY
    setCrop((prev) => ({
      ...prev,
      offsetX: dragRef.current!.originX + deltaX,
      offsetY: dragRef.current!.originY + deltaY,
    }))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleConfirm = useCallback(async () => {
    if (!file) return
    setProcessing(true)
    setError(null)
    try {
      const cropped = await cropAvatarFile(file, crop)
      onConfirm(cropped)
      onOpenChange(false)
    } catch {
      setError("Не удалось обрезать изображение")
    } finally {
      setProcessing(false)
    }
  }, [crop, file, onConfirm, onOpenChange])

  const scalePercent = Math.round(crop.scale * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактирование фото</DialogTitle>
          <DialogDescription>
            Перетащите фото и измените масштаб. Область в круге будет сохранена как аватар.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "relative mx-auto overflow-hidden rounded-full border-2 border-primary bg-muted",
              "touch-none cursor-grab active:cursor-grabbing"
            )}
            style={{ width: AVATAR_VIEWPORT_SIZE, height: AVATAR_VIEWPORT_SIZE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Предпросмотр"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px)) scale(${crop.scale})`,
                  transformOrigin: "center center",
                  width: AVATAR_VIEWPORT_SIZE,
                  height: AVATAR_VIEWPORT_SIZE,
                  objectFit: "cover",
                }}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Масштаб</Label>
              <span className="text-xs text-muted-foreground">{scalePercent}%</span>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Slider
                min={100}
                max={300}
                step={1}
                value={[scalePercent]}
                onValueChange={(value) =>
                  setCrop((prev) => ({ ...prev, scale: (value[0] ?? 100) / 100 }))
                }
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-[#16223b] hover:bg-[#16223b]/90"
            disabled={!file || processing}
            onClick={() => void handleConfirm()}
          >
            {processing ? "Обработка..." : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
