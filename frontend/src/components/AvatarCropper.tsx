// Lets the user position and zoom a chosen image inside a square, then returns the cropped picture as a Blob.
// Drag to move, slider to zoom. Everything happens in the browser; only the small result is uploaded.

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { VIEW, cropToBlob, draw, layout, type Crop } from '../lib/avatarCrop'

interface Props {
  file: File
  onCancel: () => void
  onDone: (blob: Blob) => void
  onError: (message: string) => void
}

export default function AvatarCropper({ file, onCancel, onDone, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The decoded image; null until it has loaded.
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, cx: 0.5, cy: 0.5 })
  // Last pointer position while dragging, else null.
  const drag = useRef<{ x: number; y: number } | null>(null)

  // Always call the latest onError without making the decode effect re-run when the parent re-renders.
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  // Decode the file into an <img>.
  useEffect(() => {
    // Set by cleanup: a superseded run (e.g. React StrictMode's double effect) must not report its revoked URL as an error.
    let stale = false
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => !stale && setImg(image)
    image.onerror = () => !stale && onErrorRef.current('Could not read that image.')
    image.src = objectUrl
    return () => {
      stale = true
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  // Repaint the preview whenever the crop changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (img && ctx) draw(ctx, img, crop, VIEW)
  }, [img, crop])

  function onPointerDown(e: PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current || !img) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    // Dragging the picture right moves the visible centre left.
    setCrop((c) => {
      const l = layout(img.naturalWidth, img.naturalHeight, c)
      return { ...c, cx: l.cx - dx / l.dw, cy: l.cy - dy / l.dh }
    })
  }

  async function confirm() {
    if (!img) return
    try {
      onDone(await cropToBlob(img, crop))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not process the image.')
    }
  }

  return (
    <div className="grid justify-items-center gap-4">
      <canvas
        ref={canvasRef}
        width={VIEW}
        height={VIEW}
        aria-label="Crop area"
        className="cursor-grab touch-none rounded-full bg-muted active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
      />
      <label className="flex w-full max-w-60 items-center gap-2 text-sm text-muted-foreground">
        Zoom
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
          className="flex-1"
        />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Back</Button>
        <Button type="button" onClick={() => void confirm()} disabled={!img}>Use photo</Button>
      </div>
    </div>
  )
}
