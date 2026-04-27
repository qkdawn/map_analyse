function createAnalysisPoiFlowOrchestratorMethods() {
  return {
    async fetchPois(options = {}) {
      if (!this.lastIsochroneGeoJSON) return
      const preserveCurrentPanel = !!(options && options.preserveCurrentPanel)
      this.isFetchingPois = true
      this.fetchProgress = 0
      this.poiStatus = '准备抓取...'
      this.resetRoadSyntaxState()
      this.resetFetchSubtypeProgress()

      this.clearPoiOverlayLayers({
        reason: 'fetch_pois_start',
        clearManager: true,
        clearSimpleMarkers: true,
        resetFilterPanel: true,
      })
      this.allPoisDetails = []

      try {
        const polygon = this.getIsochronePolygonPayload()

        // Get selected categories (derived from selected subtypes).
        const selectedCats = this.buildSelectedCategoryBuckets()
        if (selectedCats.length === 0) {
          alert('请至少选择一个分类')
          this.isFetchingPois = false
          return
        }

        let totalFetched = 0
        const totalCats = selectedCats.length
        const fetchErrors = []
        if (selectedCats[0]) {
          this.updateFetchSubtypeProgressDisplay(selectedCats[0])
        }

        // Parallel Fetching: process in batches.
        this.abortController = new AbortController()
        const batchSize = 4
        const poiSelection = this.resolvePoiYearSourceSelection(this.poiYearSource)
        const sourceLabel = this.getPoiSourceLabel(poiSelection.source, poiSelection.year)
        this.poiStatus = `正在并行抓取 ${totalCats} 个分类（每批 ${batchSize} 个，${sourceLabel}）...`
        this.poiDataSource = poiSelection.source
        this.resultDataSource = poiSelection.source
        this.resultPoiYear = poiSelection.year

        const fetchOneCategory = async (cat) => {
          const payload = {
            polygon,
            keywords: '',
            types: String(cat.types || ''),
            source: poiSelection.source,
            year: poiSelection.year,
            save_history: false, // Don't save individual batches
            center: [this.selectedPoint.lng, this.selectedPoint.lat],
            time_min: parseInt(this.timeHorizon),
            mode: this.transportMode,
            location_name: this.selectedPoint.name || (this.selectedPoint.lng.toFixed(4) + ',' + this.selectedPoint.lat.toFixed(4)),
          }

          try {
            const res = await fetch('/api/v1/analysis/pois', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: this.abortController.signal,
            })
            if (!res.ok) {
              let detail = ''
              try {
                detail = await res.text()
              } catch (_) { }
              return {
                list: [],
                error: `HTTP ${res.status}${detail ? ` ${detail.slice(0, 240)}` : ''}`,
              }
            }
            const data = await res.json()
            return { list: data.pois || [], error: '' }
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.warn(`Failed to fetch category ${cat.name}`, err)
            }
            return {
              list: [],
              error: err && err.message ? String(err.message) : String(err),
            }
          }
        }

        for (let i = 0; i < selectedCats.length; i += batchSize) {
          if (this.abortController.signal.aborted) return
          const batch = selectedCats.slice(i, i + batchSize)
          const resultsArray = await Promise.all(batch.map(fetchOneCategory))
          resultsArray.forEach((result, index) => {
            const list = Array.isArray(result && result.list) ? result.list : []
            if (list && list.length) this.allPoisDetails.push(...list)
            const cat = batch[index]
            if (cat && result && result.error) {
              fetchErrors.push({
                category: cat.name || cat.id || `cat_${i + index + 1}`,
                error: result.error,
              })
            }
            if (cat) {
              this.accumulateFetchSubtypeHits(cat, list || [])
            }
          })

          totalFetched = this.allPoisDetails.length
          const done = Math.min(i + batch.length, totalCats)
          this.fetchProgress = Math.round((done / totalCats) * 100)
          this.poiStatus = `已完成 ${done}/${totalCats} 分类，累计 ${totalFetched} 个结果`
        }

        if (this.abortController.signal.aborted) return

        this.allPoisDetails = this.deduplicateFetchedPois(this.allPoisDetails)
        totalFetched = this.allPoisDetails.length
        this.fetchProgress = 100
        if (totalFetched === 0 && fetchErrors.length > 0) {
          const first = fetchErrors[0]
          throw new Error(`本地源请求失败（${fetchErrors.length}/${totalCats} 分类）。示例：${first.category} -> ${first.error}`)
        }
        this.poiStatus = ''
        if (fetchErrors.length > 0) {
          console.warn('[poi-fetch] partial category failures', fetchErrors)
          this.poiStatus = `抓取完成，但有 ${fetchErrors.length} 个分类失败（详见控制台）`
        }

        // Integration with Legacy Filter Panel (single render path).
        this.rebuildPoiRuntimeSystem(this.allPoisDetails)

        if (preserveCurrentPanel) {
          this.updatePoiCharts()
          this.resizePoiChart()
        } else {
          setTimeout(() => {
            this.activeStep3Panel = 'poi'
            this.lastNonAgentStep3Panel = 'poi'
            if (typeof this.resetAnalysisDisplayTargetsForPanel === 'function') {
              this.resetAnalysisDisplayTargetsForPanel('poi', { apply: false })
            }
            this.applySimplifyConfig()
            this.updatePoiCharts()
            this.resizePoiChart()
          }, 120)
        }
        this.saveAnalysisHistoryAsync(polygon, selectedCats, this.allPoisDetails)
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error(e)
          this.poiStatus = `失败: ${e.message}`
        }
      } finally {
        this.isFetchingPois = false
        this.abortController = null
        this.resetFetchSubtypeProgress()
      }
    },
    resolvePoiYearSourceSelection(value) {
      const year = Number(value || 2020)
      if (year === 2026) {
        return { source: 'gaode', year: 2026 }
      }
      if (year === 2022 || year === 2024) {
        return { source: 'local', year }
      }
      return { source: 'local', year: 2020 }
    },
    computePoiStats(points) {
      const labels = this.poiCategories.map((c) => c.name)
      const colors = this.poiCategories.map((c) => c.color || '#888')
      const values = this.poiCategories.map(() => 0)
      const indexMap = {}
      this.poiCategories.forEach((c, idx) => {
        indexMap[c.id] = idx
      })
      ;(points || []).forEach((p) => {
        const cid = this.resolvePoiCategoryId(p && p.type)
        if (!cid) return
        const idx = indexMap[cid]
        if (Number.isInteger(idx) && idx >= 0) values[idx] += 1
      })
      return { labels, colors, values }
    },
    getPoiCategoryChartStats() {
      const source = Array.isArray(this.allPoisDetails) && this.allPoisDetails.length
        ? this.allPoisDetails
        : ((this.markerManager && typeof this.markerManager.getVisiblePoints === 'function')
            ? this.markerManager.getVisiblePoints()
            : [])
      return this.computePoiStats(source)
    },
    updatePoiCharts() {
      if (!Array.isArray(this.allPoisDetails) || !this.allPoisDetails.length) return
      if (this.activeStep3Panel === 'poi' && this.poiSubTab !== 'category') {
        this.refreshPoiKdeOverlay()
        return
      }

      const el = document.getElementById('poiChart')
      if (!el || !window.echarts) return

      // If chart already exists and is visible, update immediately for smooth animation (restores transition)
      const existingChart = echarts.getInstanceByDom(el)
      if (existingChart && el.clientWidth > 0) {
        this.poiChart = existingChart
        const stats = this.getPoiCategoryChartStats()
        const safeValues = stats.values.map((v) => (Number.isFinite(v) ? v : 0))

        const option = {
          yAxis: {
            type: 'category',
            inverse: true,
            data: stats.labels,
          },
          series: [{
            data: safeValues,
            itemStyle: {
              color: (params) => stats.colors[params.dataIndex] || '#888',
            },
          }],
        }
        existingChart.setOption(option, false) // Merge for animation
        this.refreshPoiKdeOverlay()
        return
      }

      // Otherwise, delay slightly for initial rendering (result panels use v-show)
      setTimeout(() => {
        const chart = this.initPoiChart()
        if (!chart) return

        const stats = this.getPoiCategoryChartStats()
        const safeValues = stats.values.map((v) => (Number.isFinite(v) ? v : 0))

        const option = {
          grid: { left: 50, right: 20, top: 10, bottom: 10, containLabel: true },
          xAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: '#eee' } },
          },
          yAxis: {
            type: 'category',
            inverse: true,
            data: stats.labels,
            axisLine: { show: false },
            axisTick: { show: false },
          },
          series: [{
            type: 'bar',
            data: safeValues,
            barWidth: 12,
            itemStyle: {
              color: (params) => stats.colors[params.dataIndex] || '#888',
            },
          }],
        }
        try {
          chart.setOption(option, true)
          chart.resize()
        } catch (err) {
          console.error('ECharts setOption error:', err)
        }
        this.refreshPoiKdeOverlay()
      }, 100)
    },
  }
}

export { createAnalysisPoiFlowOrchestratorMethods }
