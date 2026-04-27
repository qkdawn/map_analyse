import test from 'node:test'
import assert from 'node:assert/strict'

import { createAnalysisH3Methods } from '../src/features/h3/panel.js'
import { createAnalysisWorkbenchMethods } from '../src/features/workbench/navigation.js'

const h3Methods = createAnalysisH3Methods()
const navigationMethods = createAnalysisWorkbenchMethods()

function createH3Context(overrides = {}) {
  const ctx = {
    step: 2,
    activeStep3Panel: 'poi',
    poiSubTab: 'category',
    h3SimplifyTargets: ['map', 'isochrone', 'drawn_polygon', 'poi'],
    h3SimplifyTargetsInitialized: true,
    h3GridFeatures: [],
    h3AnalysisGridFeatures: [],
    h3MainStage: 'params',
    mapCore: null,
    populationGrid: null,
    populationLayer: null,
    getDefaultSimplifyTargets: h3Methods.getDefaultSimplifyTargets,
    getSimplifyAnalysisTargets: h3Methods.getSimplifyAnalysisTargets,
    getSimplifyGridAnalysisTargets: h3Methods.getSimplifyGridAnalysisTargets,
    getAllowedSimplifyTargets: h3Methods.getAllowedSimplifyTargets,
    extractSimplifyBaseTargets: h3Methods.extractSimplifyBaseTargets,
    resolveSimplifyAnalysisTargetForPanel: h3Methods.resolveSimplifyAnalysisTargetForPanel,
    normalizeSimplifyTargets: h3Methods.normalizeSimplifyTargets,
    hasSimplifyDisplayTarget: h3Methods.hasSimplifyDisplayTarget,
    enableSimplifyDisplayTarget: h3Methods.enableSimplifyDisplayTarget,
    resetAnalysisDisplayTargetsForPanel: h3Methods.resetAnalysisDisplayTargetsForPanel,
    applySimplifyConfig() {
      this.applySimplifyConfigCalls = Number(this.applySimplifyConfigCalls || 0) + 1
    },
    clearH3GridDisplayOnLeave() {
      this.h3Cleared = true
    },
    restoreH3GridDisplayOnEnter() {
      this.h3Restored = true
    },
    clearPopulationRasterDisplayOnLeave() {
      this.populationCleared = true
    },
    restorePopulationRasterDisplayOnEnter() {
      this.populationRestored = true
    },
    clearNightlightDisplayOnLeave() {
      this.nightlightCleared = true
    },
    restoreNightlightDisplayOnEnter() {
      this.nightlightRestored = true
    },
    clearTimeseriesDisplayOnLeave() {
      this.timeseriesCleared = true
    },
    restoreTimeseriesDisplayOnEnter() {
      this.timeseriesRestored = true
    },
    resumeRoadSyntaxDisplay() {
      this.syntaxResumed = true
    },
    suspendRoadSyntaxDisplay() {
      this.syntaxSuspended = true
    },
  }
  return Object.assign(ctx, overrides)
}

function createNavigationContext(overrides = {}) {
  const ctx = createH3Context({
    isDraggingNav: false,
    roadSyntaxModulesReady: true,
    roadSyntaxModuleMissing: [],
    roadSyntaxSummary: null,
    roadSyntaxRoadFeatures: [],
    roadSyntaxNodes: [],
    roadSyntaxMainTab: 'params',
    roadSyntaxMetric: 'connectivity',
    roadSyntaxLastMetricTab: 'connectivity',
    h3ExportMenuOpen: false,
    h3ExportTasksOpen: false,
    poiKdeEnabled: false,
    poiSystemSuspendedForSyntax: false,
    isStep3PanelVisible() {
      return true
    },
    roadSyntaxSetStatus(message) {
      this.roadSyntaxStatus = message
    },
    normalizeStep3PanelId: navigationMethods.normalizeStep3PanelId,
    autoEnableDisplayTargetsForPanel: navigationMethods.autoEnableDisplayTargetsForPanel,
    shouldShowPoiOnCurrentPanel: navigationMethods.shouldShowPoiOnCurrentPanel,
    applySimplifyPointVisibility() {
      this.poiVisibilityApplied = true
    },
    $nextTick(callback) {
      if (typeof callback === 'function') callback()
      return Promise.resolve()
    },
    refreshPoiKdeOverlay() {},
    updatePoiCharts() {},
    resizePoiChart() {},
    syncH3PoiFilterSelection() {},
    ensureH3PanelEntryState() {},
    updateH3Charts() {},
    updateDecisionCards() {},
    clearPoiKdeOverlay() {},
    ensurePopulationPanelEntryState() {},
    ensureNightlightPanelEntryState() {},
    ensureTimeseriesPanelEntryState() {
      this.timeseriesEnsured = true
    },
    updatePopulationCharts() {},
    setRoadSyntaxMainTab(tab) {
      this.roadSyntaxMainTab = tab
    },
  })
  return Object.assign(ctx, overrides)
}

