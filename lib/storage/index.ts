import "server-only"
import { mockFileStorage } from "@/lib/storage/file-storage.mock"
import type { FileStorage } from "@/lib/storage/file-storage"
import { getStorageConfig } from "@/lib/storage/config"

export function getFileStorage(): FileStorage {
  // Placeholder for future AWS SDK integration.
  // Keep config read to validate env shape during development.
  getStorageConfig()
  return mockFileStorage
}
