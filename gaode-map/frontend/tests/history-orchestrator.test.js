import test from 'node:test'
import assert from 'node:assert/strict'

import { createAnalysisHistoryOrchestratorMethods } from '../src/pages/analysis/orchestrators/history.js'

function createContext(overrides = {}) {
  return {
    ...createAnalysisHistoryOrchestratorMethods(),
    selectedPoint: { lng: 112.9388, lat: 28.2282 },
    scopeSource: 'history',
    currentHistoryRecordId: 'history-1',
    currentHistoryPolygonWgs84: [[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]],
    isochroneScopeMode: 'point',
    drawnScopePolygon: [],
    allPoisDetails: [],
    resultDataSource: 'local',
    poiDataSource: 'local',
    transportMode: 'walking',
    timeHorizon: 15,
    poiStatus: '',
    normalizePoiSource(source, fallback = 'local') {
      return source || fallback
    },
    getIsochronePolygonPayload() {
      return [[1, 1], [1, 2], [2, 2], [1, 1]]
    },
    loadHistoryList() {
      return Promise.resolve()
    },
    ...overrides,
  }
}

test('saveAnalysisHistoryAsync skips network save for restored history', async () => {
  const ctx = createContext()
  let fetchCalled = false
  const previousFetch = global.fetch
  global.fetch = async () => {
    fetchCalled = true
    throw new Error('should not save restored history')
  }

  try {
    ctx.saveAnalysisHistoryAsync()
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(fetchCalled, false)
    assert.equal(ctx.poiStatus, '当前历史记录已保存，无需重复保存')
  } finally {
    global.fetch = previousFetch
  }
})