test('normalizeSimplifyTargets accepts analysis layers and keeps h3/population mutually exclusive', () => {
  const ctx = createH3Context({
    h3SimplifyTargets: ['map', 'population', 'h3', 'timeseries', 'syntax', 'invalid', 'poi', 'population'],
  })

  const normalized = h3Methods.normalizeSimplifyTargets.call(ctx)

  assert.deepEqual(normalized, ['map', 'syntax', 'poi', 'population'])
})

test('resetAnalysisDisplayTargetsForPanel keeps base targets and activates only current panel analysis target', () => {
  const ctx = createH3Context({
    poiSubTab: 'analysis',
    h3SimplifyTargets: ['map', 'isochrone', 'poi', 'syntax'],
  })

  h3Methods.resetAnalysisDisplayTargetsForPanel.call(ctx, 'population', { apply: false })

  assert.deepEqual(ctx.h3SimplifyTargets, ['map', 'isochrone', 'poi', 'population'])
})

test('selectStep3Panel resets analysis display targets to the selected panel default', () => {
  const ctx = createNavigationContext({
    activeStep3Panel: 'poi',
    poiSubTab: 'grid',
    h3SimplifyTargets: ['map', 'poi', 'h3', 'syntax'],
  })

  navigationMethods.selectStep3Panel.call(ctx, 'population')

  assert.equal(ctx.activeStep3Panel, 'population')
  assert.deepEqual(ctx.h3SimplifyTargets, ['map', 'population'])
})

test('syncSimplifyResultLayerVisibility restores population and syntax while hiding h3', () => {
  const ctx = createH3Context()

  h3Methods.syncSimplifyResultLayerVisibility.call(ctx, ['map', 'population', 'syntax'])

  assert.equal(ctx.populationRestored, true)
  assert.equal(ctx.h3Cleared, true)
  assert.equal(ctx.syntaxResumed, true)
  assert.equal(ctx.populationCleared, undefined)
})

test('selectStep3Panel switches to nightlight and activates its display target', () => {
  const ctx = createNavigationContext({
    activeStep3Panel: 'population',
    h3SimplifyTargets: ['map', 'population'],
  })

  navigationMethods.selectStep3Panel.call(ctx, 'nightlight')

  assert.equal(ctx.activeStep3Panel, 'nightlight')
  assert.deepEqual(ctx.h3SimplifyTargets, ['map', 'nightlight'])
})

test('selectStep3Panel switches to timeseries and activates its display target', () => {
  const ctx = createNavigationContext({
    activeStep3Panel: 'nightlight',
    h3SimplifyTargets: ['map', 'nightlight'],
  })

  navigationMethods.selectStep3Panel.call(ctx, 'timeseries')

  assert.equal(ctx.activeStep3Panel, 'timeseries')
  assert.deepEqual(ctx.h3SimplifyTargets, ['map', 'timeseries'])
  assert.equal(ctx.timeseriesEnsured, true)
})

test('syncSimplifyResultLayerVisibility restores nightlight while hiding population and h3', () => {
  const ctx = createH3Context()

  h3Methods.syncSimplifyResultLayerVisibility.call(ctx, ['map', 'nightlight'])

  assert.equal(ctx.nightlightRestored, true)
  assert.equal(ctx.h3Cleared, true)
  assert.equal(ctx.populationCleared, true)
})

test('syncSimplifyResultLayerVisibility restores timeseries while hiding population, nightlight, and h3', () => {
  const ctx = createH3Context()

  h3Methods.syncSimplifyResultLayerVisibility.call(ctx, ['map', 'timeseries'])

  assert.equal(ctx.timeseriesRestored, true)
  assert.equal(ctx.h3Cleared, true)
  assert.equal(ctx.populationCleared, true)
  assert.equal(ctx.nightlightCleared, true)
})

test('shouldShowPoiOnCurrentPanel hides poi when an analysis layer is visible', () => {
  const ctx = createNavigationContext({
    activeStep3Panel: 'poi',
    poiSubTab: 'grid',
    h3SimplifyTargets: ['map', 'poi', 'h3'],
  })

  const visible = navigationMethods.shouldShowPoiOnCurrentPanel.call(ctx)

  assert.equal(visible, false)
})

test('shouldShowPoiOnCurrentPanel hides poi when timeseries layer is visible', () => {
  const ctx = createNavigationContext({
    activeStep3Panel: 'poi',
    poiSubTab: 'grid',
    h3SimplifyTargets: ['map', 'poi', 'timeseries'],
  })

  const visible = navigationMethods.shouldShowPoiOnCurrentPanel.call(ctx)

  assert.equal(visible, false)
})
