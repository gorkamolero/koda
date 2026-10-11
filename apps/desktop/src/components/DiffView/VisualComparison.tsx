import { Button, Input } from '@koda/ui'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { selectedFileAtom, visualStateAtom, type VisualCompareMode } from '@/store/diff'

/**
 * Visual comparison component for before/after screenshots
 */
export function VisualComparison() {
  const selectedFile = useAtomValue(selectedFileAtom)
  const visualState = useAtomValue(visualStateAtom)
  const setVisualState = useSetAtom(visualStateAtom)

  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pixelDiff, setPixelDiff] = useState<ImageData | null>(null)

  // Calculate pixel diff when images change
  useEffect(() => {
    if (
      !selectedFile?.screenshotBefore ||
      !selectedFile?.screenshotAfter ||
      !visualState.showPixelOverlay
    ) {
      setPixelDiff(null)
      return
    }

    const calculateDiff = async () => {
      const beforeImg = new Image()
      const afterImg = new Image()

      beforeImg.crossOrigin = 'anonymous'
      afterImg.crossOrigin = 'anonymous'

      const screenshotBefore = selectedFile.screenshotBefore
      const screenshotAfter = selectedFile.screenshotAfter
      if (!screenshotBefore || !screenshotAfter) return

      await Promise.all([
        new Promise<void>((resolve) => {
          beforeImg.onload = () => { resolve() }
          beforeImg.src = screenshotBefore
        }),
        new Promise<void>((resolve) => {
          afterImg.onload = () => { resolve() }
          afterImg.src = screenshotAfter
        }),
      ])

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = Math.max(beforeImg.width, afterImg.width)
      const height = Math.max(beforeImg.height, afterImg.height)
      canvas.width = width
      canvas.height = height

      // Draw before image
      ctx.drawImage(beforeImg, 0, 0)
      const beforeData = ctx.getImageData(0, 0, width, height)

      // Draw after image
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(afterImg, 0, 0)
      const afterData = ctx.getImageData(0, 0, width, height)

      // Calculate diff
      const diffData = ctx.createImageData(width, height)
      let diffPixels = 0
      const totalPixels = width * height

      for (let i = 0; i < beforeData.data.length; i += 4) {
        const beforeR = beforeData.data[i] ?? 0
        const beforeG = beforeData.data[i + 1] ?? 0
        const beforeB = beforeData.data[i + 2] ?? 0
        const afterR = afterData.data[i] ?? 0
        const afterG = afterData.data[i + 1] ?? 0
        const afterB = afterData.data[i + 2] ?? 0

        const rDiff = Math.abs(beforeR - afterR)
        const gDiff = Math.abs(beforeG - afterG)
        const bDiff = Math.abs(beforeB - afterB)

        const isDifferent = rDiff > 10 || gDiff > 10 || bDiff > 10

        if (isDifferent) {
          diffPixels++
          // Highlight different pixels in magenta
          diffData.data[i] = 255 // R
          diffData.data[i + 1] = 0 // G
          diffData.data[i + 2] = 255 // B
          diffData.data[i + 3] = 180 // A
        } else {
          // Keep similar pixels semi-transparent
          diffData.data[i] = afterR
          diffData.data[i + 1] = afterG
          diffData.data[i + 2] = afterB
          diffData.data[i + 3] = 50
        }
      }

      setPixelDiff(diffData)
      const percent = (diffPixels / totalPixels) * 100
      setVisualState({ differencePercent: Math.round(percent * 100) / 100 })
    }

    void calculateDiff()
  }, [
    selectedFile?.screenshotBefore,
    selectedFile?.screenshotAfter,
    visualState.showPixelOverlay,
    setVisualState,
  ])

  const handleSliderDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const x = clientX - rect.left
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))

      setVisualState({ sliderPosition: percent })
    },
    [setVisualState]
  )

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        handleSliderDrag(e)
      }
    },
    [isDragging, handleSliderDrag]
  )

  const togglePixelOverlay = useCallback(() => {
    setVisualState({ showPixelOverlay: !visualState.showPixelOverlay })
  }, [visualState.showPixelOverlay, setVisualState])

  const setCompareMode = useCallback(
    (mode: VisualCompareMode) => {
      setVisualState({ compareMode: mode })
    },
    [setVisualState]
  )

  if (!selectedFile?.hasVisualDiff) {
    return (
      <div
        className="h-full flex items-center justify-center"
        data-testid="diff-visual-container"
      >
        <div className="text-center text-muted-foreground">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">No visual comparison available</p>
          <p className="text-xs mt-2">Screenshots not found for this file</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" data-testid="diff-visual-container">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          {/* Compare mode buttons */}
          <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
            <Button variant="unstyled"
              type="button"
              onClick={() => { setCompareMode('slider') }}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${visualState.compareMode === 'slider' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              Slider
            </Button>
            <Button variant="unstyled"
              type="button"
              onClick={() => { setCompareMode('side-by-side') }}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${visualState.compareMode === 'side-by-side' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              Side by Side
            </Button>
            <Button variant="unstyled"
              type="button"
              onClick={() => { setCompareMode('overlay') }}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${visualState.compareMode === 'overlay' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              Overlay
            </Button>
          </div>

          {/* Pixel diff toggle */}
          <Button variant="unstyled"
            type="button"
            onClick={togglePixelOverlay}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors
              ${visualState.showPixelOverlay ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}
            `}
            data-testid="diff-pixel-overlay-toggle"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Pixel Diff
          </Button>
        </div>

        {/* Difference percentage */}
        <div
          className="flex items-center gap-2 text-sm"
          data-testid="diff-visual-percentage"
        >
          <span className="text-muted-foreground">Difference:</span>
          <span
            className={`
              font-mono font-medium
              ${
                visualState.differencePercent > 10
                  ? 'text-status-error'
                  : visualState.differencePercent > 5
                    ? 'text-status-warning'
                    : 'text-status-success'
              }
            `}
          >
            {visualState.differencePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Comparison view */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-secondary/20"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {visualState.compareMode === 'slider' && selectedFile.screenshotBefore && selectedFile.screenshotAfter && (
          <SliderComparison
            beforeUrl={selectedFile.screenshotBefore}
            afterUrl={selectedFile.screenshotAfter}
            sliderPosition={visualState.sliderPosition}
            onSliderDrag={handleSliderDrag}
            onMouseDown={handleMouseDown}
            showPixelOverlay={visualState.showPixelOverlay}
            pixelDiff={pixelDiff}
          />
        )}

        {visualState.compareMode === 'side-by-side' && selectedFile.screenshotBefore && selectedFile.screenshotAfter && (
          <SideBySideComparison
            beforeUrl={selectedFile.screenshotBefore}
            afterUrl={selectedFile.screenshotAfter}
          />
        )}

        {visualState.compareMode === 'overlay' && selectedFile.screenshotBefore && selectedFile.screenshotAfter && (
          <OverlayComparison
            beforeUrl={selectedFile.screenshotBefore}
            afterUrl={selectedFile.screenshotAfter}
            showPixelOverlay={visualState.showPixelOverlay}
            pixelDiff={pixelDiff}
          />
        )}
      </div>
    </div>
  )
}

interface SliderComparisonProps {
  beforeUrl: string
  afterUrl: string
  sliderPosition: number
  onSliderDrag: (e: React.MouseEvent | React.TouchEvent) => void
  onMouseDown: () => void
  showPixelOverlay: boolean
  pixelDiff: ImageData | null
}

function SliderComparison({
  beforeUrl,
  afterUrl,
  sliderPosition,
  onSliderDrag,
  onMouseDown,
  showPixelOverlay,
  pixelDiff,
}: SliderComparisonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw pixel diff on canvas
  useEffect(() => {
    if (canvasRef.current && pixelDiff && showPixelOverlay) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        canvasRef.current.width = pixelDiff.width
        canvasRef.current.height = pixelDiff.height
        ctx.putImageData(pixelDiff, 0, 0)
      }
    }
  }, [pixelDiff, showPixelOverlay])

  return (
    <>
      {/* Before image (full width, clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${String(sliderPosition)}%` }}
        data-testid="diff-visual-before"
      >
        <img
          src={beforeUrl}
          alt="Before"
          className="max-w-none h-full object-contain"
          style={{ width: `${String((100 / sliderPosition) * 100)}%` }}
        />
      </div>

      {/* After image */}
      <div className="absolute inset-0" data-testid="diff-visual-after">
        <img
          src={afterUrl}
          alt="After"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Pixel diff overlay */}
      {showPixelOverlay && pixelDiff && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          data-testid="diff-pixel-overlay"
        />
      )}

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize z-10"
        style={{ left: `${String(sliderPosition)}%`, transform: 'translateX(-50%)' }}
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
        onClick={onSliderDrag}
        data-testid="diff-visual-slider"
        role="slider"
        aria-valuenow={sliderPosition}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        {/* Handle grip */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <svg
            className="w-4 h-4 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 px-2 py-1 bg-background/80 rounded text-xs font-medium">
        Before
      </div>
      <div className="absolute bottom-4 right-4 px-2 py-1 bg-background/80 rounded text-xs font-medium">
        After
      </div>
    </>
  )
}

