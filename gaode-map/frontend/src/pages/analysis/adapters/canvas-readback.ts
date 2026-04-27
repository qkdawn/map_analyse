declare global {
  interface Window {
    __ANALYSIS_CANVAS_READBACK_PATCHED__?: boolean
  }
}

export function ensureCanvasReadbackOptimization(): void {
  if (typeof window === 'undefined') return
  if (window.__ANALYSIS_CANVAS_READBACK_PATCHED__) return

  const proto = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype
  if (!proto || typeof proto.getContext !== 'function') return

  const originalGetContext = proto.getContext
  proto.getContext = function patchedGetContext(
    type: string,
    options?: CanvasRenderingContext2DSettings | WebGLContextAttributes,
  ): RenderingContext | null {
    if (type === '2d') {
      const baseOptions = options && typeof options === 'object' ? options : {}
      return originalGetContext.call(this, type, {
        ...baseOptions,
        willReadFrequently: true,
      } as CanvasRenderingContext2DSettings)
    }
    return originalGetContext.call(this, type, options as any)
  }

  window.__ANALYSIS_CANVAS_READBACK_PATCHED__ = true
}

