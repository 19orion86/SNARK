import type { FileStorage } from "@/lib/storage/file-storage"

export const mockFileStorage: FileStorage = {
  async getPresignedUploadUrl(input) {
    const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000).toISOString()
    return {
      uploadUrl: `https://mock-storage.local/upload/${encodeURIComponent(input.objectKey)}`,
      expiresAt,
    }
  },

  async getPreviewUrl(objectKey) {
    return `https://mock-storage.local/preview/${encodeURIComponent(objectKey)}`
  },

  async deleteFile(_objectKey) {
    return
  },
}
