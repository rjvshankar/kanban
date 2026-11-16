// Square-crop maths and canvas drawing for the profile picture.
// The crop is described as a zoom (1 = image just covers the square) and the point of the image
// (as a 0..1 fraction) that sits at the centre of the square.

export const VIEW = 240 // on-screen size of the crop square, px
export const OUT = 256 // size of the uploaded picture, px

export interface Crop {
  zoom: number
  cx: number
  cy: number
}

export interface Layout {
  // Drawn image size and top-left position inside the square.
  dw: number
  dh: number
  x: number
  y: number
  // The crop centre after clamping, so the image always covers the whole square.
  cx: number
  cy: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Where the image lands inside a `size` square for this crop.
export function layout(w: number, h: number, crop: Crop, size = VIEW): Layout {
  const scale = Math.max(size / w, size / h) * crop.zoom
  const dw = w * scale
  const dh = h * scale
  const cx = clamp(crop.cx, size / 2 / dw, 1 - size / 2 / dw)
  const cy = clamp(crop.cy, size / 2 / dh, 1 - size / 2 / dh)
  return { dw, dh, cx, cy, x: size / 2 - cx * dw, y: size / 2 - cy * dh }
}

// Paints the cropped image onto a canvas context of `size` px.
export function draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, crop: Crop, size: number) {
  const l = layout(img.naturalWidth, img.naturalHeight, crop, size)
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, l.x, l.y, l.dw, l.dh)
}

// Renders the final OUT x OUT picture. WebP is smaller; browsers without WebP encoding fall back to PNG (both accepted by the API).
export function cropToBlob(img: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = OUT
  canvas.height = OUT
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Image editing is not supported in this browser.'))
  draw(ctx, img, crop, OUT)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/webp', 0.9),
  )
}
