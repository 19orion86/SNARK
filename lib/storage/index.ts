import "server-only"
import { getStorageConfig } from "@/lib/storage/config"
import type { FileStorage } from "@/lib/storage/file-storage"
import { mockFileStorage } from "@/lib/storage/file-storage.mock"
import { s3FileStorage } from "@/lib/storage/s3-file-storage"

export function getFileStorage(): FileStorage {
  const config = getStorageConfig()
  const isReal =
    !!config.accessKeyId &&
    config.accessKeyId !== "mock" &&
    config.accessKeyId !== "replace-with-s3-access-key"

  return isReal ? s3FileStorage : mockFileStorage
}
