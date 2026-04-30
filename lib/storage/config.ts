export interface StorageConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
}

export function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "ru-central-1",
    bucket: process.env.S3_BUCKET ?? "almakor-portal",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  }
}
