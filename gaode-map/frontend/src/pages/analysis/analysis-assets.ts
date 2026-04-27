const scriptCache = new Map<string, Promise<void>>()
const styleIdPrefix = 'analysis-style-'

function ensureScript(src: string): Promise<void> {
  const cached = scriptCache.get(src)
  if (cached) return cached

  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-analysis-src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if ((existing as any).__loaded) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`script load failed: ${src}`)), { once: true })
      return
    }

    const s = document.createElement('script')
    s.src = src
    s.async = false
    s.dataset.analysisSrc = src
    s.onload = () => {
      ;(s as any).__loaded = true
      resolve()
    }
    s.onerror = () => reject(new Error(`script load failed: ${src}`))
    document.head.appendChild(s)
  })

  scriptCache.set(src, p)
  return p
}

function ensureStyle(href: string): void {
  const id = `${styleIdPrefix}${href}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

export async function ensureAnalysisVendorsAndStyles(): Promise<void> {
  ensureStyle('/static/css/map-common.css')
  ensureStyle('/static/css/filter-panel.css')
  ensureStyle('/static/css/analysis-page.css')

  await ensureScript('/static/vendor/html2canvas.min.js')
  await ensureScript('/static/vendor/echarts.min.js')
}
