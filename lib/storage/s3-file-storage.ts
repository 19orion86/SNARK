import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getStorageConfig } from "@/lib/storage/config"
import type { FileStorage } from "@/lib/storage/file-storage"

function createS3Client() {
  const config = getStorageConfig()
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId ?? "",
      secretAccessKey: config.secretAccessKey ?? "",
    },
    forcePathStyle: true, // обязательно для MinIO
  })
}

export const s3FileStorage: FileStorage = {
  async getPresignedUploadUrl(input) {
    const config = getStorageConfig()
    const client = createS3Client()
    const expiresIn = input.expiresInSeconds ?? 900

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    })

    const uploadUrl = await getSignedUrl(client, command, { expiresIn })
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    return { uploadUrl, expiresAt }
  },

  async getPreviewUrl(objectKey) {
    const config = getStorageConfig()
    const client = createS3Client()

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    })

    // presigned URL на 1 час для предпросмотра
    return getSignedUrl(client, command, { expiresIn: 3600 })
  },

  async deleteFile(objectKey) {
    const config = getStorageConfig()
    const client = createS3Client()

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      })
    )
  },
}
