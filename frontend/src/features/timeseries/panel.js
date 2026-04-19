function createTimeseriesFallbackMeta() {
  return {
    population_years: ['2024', '2025', '2026'],
    nightlight_years: [2023, 2024, 2025],
    common_years: [2024, 2025],
    population_periods: [
      { value: '2024-2025', label: '2024 -> 2025' },
      { value: '2025-2026', label: '2025 -> 2026' },
      { value: '2024-2026', label: '2024 -> 2026' },
    ],
    nightlight_periods: [
      { value: '2023-2024', label: '2023 -> 2024' },
      { value: '2024-2025', label: '2024 -> 2025' },
      { value: '2023-2025', label: '2023 -> 2025' },
    ],
    joint_periods: [
      { value: '2024-2025', label: '2024 -> 2025' },
    ],
    default_population_period: '2024-2026',
    default_nightlight_period: '2023-2025',
    default_joint_period: '2024-2025',
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function createAnalysisTimeseriesInitialState() {
  const meta = createTimeseriesFallbackMeta()
  return {
    isComputingTimeseries: false,
    isLoadingTimeseriesMeta: false,
    timeseriesStatus: '',
    timeseriesMeta: meta,
    timeseriesMetaLoaded: false,
    timeseriesActiveTab: 'population',
    timeseriesPopulationPeriod: meta.default_population_period,
    timeseriesNightlightPeriod: meta.default_nightlight_period,
    timeseriesJointPeriod: meta.default_joint_period,
    timeseriesPopulationLayerView: 'population_delta',
    timeseriesNightlightLayerView: 'radiance_delta',
    timeseriesPopulation: null,
    timeseriesNightlight: null,
    timeseriesJoint: null,
    timeseriesLayer: null,
  }
}

function createAnalysisTimeseriesMethods() {
  return {
    createTimeseriesFallbackMeta,
    isTimeseriesPanelActive() {
      return this.step === 2 && this.activeStep3Panel === 'timeseries'
    },
    isTimeseriesDisplayActive() {
      return this.step === 2
        && (typeof this.hasSimplifyDisplayTarget === 'function'
          ? this.hasSimplifyDisplayTarget('timeseries')
          : this.isTimeseriesPanelActive())
    },
    getTimeseriesTabOptions() {
      return [
        { value: 'population', label: '人口变化' },
        { value: 'nightlight', label: '夜光变化' },
        { value: 'joint', label: '人口-夜光关系' },
      ]
    },
    getTimeseriesPopulationViewOptions() {
      return [
        { value: 'population_delta', label: '人口变化量' },
        { value: 'population_rate', label: '人口变化率' },
        { value: 'density_delta', label: '密度变化' },
        { value: 'age_shift', label: '主导年龄变化' },
      ]
    },
    getTimeseriesNightlightViewOptions() {
      return [
        { value: 'radiance_delta', label: '夜光变化量' },
        { value: 'radiance_rate', label: '夜光变化率' },
        { value: 'hotspot_shift', label: '热点变化' },
        { value: 'lit_change', label: '亮区变化' },
      ]
    },
    getTimeseriesPeriods(kind = 'population') {
      const meta = this.timeseriesMeta || createTimeseriesFallbackMeta()
      if (kind === 'nightlight') return Array.isArray(meta.nightlight_periods) ? meta.nightlight_periods : []
      if (kind === 'joint') return Array.isArray(meta.joint_periods) ? meta.joint_periods : []
      return Array.isArray(meta.population_periods) ? meta.population_periods : []
    },
    getCurrentTimeseriesPayload() {
      if (this.timeseriesActiveTab === 'nightlight') return this.timeseriesNightlight
      if (this.timeseriesActiveTab === 'joint') return this.timeseriesJoint
      return this.timeseriesPopulation
    },
    formatTimeseriesValue(value, digits = 2) {
      const num = toNumber(value, 0)
      if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(2)}M`
      if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
      return num.toFixed(digits)
    },
    formatTimeseriesPercent(value) {
      return `${(toNumber(value, 0) * 100).toFixed(1)}%`
    },
    async loadTimeseriesMeta(force = false) {
      if ((this.timeseriesMetaLoaded && !force) || this.isLoadingTimeseriesMeta) return this.timeseriesMeta
      this.isLoadingTimeseriesMeta = true
      try {
        const res = await fetch('/api/v1/analysis/timeseries/meta')
        if (!res.ok) throw new Error(`/api/v1/analysis/timeseries/meta 请求失败(${res.status})`)
        const data = await res.json()
        const fallback = createTimeseriesFallbackMeta()
        this.timeseriesMeta = Object.assign({}, fallback, data || {})
        this.timeseriesMetaLoaded = true
        this.timeseriesPopulationPeriod = String(this.timeseriesMeta.default_population_period || fallback.default_population_period)
        this.timeseriesNightlightPeriod = String(this.timeseriesMeta.default_nightlight_period || fallback.default_nightlight_period)
        this.timeseriesJointPeriod = String(this.timeseriesMeta.default_joint_period || fallback.default_joint_period)
        return this.timeseriesMeta
      } catch (e) {
        console.error(e)
        this.timeseriesMeta = createTimeseriesFallbackMeta()
        this.timeseriesMetaLoaded = false
        throw e
      } finally {
        this.isLoadingTimeseriesMeta = false
      }
    },
    clearTimeseriesDisplayOnLeave() {
      if (this.mapCore && typeof this.mapCore.setAnalysisBackdropMode === 'function') {
        this.mapCore.setAnalysisBackdropMode('')
      }
      if (this.mapCore && typeof this.mapCore.clearGridPolygons === 'function') {
        this.mapCore.clearGridPolygons()
      }
      if (this.mapCore && typeof this.mapCore.clearPopulationRasterOverlay === 'function') {
        this.mapCore.clearPopulationRasterOverlay()
      }
    },
    buildTimeseriesStyledFeatures() {
      const payload = this.getCurrentTimeseriesPayload()
      const layer = (payload && payload.layer) || this.timeseriesLayer || {}
      const baseFeatures = Array.isArray(layer.features) ? layer.features : []
      const cellMap = new Map(
        ((Array.isArray(layer.cells) ? layer.cells : [])
          .map((cell) => [String((cell && cell.cell_id) || ''), cell]))
      )
      return baseFeatures.map((feature) => {
        const props = Object.assign({}, (feature && feature.properties) || {})
        const cell = cellMap.get(String(props.cell_id || props.h3_id || ''))
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: Object.assign({}, props, cell ? {
            timeseriesClassKey: String(cell.class_key || ''),
            timeseriesClassLabel: String(cell.class_label || ''),
            fillColor: String(cell.fill_color || '#e5e7eb'),
            fillOpacity: Math.max(0.24, Math.min(0.86, toNumber(cell.fill_opacity, 0.5))),
            strokeColor: String(cell.stroke_color || '#64748b'),
            strokeWeight: 0.8,
          } : {
            timeseriesClassKey: '',
            timeseriesClassLabel: '',
            fillColor: '#e5e7eb',
            fillOpacity: 0.24,
            strokeColor: '#cbd5e1',
            strokeWeight: 0.8,
          }),
        }
      })
    },
    applyTimeseriesGridToMap() {
      if (!this.isTimeseriesDisplayActive() || !this.mapCore) return
      if (typeof this.mapCore.clearPopulationRasterOverlay === 'function') {
        this.mapCore.clearPopulationRasterOverlay()
      }
      const features = this.buildTimeseriesStyledFeatures()
      if (!features.length) {
        if (typeof this.mapCore.clearGridPolygons === 'function') this.mapCore.clearGridPolygons()
        return
      }
      if (typeof this.mapCore.setGridFeatures !== 'function') return
      this.mapCore.setGridFeatures(features, {
        strokeColor: '#64748b',
        strokeWeight: 0.8,
        fillColor: '#e5e7eb',
        fillOpacity: 0.28,
        clickable: false,
        webglBatch: true,
      })
    },
    restoreTimeseriesDisplayOnEnter() {
      if (!this.isTimeseriesDisplayActive()) return
      this.applyTimeseriesGridToMap()
    },
    async requestTimeseries(endpoint, body) {
      const polygon = this.getIsochronePolygonPayload()
      const res = await fetch(`/api/v1/analysis/timeseries/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ polygon, coord_type: 'gcj02' }, body || {})),
      })
      if (!res.ok) {
        let detail = ''
        try {
          detail = await res.text()
        } catch (_) {}
        throw new Error(detail || `时序${endpoint}接口失败`)
      }
      return res.json()
    },
    async computeTimeseriesPopulation() {
      const data = await this.requestTimeseries('population', {
        period: this.timeseriesPopulationPeriod,
        layer_view: this.timeseriesPopulationLayerView,
      })
      this.timeseriesPopulation = data
      this.timeseriesLayer = data.layer || null
      return data
    },
    async computeTimeseriesNightlight() {
      const data = await this.requestTimeseries('nightlight', {
        period: this.timeseriesNightlightPeriod,
        layer_view: this.timeseriesNightlightLayerView,
      })
      this.timeseriesNightlight = data
      this.timeseriesLayer = data.layer || null
      return data
    },
    async computeTimeseriesJoint() {
      const data = await this.requestTimeseries('joint', {
        period: this.timeseriesJointPeriod,
      })
      this.timeseriesJoint = data
      this.timeseriesLayer = data.layer || null
      return data
    },
    async computeTimeseriesCurrent() {
      const rawRing = this.getIsochronePolygonRing()
      if (!rawRing || this.isComputingTimeseries) return
      this.isComputingTimeseries = true
      this.timeseriesStatus = '正在计算时序变化...'
      try {
        await this.loadTimeseriesMeta(false)
        if (this.timeseriesActiveTab === 'nightlight') await this.computeTimeseriesNightlight()
        else if (this.timeseriesActiveTab === 'joint') await this.computeTimeseriesJoint()
        else await this.computeTimeseriesPopulation()
        this.timeseriesStatus = '时序分析完成'
        this.applyTimeseriesGridToMap()
      } catch (e) {
        console.error(e)
        this.timeseriesStatus = '时序分析失败: ' + (e && e.message ? e.message : String(e))
      } finally {
        this.isComputingTimeseries = false
      }
    },
    async ensureTimeseriesPanelEntryState() {
      const rawRing = this.getIsochronePolygonRing()
      if (!rawRing) {
        this.timeseriesStatus = ''
        this.restoreTimeseriesDisplayOnEnter()
        return
      }
      try {
        await this.loadTimeseriesMeta(false)
      } catch (e) {
        this.timeseriesStatus = '时序元数据加载失败: ' + (e && e.message ? e.message : String(e))
        return
      }
      const current = this.getCurrentTimeseriesPayload()
      if (!current && !this.isComputingTimeseries) {
        await this.computeTimeseriesCurrent()
        return
      }
      this.restoreTimeseriesDisplayOnEnter()
    },
    async setTimeseriesTab(tab) {
      const next = ['population', 'nightlight', 'joint'].includes(String(tab || '').trim())
        ? String(tab || '').trim()
        : 'population'
      if (this.timeseriesActiveTab === next) return
      this.timeseriesActiveTab = next
      await this.computeTimeseriesCurrent()
    },
    onTimeseriesControlsChange() {
      this.computeTimeseriesCurrent()
    },
    getTimeseriesSummaryRows() {
      const payload = this.getCurrentTimeseriesPayload()
      const layer = (payload && payload.layer) || {}
      const summary = layer.summary || {}
      if (!payload) return []
      if (this.timeseriesActiveTab === 'joint') {
        const counts = summary.class_counts || {}
        return [
          { key: 'up_up', label: '人口增夜光增', value: `${Math.round(toNumber(counts.pop_up_light_up, 0))}` },
          { key: 'up_down', label: '人口增夜光降', value: `${Math.round(toNumber(counts.pop_up_light_down, 0))}` },
          { key: 'down_up', label: '人口降夜光增', value: `${Math.round(toNumber(counts.pop_down_light_up, 0))}` },
          { key: 'stable', label: '基本稳定', value: `${Math.round(toNumber(counts.joint_stable, 0))}` },
        ]
      }
      return [
        { key: 'cell_count', label: '格网数', value: `${Math.round(toNumber(summary.cell_count, 0))}` },
        { key: 'increase', label: '增长格网', value: `${Math.round(toNumber(summary.increase_count, 0))}` },
        { key: 'decrease', label: '下降格网', value: `${Math.round(toNumber(summary.decrease_count, 0))}` },
        { key: 'average_rate', label: '平均变化率', value: this.formatTimeseriesPercent(summary.average_rate) },
      ]
    },
    getTimeseriesLegendGradientStyle() {
      const payload = this.getCurrentTimeseriesPayload()
      const stops = (((payload && payload.layer && payload.layer.legend && payload.layer.legend.stops) || [])
        .filter((item) => item && item.color))
      if (!stops.length) return {}
      return {
        background: `linear-gradient(90deg, ${stops.map((item) => `${item.color} ${Math.round(toNumber(item.ratio, 0) * 100)}%`).join(', ')})`,
      }
    },
    getTimeseriesSeriesRows() {
      const payload = this.getCurrentTimeseriesPayload()
      return Array.isArray(payload && payload.series) ? payload.series : []
    },
    getTimeseriesInsights() {
      const payload = this.getCurrentTimeseriesPayload()
      return Array.isArray(payload && payload.insights) ? payload.insights : []
    },
  }
}

export {
  createAnalysisTimeseriesInitialState,
  createAnalysisTimeseriesMethods,
}
