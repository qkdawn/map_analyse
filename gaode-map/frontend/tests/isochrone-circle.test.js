import test from 'node:test'
import assert from 'node:assert/strict'

import { createAnalysisIsochroneMethods } from '../src/features/isochrone/runtime.js'

const isochroneMethods = createAnalysisIsochroneMethods()

function createBaseContext(overrides = {}) {
  const ctx = {
    selectedPoint: { lng: 120.1234, lat: 30.1234 },
    transportMode: 'walking',
    timeHorizon: 15,
    isochroneScopeMode: 'point',
    isCalculating: false,
    drawScopeActive: false,
    scopeSource: '',
    errorMessage: '',
    poiStatus: '',
    step: 1,
    activeStep3Panel: '',
    fetchProgress: 0,
    lastIsochroneGeoJSON: null,
    clearH3GridCalls: 0,
    renderResultCalls: 0,
    applySimplifyConfigCalls: 0,
    resetPanelCalls: [],
    debugCleared: 0,
    roadReset: 0,
    populationResetArgs: [],
    clearH3Grid() {
      this.clearH3GridCalls += 1
    },
    renderResult(geojson) {
      this.renderResultCalls += 1
      this.lastIsochroneGeoJSON = geojson
    },
    applySimplifyConfig() {
      this.applySimplifyConfigCalls += 1
    },
    resetAnalysisDisplayTargetsForPanel(panelId, options) {
      this.resetPanelCalls.push({ panelId, options })
    },
    clearIsochroneDebugState() {
      this.debugCleared += 1
    },
    resetRoadSyntaxState() {
      this.roadReset += 1
    },
    resetPopulationAnalysisState(args) {
      this.populationResetArgs.push(args)
    },
    normalizePath(path) {
      return Array.isArray(path) ? path : []
    },
    _closePolygonRing(path) {
      if (!Array.isArray(path) || !path.length) return []
      const out = path.map((pt) => [pt[0], pt[1]])
      const first = out[0]
      const last = out[out.length - 1]
      if (!last || first[0] !== last[0] || first[1] !== last[1]) {
        out.push([first[0], first[1]])
      }
      return out
    },
    hasDrawnScopePolygon() {
      return false
    },
    getDrawnScopePolygonPoints() {
      return []
    },
    _estimatePolygonCenter() {
      return null
    },
    setSelectedPoint(point) {
      this.selectedPoint = point
    },
    ...isochroneMethods,
  }
  return Object.assign(ctx, overrides)
}

test('buildCircleScopeGeoJSON returns a closed 72-segment polygon with radius metadata', () => {
  const ctx = createBaseContext({
    transportMode: 'driving',
    timeHorizon: 20,
  })

  const radius = isochroneMethods._resolveCircleRadiusMeters.call(ctx)
  const feature = isochroneMethods._buildCircleScopeGeoJSON.call(ctx, ctx.selectedPoint, radius)

  assert.equal(radius, 10000)
  assert.equal(feature.type, 'Feature')
  assert.equal(feature.properties.mode, 'circle')
  assert.equal(feature.properties.scope_kind, 'circle')
  assert.equal(feature.properties.transport_mode, 'driving')
  assert.equal(feature.properties.time_min, 20)
  assert.equal(feature.properties.radius_m, 10000)
  assert.deepEqual(feature.properties.center, [ctx.selectedPoint.lng, ctx.selectedPoint.lat])
  assert.equal(feature.geometry.type, 'Polygon')
  assert.equal(feature.geometry.coordinates[0].length, 73)
  assert.deepEqual(feature.geometry.coordinates[0][0], feature.geometry.coordinates[0][72])
})

test('startCircleAnalysis creates circle scope locally and does not call fetch', async () => {
  const ctx = createBaseContext({
    transportMode: 'bicycling',
    timeHorizon: 15,
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called for circle scope')
  }

  try {
    await isochroneMethods.startCircleAnalysis.call(ctx)
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(ctx.scopeSource, 'circle')
  assert.equal(ctx.step, 2)
  assert.equal(ctx.activeStep3Panel, 'poi')
  assert.equal(ctx.renderResultCalls, 1)
  assert.equal(ctx.clearH3GridCalls, 1)
  assert.equal(ctx.lastIsochroneGeoJSON?.properties?.radius_m, 3750)
  assert.equal(ctx.lastIsochroneGeoJSON?.geometry?.coordinates?.[0]?.length, 73)
  assert.equal(ctx.errorMessage, '')
  assert.match(ctx.poiStatus, /圆形范围/)
})

test('startAnalysis keeps point mode on isochrone API path', async () => {
  const ctx = createBaseContext()
  const originalFetch = globalThis.fetch
  const requested = []
  globalThis.fetch = async (url, options = {}) => {
    requested.push({
      url,
      body: JSON.parse(options.body || '{}'),
    })
    return {
      ok: true,
      async json() {
        return {
          type: 'Feature',
          properties: { mode: 'isochrone' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[120, 30], [120.01, 30], [120, 30.01], [120, 30]]],
          },
        }
      },
    }
  }

  try {
    await isochroneMethods.startAnalysis.call(ctx)
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requested.length, 1)
  assert.equal(requested[0].url, '/api/v1/analysis/isochrone')
  assert.equal(requested[0].body.mode, 'walking')
  assert.equal(requested[0].body.time_min, 15)
  assert.equal(ctx.scopeSource, 'isochrone')
  assert.equal(ctx.step, 2)
})

test('startAnalysis keeps area mode on multi-sample isochrone API path', async () => {
  const drawnPolygon = [
    [120.12, 30.12],
    [120.13, 30.12],
    [120.13, 30.13],
    [120.12, 30.12],
  ]
  const ctx = createBaseContext({
    isochroneScopeMode: 'area',
    selectedPoint: { lng: 120.125, lat: 30.125 },
    hasDrawnScopePolygon() {
      return true
    },
    getDrawnScopePolygonPoints() {
      return drawnPolygon
    },
  })
  const originalFetch = globalThis.fetch
  const requested = []
  globalThis.fetch = async (url, options = {}) => {
    requested.push({
      url,
      body: JSON.parse(options.body || '{}'),
    })
    return {
      ok: true,
      async json() {
        return {
          type: 'Feature',
          properties: { mode: 'drawn_isochrone' },
          geometry: {
            type: 'Polygon',
            coordinates: [drawnPolygon],
          },
        }
      },
    }
  }

  try {
    await isochroneMethods.startAnalysis.call(ctx)
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requested.length, 1)
  assert.equal(requested[0].url, '/api/v1/analysis/isochrone')
  assert.equal(requested[0].body.origin_mode, 'multi_sample')
  assert.deepEqual(requested[0].body.clip_polygon, drawnPolygon)
  assert.equal(ctx.scopeSource, 'drawn_isochrone')
  assert.equal(ctx.poiStatus, '已按手绘范围计算等时圈')
})
