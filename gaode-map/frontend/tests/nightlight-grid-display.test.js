import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAnalysisNightlightInitialState,
  createAnalysisNightlightMethods,
} from '../src/features/nightlight/panel.js'

const nightlightMethods = createAnalysisNightlightMethods()

function createNightlightContext(overrides = {}) {
  return Object.assign(
    createAnalysisNightlightInitialState(),
    nightlightMethods,
    {
      mapCore: {
        clearGridPolygonsCalls: 0,
        clearPopulationRasterOverlayCalls: 0,
        setGridFeaturesCalls: [],
        setPopulationRasterOverlayCalls: [],
        clearGridPolygons() {
          this.clearGridPolygonsCalls += 1
        },
        clearPopulationRasterOverlay() {
          this.clearPopulationRasterOverlayCalls += 1
        },
        setGridFeatures(features, style) {
          this.setGridFeaturesCalls.push({ features, style })
        },
        setPopulationRasterOverlay(payload) {
          this.setPopulationRasterOverlayCalls.push(payload)
        },
      },
      nightlightGrid: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 0], [1, 0], [1, 1]]] },
            properties: { cell_id: 'r0_c0', row: 0, col: 0 },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[2, 1], [3, 1], [3, 0], [2, 0], [2, 1]]] },
            properties: { cell_id: 'r0_c1', row: 0, col: 1 },
          },
        ],
      },
      nightlightLayer: {
        cells: [
          {
            cell_id: 'r0_c0',
            value: 12.5,
            fill_color: '#123456',
            stroke_color: '#ffffff',
            fill_opacity: 0.42,
          },
        ],
      },
    },
    overrides,
  )
}

test('buildNightlightStyledFeatures joins grid features with layer styles by cell_id', () => {
  const ctx = createNightlightContext()

  const features = nightlightMethods.buildNightlightStyledFeatures.call(ctx)

  assert.equal(features.length, 2)
  assert.equal(features[0].properties.fillColor, '#123456')
  assert.equal(features[0].properties.fillOpacity, 0.42)
  assert.equal(features[0].properties.strokeColor, '#ffffff')
  assert.equal(features[1].properties.fillColor, '#090b1f')
  assert.equal(features[1].properties.fillOpacity, 0.28)
  assert.equal(features[1].properties.strokeColor, '#94a3b8')
})

test('applyNightlightGridToMap renders vector grid and clears raster overlay', () => {
  const ctx = createNightlightContext()

  nightlightMethods.applyNightlightGridToMap.call(ctx)

  assert.equal(ctx.mapCore.clearPopulationRasterOverlayCalls, 1)
  assert.equal(ctx.mapCore.setGridFeaturesCalls.length, 1)
  assert.equal(ctx.mapCore.setPopulationRasterOverlayCalls.length, 0)
  assert.equal(ctx.mapCore.setGridFeaturesCalls[0].features.length, 2)
})
