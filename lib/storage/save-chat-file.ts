import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getStorageConfig } from "@/lib/storage/config"
import {
  TASK_FILE_EXT_FALLBACK,
  validateTaskFile,
} from "@/lib/storage/task-file-rules"

function isRealStorage(): boolean {
  const config = getStorageConfig()
  return (
    !!config.accessKeyId &&
    config.accessKeyId !== "mock" &&
    config.accessKeyId !== "replace-with-s3-access-key"
  )
}

export async function saveChatFile(
  channelId: string,
  file: File
): Promise<{
  fileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
}> {
  const validationError = validateTaskFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const ext = TASK_FILE_EXT_FALLBACK[file.type] ?? file.name.split(".").pop() ?? "bin"
  const safeBase = file.name.replace(/[^\w.\-()а-яА-ЯёЁ\s]/g, "_").slice(0, 80)
  const fileName = safeBase || `file.${ext}`
  const objectKey = `chat/${channelId}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || "application/octet-stream"

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

  const dir = path.join(process.cwd(), "public", "uploads", "chat")
  await mkdir(dir, { recursive: true })
  const storedName = `${channelId}-${Date.now()}.${ext}`
  await writeFile(path.join(dir, storedName), buffer)
  return {
    fileName,
    fileUrl: `/uploads/chat/${storedName}`,
    mimeType,
    sizeBytes: file.size,
  }
}
