export interface FileStorage {
  getPresignedUploadUrl(input: {
    objectKey: string
    contentType: string
    expiresInSeconds?: number
  }): Promise<{ uploadUrl: string; expiresAt: string }>
  getPreviewUrl(objectKey: string): Promise<string>
  deleteFile(objectKey: string): Promise<void>
}
