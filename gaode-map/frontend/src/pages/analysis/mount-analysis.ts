import './register-modules'
import { ensureAnalysisVendorsAndStyles } from './analysis-assets'
import { ANALYSIS_TEMPLATE } from './analysis-template'
import { runAnalysisBootstrapScript } from './analysis-bootstrap-runtime'
import { ensureCanvasReadbackOptimization } from './adapters/canvas-readback'

type AnalysisConfigPayload = {
  amap_js_api_key: string
  amap_js_security_code: string
  tianditu_key: string
}

type BootstrapPayload = {
  config: AnalysisConfigPayload
  typeMapConfig: Record<string, unknown>
}

declare global {
  interface Window {
    __ANALYSIS_BOOTSTRAP__?: BootstrapPayload
    __ANALYSIS_APP_MOUNTED__?: boolean
    Vue?: { createApp?: (...args: any[]) => any }
  }
}

export async function mountAnalysisWorkbench(payload: BootstrapPayload): Promise<void> {
  ensureCanvasReadbackOptimization()
  await ensureAnalysisVendorsAndStyles()

  const host = document.getElementById('analysis-app-root')
  if (!host) {
    throw new Error('analysis app root not found')
  }

  window.__ANALYSIS_BOOTSTRAP__ = payload

  if (!window.__ANALYSIS_APP_MOUNTED__) {
    host.innerHTML = `<div class="analysis-layout-root">${ANALYSIS_TEMPLATE}</div>`
    runAnalysisBootstrapScript()
    window.__ANALYSIS_APP_MOUNTED__ = true
    return
  }

  // HMR or second mount fallback: full reload keeps state logic simple.
  window.location.reload()
}
