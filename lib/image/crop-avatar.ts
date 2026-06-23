const VIEWPORT_SIZE = 280
const OUTPUT_SIZE = 512

export interface AvatarCropState {
  scale: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_AVATAR_CROP: AvatarCropState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Не удалось загрузить изображение"))
    }
    image.src = url
  })
}

function baseScale(image: HTMLImageElement): number {
  return Math.max(VIEWPORT_SIZE / image.naturalWidth, VIEWPORT_SIZE / image.naturalHeight)
}

export async function cropAvatarFile(
  file: File,
  crop: AvatarCropState,
  outputSize = OUTPUT_SIZE
): Promise<File> {
  const image = await loadImage(file)
  const scale = baseScale(image) * crop.scale
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const x = VIEWPORT_SIZE / 2 - drawWidth / 2 + crop.offsetX
  const y = VIEWPORT_SIZE / 2 - drawHeight / 2 + crop.offsetY

  const viewport = document.createElement("canvas")
  viewport.width = VIEWPORT_SIZE
  viewport.height = VIEWPORT_SIZE
  const viewportCtx = viewport.getContext("2d")
  if (!viewportCtx) throw new Error("Canvas не поддерживается")

  viewportCtx.fillStyle = "#ffffff"
  viewportCtx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)
  viewportCtx.drawImage(image, x, y, drawWidth, drawHeight)

  const output = document.createElement("canvas")
  output.width = outputSize
  output.height = outputSize
  const outputCtx = output.getContext("2d")
  if (!outputCtx) throw new Error("Canvas не поддерживается")

  outputCtx.drawImage(viewport, 0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE, 0, 0, outputSize, outputSize)

  const blob = await new Promise<Blob>((resolve, reject) => {
    output.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error("Не удалось обработать изображение"))
      },
      "image/jpeg",
      0.92
    )
  })

  const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar"
  return new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" })
}

export { VIEWPORT_SIZE as AVATAR_VIEWPORT_SIZE }
