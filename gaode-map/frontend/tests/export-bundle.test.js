import test from 'node:test'
import assert from 'node:assert/strict'

import { createAnalysisExportMethods } from '../src/features/export/export-bundle.js'

const exportMethods = createAnalysisExportMethods()

function createContext(overrides = {}) {
  return {
    ...exportMethods,
    getPoiCategoryChartStats() {
      return { labels: ['餐饮'], values: [10] }
    },
    computeH3DerivedStats() {},
    h3AnalysisSummary: { grid_count: 4 },
    h3DerivedStats: { structureSummary: { rows: [] } },
    h3MetricView: 'density',
    h3StructureFillMode: 'gi_z',
    h3DecisionTopN: 5,
    h3TargetCategory: 'coffee',
    _getH3CategoryLabel() {
      return '咖啡'
    },
    roadSyntaxRegressionView() {
      return { r2: 0.62 }
    },
    roadSyntaxSummary: { node_count: 8, edge_count: 10 },
    roadSyntaxMetric: 'choice',
    roadSyntaxMainTab: 'analysis',
    getPopulationSummaryRows() {
      return [{ key: 'total_population', label: '总人口', value: '1000' }]
    },
    populationAnalysisView: 'age',
    populationOverview: {
      age_distribution: [{ age_band_label: '25-34岁', total: 600 }],
    },
    populationLayer: {
      summary: { top_dominant_age_band_label: '25-34岁', dominant_cell_ratio: 0.35 },
    },
    getNightlightSummaryRows() {
      return [{ key: 'total_radiance', label: '总辐亮', value: '131.6' }]
    },
    nightlightAnalysisView: 'hotspot',
    nightlightLayer: {
      analysis: { core_hotspot_count: 3, hotspot_cell_ratio: 0.25 },
    },
    getNightlightLegendNote() {
      return '地图轮廓仅表示核心/高亮/次级热点带边界。'
    },
    timeseriesActiveTab: 'joint',
    getTimeseriesSummaryRows() {
      return [{ key: 'up_up', label: '人口增夜光增', value: '2' }]
    },
    getTimeseriesInsights() {
      return [{ type: 'joint_quadrant', title: '人口增夜光增', value: 2, unit: '个' }]
    },
    timeseriesLayer: {
      summary: { class_counts: { pop_up_light_up: 2 } },
    },
    allPoisDetails: [{}, {}],
    poiSubTab: 'analysis',
    poiAnalysisSubTab: 'category',
    ...overrides,
  }
}

test('_buildFrontendAnalysisForExport includes population, nightlight, and timeseries analysis blocks', () => {
  const ctx = createContext()

  const payload = ctx._buildFrontendAnalysisForExport()

  assert.equal(payload.h3.target_category, 'coffee')
  assert.equal(payload.h3.target_category_label, '咖啡')
  assert.equal(payload.population.analysis_view, 'age')
  assert.equal(payload.population.summary_rows[0].key, 'total_population')
  assert.equal(payload.population.layer_summary.top_dominant_age_band_label, '25-34岁')
  assert.equal(payload.nightlight.analysis_view, 'hotspot')
  assert.equal(payload.nightlight.analysis.core_hotspot_count, 3)
  assert.match(payload.nightlight.legend_note, /热点带边界/)
  assert.equal(payload.timeseries.active_tab, 'joint')
  assert.equal(payload.timeseries.summary_rows[0].key, 'up_up')
  assert.equal(payload.timeseries.insights[0].type, 'joint_quadrant')
})
