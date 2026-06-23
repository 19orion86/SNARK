import { mkdir, writeFile } from "fs/promises"
import path from "path"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_BYTES = 5 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Поддерживаются только JPG, PNG, WEBP и GIF"
  }
  if (file.size > MAX_BYTES) {
    return "Размер файла не должен превышать 5 МБ"
  }
  return null
}

export async function saveAvatarFile(userId: string, file: File): Promise<string> {
  const validationError = validateAvatarFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const ext = EXT_BY_TYPE[file.type] ?? "jpg"
  const fileName = `${userId}-${Date.now()}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, fileName), buffer)

  return `/uploads/avatars/${fileName}`
}
