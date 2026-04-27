function createStoreFieldComputed(store, fieldKeys = []) {
  return (Array.isArray(fieldKeys) ? fieldKeys : []).reduce((acc, key) => {
    const field = String(key || '').trim()
    if (!field) return acc
    acc[field] = {
      get() {
        return store[field]
      },
      set(value) {
        store[field] = value
      },
    }
    return acc
  }, {})
}

function createStoreBackedComputed(bindings = []) {
  return (Array.isArray(bindings) ? bindings : []).reduce((acc, item) => {
    if (!item || typeof item !== 'object') return acc
    const store = item.store
    const fieldKeys = item.fieldKeys
    if (!store) return acc
    return Object.assign(acc, createStoreFieldComputed(store, fieldKeys))
  }, {})
}

export { createStoreFieldComputed, createStoreBackedComputed }
