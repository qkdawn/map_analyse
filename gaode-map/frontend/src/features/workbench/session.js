    function createAnalysisWorkbenchSessionMethods() {
        return {
            clearAnalysisLayers() {
                if (this.abortController) {
                    this.abortController.abort();
                    this.abortController = null;
                }
                this.cancelHistoryDetailLoading();
                this.isFetchingPois = false;
                this.fetchProgress = 0;
                this.poiStatus = '';
                this.roadSyntaxStatus = '';
                this.resetFetchSubtypeProgress();
                this.allPoisDetails = [];
                this.poiSubTab = 'category';
                this.poiAnalysisSubTab = 'kde';
                this.poiKdeEnabled = false;
                this.poiKdeStats = this.createEmptyPoiKdeStats();
                this.populationSubTab = 'analysis';
                this.scopeSource = '';
                this.currentHistoryRecordId = '';
                this.currentHistoryPolygonWgs84 = [];
                this.drawnScopePolygon = [];
                this.lastIsochroneGeoJSON = null;
                this.h3GridStatus = '';
                this.h3GridCount = 0;
                this.h3GridFeatures = [];
                this.isGeneratingGrid = false;
                this.resetH3AnalysisState();
                this.resetPopulationAnalysisState({ keepMeta: true, keepYear: true });
                this.resetNightlightAnalysisState({ keepMeta: true, keepYear: true });
                if (typeof this.resetGwrAnalysisState === 'function') this.resetGwrAnalysisState();
                this.clearIsochroneDebugState();
                this.clearPoiOverlayLayers({
                    reason: 'clear_analysis_layers',
                    clearManager: true,
                    clearSimpleMarkers: true,
                    resetFilterPanel: true,
                });
                this.clearPoiKdeOverlay();
                this.resetRoadSyntaxState();
                this.disposePopulationCharts();

                if (this.mapCore) {
                    if (this.mapCore.clearGridPolygons) {
                        this.mapCore.clearGridPolygons();
                    }
                    if (this.mapCore.clearPopulationRasterOverlay) {
                        this.mapCore.clearPopulationRasterOverlay();
                    }
                    this.mapCore.setRadius(0);
                }
                this.clearScopeOutlineDisplay();
                this.stopScopeDrawing();
                this.disposePoiChart();
            },
            resetAnalysis() {
                this.destroyPlaceSearch();
                this.step = 1;
                this.isochroneScopeMode = 'point';
                this.h3SimplifyMenuOpen = false;
                this.h3SimplifyTargets = typeof this.getDefaultSimplifyTargets === 'function'
                    ? this.getDefaultSimplifyTargets()
                    : ['map', 'isochrone', 'drawn_polygon', 'poi'];
                this.h3SimplifyTargetsInitialized = false;
                this.clearIsochroneDebugState();
                this.sidebarView = 'wizard';
                this.selectedPoint = null;
                this.errorMessage = '';
                this.lastNonAgentStep3Panel = 'poi';
                if (this.marker) {
                    this.safeMapSet(this.marker, null);
                    this.marker = null;
                }
                this.clearAnalysisLayers();
                if (this.mapCore && this.mapCore.map) {
                    this.mapCore.map.setFitView();
                }
                this.applySimplifyConfig();
            },
            openAgentWorkspace() {
                this.sidebarView = 'wizard';
                this.step = 2;
                if (typeof this.selectStep3Panel === 'function') {
                    this.selectStep3Panel('agent');
                } else {
                    this.activeStep3Panel = 'agent';
                    if (typeof this.ensureAgentPanelReady === 'function') {
                        this.ensureAgentPanelReady();
                    }
                }
            },
            saveAndRestart() {
                this.destroyPlaceSearch();
                this.stopScopeDrawing();
                this.cancelHistoryDetailLoading();
                this.clearIsochroneDebugState();
                this.step = 1;
                this.activeStep3Panel = 'poi';
                this.lastNonAgentStep3Panel = 'poi';
                this.isochroneScopeMode = 'point';
                this.h3SimplifyMenuOpen = false;
                this.h3SimplifyTargets = typeof this.getDefaultSimplifyTargets === 'function'
                    ? this.getDefaultSimplifyTargets()
                    : ['map', 'isochrone', 'drawn_polygon', 'poi'];
                this.h3SimplifyTargetsInitialized = false;
                this.poiSystemSuspendedForSyntax = false;
                this.selectedPoint = null;
                this.errorMessage = '';
                this.poiStatus = '';
                this.allPoisDetails = [];
                this.poiSubTab = 'category';
                this.poiAnalysisSubTab = 'kde';
                this.poiKdeEnabled = false;
                this.poiKdeStats = this.createEmptyPoiKdeStats();
                this.populationSubTab = 'analysis';
                this.resultDataSource = this.normalizePoiSource(this.poiDataSource, 'local');
                this.scopeSource = '';
                this.currentHistoryRecordId = '';
                this.currentHistoryPolygonWgs84 = [];
                this.drawnScopePolygon = [];
                this.lastIsochroneGeoJSON = null;
                this.h3ExportMenuOpen = false;
                if (this.h3ToastTimer) {
                    clearTimeout(this.h3ToastTimer);
                    this.h3ToastTimer = null;
                }
                this.h3Toast = { message: '', type: 'info' };
                this.clearPoiOverlayLayers({
                    reason: 'save_and_restart',
                    clearManager: true,
                    clearSimpleMarkers: true,
                    clearCenterMarker: true,
                    resetFilterPanel: true,
                });
                this.clearPoiKdeOverlay();
                this.clearH3Grid();
                this.resetPopulationAnalysisState({ keepMeta: true, keepYear: true });
                this.resetNightlightAnalysisState({ keepMeta: true, keepYear: true });
                if (typeof this.resetGwrAnalysisState === 'function') this.resetGwrAnalysisState();
                this.clearScopeOutlineDisplay();
                this.disposePoiChart();
                this.disposePopulationCharts();
                this.applySimplifyConfig();
            },
        };
    }

export { createAnalysisWorkbenchSessionMethods };
