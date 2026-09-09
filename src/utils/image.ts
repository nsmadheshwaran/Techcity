/**
 * Camera / file input → small JPEG data URL.
 *
 * Part photos (RAM sticks, printers, DVR serial plates…) are stored inline on
 * the service-part row, so they are downscaled to a max edge of 1024px and
 * re-encoded at ~0.75 quality — typically 60–150 KB per photo, small enough
 * for IndexedDB and the optional cloud sync while still legible for reading
 * serial numbers and labels.
 */
export async function fileToCompressedDataUrl(file: File, maxEdge = 1024, quality = 0.75): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file is not a readable image.'))
    image.src = dataUrl
  })

  // Skip the canvas entirely when the photo is already small enough.
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  if (scale >= 1 && dataUrl.length < 300_000) return dataUrl

  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
