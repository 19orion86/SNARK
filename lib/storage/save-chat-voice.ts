import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getStorageConfig } from "@/lib/storage/config"

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED_AUDIO = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "video/webm",
])

const EXT_FALLBACK: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "video/webm": "webm",
}

function isRealStorage(): boolean {
  const config = getStorageConfig()
  return (
    !!config.accessKeyId &&
    config.accessKeyId !== "mock" &&
    config.accessKeyId !== "replace-with-s3-access-key"
  )
}

export async function saveChatVoiceFile(
  channelId: string,
  file: File
): Promise<{
  fileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
}> {
  if (file.size > MAX_BYTES) {
    throw new Error("Размер файла не должен превышать 25 МБ")
  }
  const mimeType = file.type || "audio/webm"
  if (file.type && !ALLOWED_AUDIO.has(file.type)) {
    throw new Error("Поддерживаются только webm/ogg/mp3")
  }

  const ext = EXT_FALLBACK[mimeType] ?? file.name.split(".").pop() ?? "webm"
  const fileName = file.name?.trim() || `voice.${ext}`
  const objectKey = `chat/${channelId}/voice/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  if (isRealStorage()) {
    const config = getStorageConfig()
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId ?? "",
        secretAccessKey: config.secretAccessKey ?? "",
      },
      forcePathStyle: true,
    })
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
      })
    )
    return { fileName, fileUrl: objectKey, mimeType, sizeBytes: file.size }
  }

  const dir = path.join(process.cwd(), "public", "uploads", "chat", "voice")
  await mkdir(dir, { recursive: true })
  const storedName = `${channelId}-${Date.now()}.${ext}`
  await writeFile(path.join(dir, storedName), buffer)
  return {
    fileName,
    fileUrl: `/uploads/chat/voice/${storedName}`,
    mimeType,
    sizeBytes: file.size,
  }
}
