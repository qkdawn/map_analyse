function mountAnalysisRuntimeApp({ app, pinia, target = '#analysis-app-root' }) {
  if (!app || typeof app.use !== 'function' || typeof app.mount !== 'function') {
    throw new Error('invalid app instance for runtime mount')
  }
  if (!pinia) {
    throw new Error('pinia instance is required for runtime mount')
  }
  app.use(pinia)
  app.mount(target)
}

export { mountAnalysisRuntimeApp }
