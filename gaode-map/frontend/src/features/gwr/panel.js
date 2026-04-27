function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function mixHex(fromHex, toHex, ratio) {
  const parse = (hex) => {
    const safe = String(hex || '').replace('#', '').trim()
    if (!/^[0-9a-fA-F]{6}$/.test(safe)) return { r: 0, g: 0, b: 0 }
    return {
      r: parseInt(safe.slice(0, 2), 16),
      g: parseInt(safe.slice(2, 4), 16),
      b: parseInt(safe.slice(4, 6), 16),
    }
  }
  const format = (item) => `#${[item.r, item.g, item.b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`
  const a = parse(fromHex)
  const b = parse(toHex)
  const t = clamp(toNumber(ratio, 0), 0, 1)
  return format({
    r: a.r + ((b.r - a.r) * t),
    g: a.g + ((b.g - a.g) * t),
    b: a.b + ((b.b - a.b) * t),
  })
}

function createAnalysisGwrInitialState() {
  return {
    isComputingGwr: false,
    gwrStatus: '',
    gwrResult: null,
    gwrMetric: 'local_r2',
    gwrChart: null,
    gwrCoeffChart: null,
  }
}

function createAnalysisGwrMethods() {
  return {
    isGwrPanelActive() {
      return this.step === 2 && this.activeStep3Panel === 'gwr'
    },
    isGwrDisplayActive() {
      return this.step === 2
        && (typeof this.hasSimplifyDisplayTarget === 'function'
          ? this.hasSimplifyDisplayTarget('gwr')
          : this.isGwrPanelActive())
    },
    getGwrMetricOptions() {
      const variables = Array.isArray(this.gwrResult && this.gwrResult.variables)
        ? this.gwrResult.variables
        : []
      const base = [
        { value: 'local_r2', label: '局部 R²' },
        { value: 'residual', label: '残差' },
      ]
      return base.concat(variables.map((item) => ({
        value: `coef_${item.key}`,
        label: `${item.label || item.key} 系数`,
      })))
    },
    getGwrReadinessRows() {
      const poiReady = Array.isArray(this.allPoisDetails) && this.allPoisDetails.length > 0
      const roadReady = Array.isArray(this.roadSyntaxRoadFeatures) && this.roadSyntaxRoadFeatures.length > 0
      const populationReady = !!this.populationGrid || !!this.populationOverview
      const nightlightReady = !!this.nightlightLayer || !!this.nightlightOverview
      return [
        { key: 'poi', label: 'POI', ready: poiReady, text: poiReady ? `${this.allPoisDetails.length} 个点` : '未抓取' },
        { key: 'population', label: '人口格网', ready: populationReady, text: populationReady ? '已就绪' : '未加载' },
        { key: 'nightlight', label: '夜光', ready: nightlightReady, text: nightlightReady ? '已就绪' : '未计算' },
        { key: 'road', label: '路网', ready: roadReady, text: roadReady ? `${this.roadSyntaxRoadFeatures.length} 条线` : '未计算' },
      ]
    },
    canComputeGwr() {
      return !!this.getIsochronePolygonRing()
        && Array.isArray(this.allPoisDetails) && this.allPoisDetails.length > 0
        && Array.isArray(this.roadSyntaxRoadFeatures) && this.roadSyntaxRoadFeatures.length > 0
        && !this.isComputingGwr
    },
    getGwrBlockingText() {
      if (!this.getIsochronePolygonRing()) return '请先生成分析范围'
      if (!Array.isArray(this.allPoisDetails) || !this.allPoisDetails.length) return '请先完成 POI 抓取'
      if (!Array.isArray(this.roadSyntaxRoadFeatures) || !this.roadSyntaxRoadFeatures.length) return '请先完成路网分析'
      return ''
    },
    formatGwrNumber(value, digits = 3) {
      const num = Number(value)
      if (!Number.isFinite(num)) return '-'
      return num.toFixed(digits)
    },
    getGwrSummaryRows() {
      const summary = (this.gwrResult && this.gwrResult.summary) || {}
      return [
        { key: 'r2', label: '整体 R²', value: this.formatGwrNumber(summary.r2, 3) },
        { key: 'sample_count', label: '样本格数', value: `${Math.round(toNumber(summary.sample_count, 0))}` },
        { key: 'rmse', label: 'RMSE', value: this.formatGwrNumber(summary.rmse, 2) },
        { key: 'engine', label: '引擎', value: String(summary.engine || '-') },
      ]
    },
    getGwrTopVariables() {
      const rows = ((this.gwrResult && this.gwrResult.summary && this.gwrResult.summary.top_variables) || [])
      return Array.isArray(rows) ? rows.slice(0, 5) : []
    },
    resetGwrAnalysisState() {
      this.isComputingGwr = false
      this.gwrStatus = ''
      this.gwrResult = null
      this.gwrMetric = 'local_r2'
      this.clearGwrDisplayOnLeave()
      this.disposeGwrCharts()
    },
    clearGwrDisplayOnLeave() {
      if (this.mapCore && typeof this.mapCore.clearGridPolygons === 'function') {
        this.mapCore.clearGridPolygons()
      }
    },
    restoreGwrDisplayOnEnter() {
      if (!this.isGwrDisplayActive()) return
      this.applyGwrGridToMap()
    },
    resolveGwrFeatureStyle(value, metric) {
      const isResidual = String(metric || '') === 'residual'
      if (!Number.isFinite(Number(value))) {
        return { color: '#eef2f7', opacity: 0.14 }
      }
      const num = Number(value)
      if (isResidual) {
        const values = ((this.gwrResult && this.gwrResult.cells) || [])
          .map((cell) => Math.abs(toNumber(cell && cell.residual, 0)))
          .filter((item) => Number.isFinite(item))
        const maxAbs = Math.max(1e-9, ...values)
        const ratio = clamp(Math.abs(num) / maxAbs, 0, 1)
        return {
          color: num >= 0 ? mixHex('#f8fafc', '#b91c1c', ratio) : mixHex('#f8fafc', '#1d4ed8', ratio),
          opacity: 0.22 + (0.5 * ratio),
        }
      }
      if (String(metric || '').startsWith('coef_')) {
        const key = String(metric).slice(5)
        const values = ((this.gwrResult && this.gwrResult.cells) || [])
          .map((cell) => Math.abs(toNumber(cell && cell.coefficients && cell.coefficients[key], 0)))
        const maxAbs = Math.max(1e-9, ...values)
        const ratio = clamp(Math.abs(num) / maxAbs, 0, 1)
        return {
          color: num >= 0 ? mixHex('#f8fafc', '#0f766e', ratio) : mixHex('#f8fafc', '#c2410c', ratio),
          opacity: 0.18 + (0.48 * ratio),
        }
      }
      const ratio = clamp(num, 0, 1)
      return { color: mixHex('#f8fafc', '#7c3aed', ratio), opacity: 0.18 + (0.5 * ratio) }
    },
    buildGwrStyledFeatures() {
      const fc = (this.gwrResult && this.gwrResult.feature_collection) || {}
      const features = Array.isArray(fc.features) ? fc.features : []
      const metric = String(this.gwrMetric || 'local_r2')
      return features.map((feature) => {
        const props = Object.assign({}, (feature && feature.properties) || {})
        let value = props.gwr_local_r2
        if (metric === 'residual') value = props.gwr_residual
        if (metric.startsWith('coef_')) value = props[`gwr_coef_${metric.slice(5)}`]
        const style = this.resolveGwrFeatureStyle(value, metric)
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: Object.assign({}, props, {
            fillColor: style.color,
            fillOpacity: style.opacity,
            strokeColor: '#ffffff',
            strokeWeight: 0.9,
          }),
        }
      })
    },
    applyGwrGridToMap() {
      if (!this.mapCore) return
      const features = this.buildGwrStyledFeatures()
      if (!features.length) {
        if (typeof this.mapCore.clearGridPolygons === 'function') this.mapCore.clearGridPolygons()
        return
      }
      if (typeof this.mapCore.setGridFeatures === 'function') {
        this.mapCore.setGridFeatures(features, {
          strokeColor: '#ffffff',
          strokeWeight: 0.9,
          fillColor: '#f8fafc',
          fillOpacity: 0.2,
          clickable: false,
          webglBatch: true,
        })
      }
    },
    onGwrMetricChange() {
      this.applyGwrGridToMap()
    },
    async ensureGwrPanelEntryState() {
      const rawRing = this.getIsochronePolygonRing()
      if (!rawRing) {
        this.gwrStatus = ''
        return
      }
      try {
        await this.loadPopulationMeta(false)
        await this.loadNightlightMeta(false)
        await this.ensurePopulationBaseGrid(false)
        await this.ensureNightlightBaseGrid(false)
      } catch (e) {
        this.gwrStatus = 'GWR 数据准备失败: ' + (e && e.message ? e.message : String(e))
        return
      }
      if (this.gwrResult) {
        this.restoreGwrDisplayOnEnter()
        this.$nextTick(() => this.updateGwrCharts())
      } else {
        this.gwrStatus = this.getGwrBlockingText() || '数据已就绪，可以计算 GWR'
      }
    },
    async computeGwrAnalysis() {
      const block = this.getGwrBlockingText()
      if (block || this.isComputingGwr) {
        this.gwrStatus = block
        return
      }
      this.isComputingGwr = true
      this.gwrStatus = '正在准备统一格网与夜光指标...'
      try {
        await this.ensurePopulationBaseGrid(false)
        await this.ensureNightlightBaseGrid(false)
        const polygon = this.getIsochronePolygonPayload()
        this.gwrStatus = '正在调用 ArcGIS GWR...'
        const res = await fetch('/api/v1/analysis/gwr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polygon,
            coord_type: 'gcj02',
            population_year: this.getPopulationSelectedYear(),
            nightlight_year: Number(this.nightlightSelectedYear || 0) || null,
            pois: this.allPoisDetails || [],
            poi_coord_type: 'gcj02',
            road_features: this.roadSyntaxRoadFeatures || [],
            arcgis_timeout_sec: 240,
          }),
        })
        if (!res.ok) {
          let detail = ''
          try { detail = await res.text() } catch (_) {}
          throw new Error(detail || 'GWR 请求失败')
        }
        const data = await res.json()
        this.gwrResult = data
        const summary = (data && data.summary) || {}
        this.gwrStatus = summary.ok
          ? `GWR 计算完成，样本 ${summary.sample_count || 0} 格`
          : String(summary.status || data.engine_status || 'GWR 未生成结果')
        if (this.isGwrDisplayActive()) this.applyGwrGridToMap()
        this.$nextTick(() => this.updateGwrCharts())
      } catch (e) {
        console.error(e)
        this.gwrStatus = 'GWR 计算失败: ' + (e && e.message ? e.message : String(e))
      } finally {
        this.isComputingGwr = false
      }
    },
    disposeGwrCharts() {
      if (this.gwrChart && typeof this.gwrChart.dispose === 'function') this.gwrChart.dispose()
      if (this.gwrCoeffChart && typeof this.gwrCoeffChart.dispose === 'function') this.gwrCoeffChart.dispose()
      this.gwrChart = null
      this.gwrCoeffChart = null
    },
    updateGwrCharts() {
      if (!window.echarts || !this.gwrResult) return
      const scatterEl = document.getElementById('gwrScatterChart')
      const coeffEl = document.getElementById('gwrCoeffChart')
      const cells = Array.isArray(this.gwrResult.cells) ? this.gwrResult.cells : []
      if (scatterEl) {
        const chart = echarts.getInstanceByDom(scatterEl) || echarts.init(scatterEl)
        this.gwrChart = chart
        chart.setOption({
          animationDuration: 240,
          grid: { left: 46, right: 12, top: 24, bottom: 36, containLabel: true },
          tooltip: { trigger: 'item' },
          xAxis: { type: 'value', name: '实测夜光', axisLabel: { color: '#6b7280' } },
          yAxis: { type: 'value', name: '预测夜光', axisLabel: { color: '#6b7280' } },
          series: [{
            type: 'scatter',
            symbolSize: 7,
            itemStyle: { color: '#2563eb', opacity: 0.72 },
            data: cells
              .map((cell) => [toNumber(cell.observed, NaN), toNumber(cell.predicted, NaN)])
              .filter((item) => Number.isFinite(item[0]) && Number.isFinite(item[1])),
          }],
        }, true)
      }
      if (coeffEl) {
        const chart = echarts.getInstanceByDom(coeffEl) || echarts.init(coeffEl)
        this.gwrCoeffChart = chart
        const rows = this.getGwrTopVariables()
        chart.setOption({
          animationDuration: 240,
          grid: { left: 86, right: 12, top: 20, bottom: 24, containLabel: true },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'value', axisLabel: { color: '#6b7280' } },
          yAxis: {
            type: 'category',
            data: rows.map((item) => item.label || item.key),
            axisLabel: { color: '#6b7280' },
          },
          series: [{
            type: 'bar',
            data: rows.map((item) => toNumber(item.mean_abs_coefficient, 0)),
            itemStyle: { color: '#0f766e' },
            barMaxWidth: 18,
          }],
        }, true)
      }
    },
  }
}

export { createAnalysisGwrInitialState, createAnalysisGwrMethods }
