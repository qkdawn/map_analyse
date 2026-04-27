function createAnalysisPoiMapVisibilityAdapterMethods() {
  return {
    clearScopePolygonsFromMap() {
      if (this.mapCore && typeof this.mapCore.clearCustomPolygons === 'function') {
        this.mapCore.clearCustomPolygons()
      }
    },
    clearCenterMarkerOverlay() {
      if (!this.marker) return
      this.safeMapSet(this.marker, null)
      this.marker = null
    },
    applyPoiVisualState(payload = {}) {
      const shouldShowPoi = !!payload.shouldShowPoi
      const hidePoi = !shouldShowPoi

      if (this.markerManager && typeof this.markerManager.setHideAllPoints === 'function') {
        this.pointLayersSuspendedForSyntax = !shouldShowPoi
        if (hidePoi && typeof this.markerManager.destroyClusterers === 'function') {
          this.markerManager.destroyClusterers({ immediate: true })
        }
        if (typeof this.markerManager.setShowMarkers === 'function') {
          this.markerManager.setShowMarkers(shouldShowPoi)
        }
        this.markerManager.setHideAllPoints(hidePoi)
        this.applyPoiFilterPanel('simplify_visibility')
      }

      if (this.marker) {
        if (hidePoi) {
          this.safeMapSet(this.marker, null)
        } else if (this.selectedPoint && this.mapCore && this.mapCore.map) {
          this.safeMapSet(this.marker, this.mapCore.map)
        }
      }

      if (Array.isArray(this.poiMarkers) && this.poiMarkers.length > 0) {
        const stalePoiMarkers = this.poiMarkers.slice()
        this.poiMarkers = []
        this.enqueuePoiMapWrite(() => {
          stalePoiMarkers.forEach((m) => this.safeMapSet(m, null))
          return { ok: true, hidden: stalePoiMarkers.length }
        }, {
          key: 'clear_stale_simple_markers',
          replaceExisting: true,
          meta: {
            reason: 'clear_stale_simple_markers',
            marker_count: stalePoiMarkers.length,
          },
        })
      }
    },
  }
}

export { createAnalysisPoiMapVisibilityAdapterMethods }