interface SideBySideComparisonProps {
  beforeUrl: string
  afterUrl: string
}

function SideBySideComparison({ beforeUrl, afterUrl }: SideBySideComparisonProps) {
  return (
    <div className="flex h-full gap-2 p-2">
      <div className="flex-1 relative" data-testid="diff-visual-before">
        <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 rounded text-xs font-medium z-10">
          Before
        </div>
        <img
          src={beforeUrl}
          alt="Before"
          className="w-full h-full object-contain border border-border rounded-lg"
        />
      </div>
      <div className="flex-1 relative" data-testid="diff-visual-after">
        <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 rounded text-xs font-medium z-10">
          After
        </div>
        <img
          src={afterUrl}
          alt="After"
          className="w-full h-full object-contain border border-border rounded-lg"
        />
      </div>
    </div>
  )
}

interface OverlayComparisonProps {
  beforeUrl: string
  afterUrl: string
  showPixelOverlay: boolean
  pixelDiff: ImageData | null
}

function OverlayComparison({
  beforeUrl,
  afterUrl,
  showPixelOverlay,
  pixelDiff,
}: OverlayComparisonProps) {
  const [opacity, setOpacity] = useState(0.5)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw pixel diff
  useEffect(() => {
    if (canvasRef.current && pixelDiff && showPixelOverlay) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        canvasRef.current.width = pixelDiff.width
        canvasRef.current.height = pixelDiff.height
        ctx.putImageData(pixelDiff, 0, 0)
      }
    }
  }, [pixelDiff, showPixelOverlay])

  return (
    <div className="h-full relative">
      {/* Before image */}
      <img
        src={beforeUrl}
        alt="Before"
        className="w-full h-full object-contain"
        data-testid="diff-visual-before"
      />

      {/* After image overlay */}
      <img
        src={afterUrl}
        alt="After"
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity }}
        data-testid="diff-visual-after"
      />

      {/* Pixel diff overlay */}
      {showPixelOverlay && pixelDiff && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          data-testid="diff-pixel-overlay"
        />
      )}

      {/* Opacity slider */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-background/90 rounded-lg shadow-lg">
        <span className="text-xs text-muted-foreground">Before</span>
        <Input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={opacity}
          onChange={(e) => { setOpacity(parseFloat(e.target.value)) }}
          className="w-32 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-muted-foreground">After</span>
      </div>
    </div>
  )
}
