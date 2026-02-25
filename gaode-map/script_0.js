
        const { createApp } = Vue;
        const INJECTED_TYPE_MAP_CONFIG = {{ map_type_config_json | safe }} || { groups: [] };
        const ROAD_SYNTAX_CONST = Object.freeze({
            SWITCH_TARGET_MS: 120,
            PREBUILD_DEADLINE_MS: 120000,
            CONNECTIVITY_NODE_MIN_ZOOM: 15,
            SWITCH_SAMPLE_LIMIT: 40,
            BUILD_BUDGET_MS: Object.freeze({
                interacting: 0.8,
                init: 6.0,
                steady: 4.0,
                lineFallbackSmall: 12.0,
                lineFallbackLarge: 8.0,
                node: 6.5,
            }),
        });
        const roadSyntaxUiMethods = (window.createRoadSyntaxUiMethods && typeof window.createRoadSyntaxUiMethods === 'function')
            ? window.createRoadSyntaxUiMethods(ROAD_SYNTAX_CONST)
            : {};

        createApp({
            data() {
                return {
                    loadingConfig: true,
                    config: null,

                    // State
                    step: 1, // Wizard Step
                    sidebarView: 'start', // 'start', 'wizard', 'history'
                    selectedPoint: null, // {lng, lat}
                    transportMode: 'walking',
                    timeHorizon: 15,
                    captureTarget: 'poi', // poi | aoi
                    isCalculating: false,
                    errorMessage: '',
                    basemapSource: 'amap',
                    tdtDiag: null,
                    tdtDiagCopyStatus: '',

                    // POI Data
                    poiKeywords: '', // Not used if using categories, but kept for custom
                    typeMapConfig: INJECTED_TYPE_MAP_CONFIG,
                    typeMapGroups: [],
                    typeCodeToCategoryId: {},
                    typePrefixToCategoryId: {},
                    typeCodeToTypeId: {},
                    typePrefixToTypeId: {},
                    typeIdToGroupId: {},
                    typeIdToLabel: {},
                    categoryById: {},
                    poiCategories: [],
                    poiSubSelectionState: {},
                    expandedPoiCategoryId: null,
                    step3NavItems: [
                        { id: 'poi', label: 'POI', title: 'POI 点数据分析' },
                        { id: 'h3', label: '网格', title: '网格分析' },
                        { id: 'syntax', label: '路网', title: '空间句法路网分析' },
                        { id: 'aoi', label: 'AOI', title: 'AOI 面数据分析' }
                    ],
                    activeStep3Panel: 'poi',
                    dragIndex: null,
                    dragOverIndex: null,
                    dragInsertPosition: null,
                    isDraggingNav: false,
                    isFetchingPois: false,
                    isFetchingAois: false,
                    fetchProgress: 0,
                    poiStatus: '',
                    aoiStatus: '',
                    isComputingRoadSyntax: false,
                    roadSyntaxStatus: '',
                    roadSyntaxPerformanceProfile: 'fixed1200',
                    roadSyntaxActiveEdgeCap: 1200,
                    roadSyntaxSwitchSamples: [],
                    roadSyntaxSwitchLastMs: 0,
                    roadSyntaxSwitchP50Ms: 0,
                    roadSyntaxSwitchP95Ms: 0,
                    roadSyntaxSwitchTargetMs: ROAD_SYNTAX_CONST.SWITCH_TARGET_MS,
                    roadSyntaxSwitchStatsText: '',
                    roadSyntaxSwitchPath: '',
                    roadSyntaxSwitchInProgress: false,
                    roadSyntaxSwitchQueuedLayerKey: '',
                    roadSyntaxSwitchLastAt: 0,
                    roadSyntaxSwitchCooldownMs: 80,
                    roadSyntaxSwitchThrottleTimer: null,
                    roadSyntaxStyleApplyToken: 0,
                    fetchSubtypeHitMap: {},
                    fetchSubtypeProgress: {
                        categoryId: '',
                        categoryName: '',
                        typeNamesPreview: [],
                        typeNamesFullCount: 0,
                        hiddenTypeCount: 0,
                    },
                    lastIsochroneGeoJSON: null,
                    poiMarkers: [],
                    aoiMarkers: [],
                    roadSyntaxPolylines: [],
                    roadSyntaxPolylineItems: [],
                    roadSyntaxLayerPool: {},
                    roadSyntaxLayerStyleCache: {},
                    roadSyntaxActiveLayerKey: '',
                    roadSyntaxPoolWarmToken: 0,
                    roadSyntaxSourceFingerprint: '',
                    roadSyntaxPoolRadiusLabel: '',
                    roadSyntaxLayerBuildState: {},
                    roadSyntaxLayerBuildQueue: [],
                    roadSyntaxLayerBuildRunning: false,
                    roadSyntaxLayerBuildToken: 0,
                    roadSyntaxLayerSwitchToken: 0,
                    roadSyntaxPendingLayerKey: '',
                    roadSyntaxPoolInitRunning: false,
                    roadSyntaxPoolReady: false,
                    roadSyntaxPoolDegraded: false,
                    roadSyntaxPoolInitTotal: 0,
                    roadSyntaxPoolInitDone: 0,
                    roadSyntaxPrebuildDeadlineMs: ROAD_SYNTAX_CONST.PREBUILD_DEADLINE_MS,
                    roadSyntaxEnableHeavyPrewarm: false,
                    roadSyntaxPrewarmToken: 0,
                    roadSyntaxLayerReadyMap: {},
                    roadSyntaxConnectivityReuseLayerKey: '',
                    roadSyntaxNodeBuildToken: 0,
                    roadSyntaxNodeBuildRunning: false,
                    roadSyntaxNodeSourceFingerprint: '',
                    roadSyntaxConnectivityNodeMinZoom: ROAD_SYNTAX_CONST.CONNECTIVITY_NODE_MIN_ZOOM,
                    roadSyntaxZoomListener: null,
                    roadSyntaxZoomStartListener: null,
                    roadSyntaxMoveStartListener: null,
                    roadSyntaxMoveEndListener: null,
                    roadSyntaxMapInteracting: false,
                    roadSyntaxNodeMarkers: [],
                    roadSyntaxStyleUpdateToken: 0,
                    roadSyntaxLastStyleKey: '',
                    roadSyntaxRequestToken: 0,
                    roadSyntaxRoadFeatures: [],
                    roadSyntaxNodes: [],
                    roadSyntaxDiagnostics: null,
                    roadSyntaxSkeletonOnly: false,
                    roadSyntaxLegendModel: null,
                    roadSyntaxScatterChart: null,
                    allPoisDetails: [], // Store full fetched data for client-side filtering
                    allAoisDetails: [],
                    roadSyntaxMainTab: 'params',
                    roadSyntaxTabs: [
                        { value: 'params', label: '参数' },
                        { value: 'accessibility', label: '可达性' },
                        { value: 'connectivity', label: '连接度' },
                        { value: 'choice', label: '选择度' },
                        { value: 'integration', label: '整合度' },
                        { value: 'intelligibility', label: '可理解度' },
                    ],
                    roadSyntaxSummary: null,
                    roadSyntaxMode: 'walking',
                    roadSyntaxMetric: 'accessibility',
                    roadSyntaxLastMetricTab: 'accessibility',
                    roadSyntaxRadiusLabel: 'global',
                    roadSyntaxStatusCopyHint: '',
                    roadSyntaxDisplaySuspended: false,
                    roadSyntaxVisibleLineSet: {},
                    roadSyntaxViewportLazyEnabled: true,
                    roadSyntaxVisibleIndexCacheKey: '',
                    roadSyntaxVisibleIndexCacheList: [],
                    roadSyntaxViewportRefreshRaf: null,
                    roadSyntaxViewportRefreshTimer: null,
                    roadSyntaxViewportRefreshToken: 0,
                    roadSyntaxNodeRefreshTimer: null,
                    roadSyntaxRefineDelayMs: 150,
                    roadSyntaxInteractionLowFidelity: false,
                    roadSyntaxLodScoreCacheKey: '',
                    roadSyntaxLodScoreList: [],
                    roadSyntaxInteractionStride: 3,
                    roadSyntaxCurrentStride: 1,
                    aoiH3Resolution: 9,
                    aoiRegeoRadius: 1000,
                    aoiMaxPoints: 300,
                    aoiSamplePoints: 0,
                    aoiTotalCalls: 0,
                    poiChart: null,
                    poiChartResizeHandler: null,

                    // Instances
                    placeSearch: null,
                    placeSearchErrorListener: null,
                    placeSearchLoadingPromise: null,
                    placeSearchBuildToken: 0,

                    // History
                    historyListRaw: [],
                    historyList: [],
                    historyLoading: false,
                    historyLoadedCount: 0,
                    historySkeletonCount: 5,
                    historyHasLoadedOnce: false,
                    historyRenderSessionId: 0,
                    historyRenderRafId: null,
                    historyFetchAbortController: null,
                    isSelectionMode: false,
                    selectedHistoryIds: [],

                    // Control
                    abortController: null,

                    // H3 Grid
                    isGeneratingGrid: false,
                    h3GridStatus: '',
                    h3GridCount: 0,
                    h3GridResolution: 10,
                    h3GridIncludeMode: 'intersects',
                    h3NeighborRing: 1,
                    h3GridMinOverlapRatio: 0.15,
                    h3ParamsSubTab: 'grid',
                    h3ArcgisPythonPath: 'C:\\Python27\\ArcGIS10.7\\python.exe',
                    h3ArcgisImageVersion: 0,
                    h3ArcgisSnapshotLoadError: false,
                    pointSimplifyEnabled: false,
                    h3BasemapMuted: false,
                    h3GridFeatures: [],
                    selectedH3Id: null,
                    isComputingH3Analysis: false,
                    h3AnalysisSummary: null,
                    h3AnalysisCharts: null,
                    h3AnalysisGridFeatures: [],
                    h3MainStage: 'params',
                    h3MainStageLabels: {
                        params: '参数',
                        analysis: '分析',
                        diagnosis: '诊断',
                        evaluate: '评估',
                    },
                    h3MainStageTabs: {
                        params: [],
                        analysis: ['metric_map', 'structure_map'],
                        diagnosis: ['typing', 'lq'],
                        evaluate: ['gap'],
                    },
                    h3SubTabLabels: {
                        metric_map: '密度场',
                        structure_map: '结构图',
                        typing: '功能混合度',
                        lq: '区位商优势（LQ）',
                        gap: '缺口优先区',
                    },
                    h3MetricView: 'density',
                    h3StructureFillMode: 'gi_z',
                    h3Legend: null,
                    h3StructureRenderStats: null,
                    h3EntropyMinPoi: 3,
                    h3SubTab: 'metric_map',
                    h3TargetCategory: '',
                    h3DecisionTopN: 10,
                    h3OnlySignificant: false,
                    h3LqSmoothingAlpha: 0.5,
                    h3CategoryMeta: [],
                    h3GapWeights: { transport: 0.4, life: 0.25, education: 0.2, medical: 0.15 },
                    h3DerivedStats: {
                        structureSummary: null,
                        typingSummary: null,
                        lqSummary: null,
                        gapSummary: null,
                        topCells: {},
                    },
                    h3CategoryChart: null,
                    h3DensityChart: null,
                    h3LqChart: null,
                    h3GapChart: null,
                    h3StructureChart: null,
                    h3ChartsResizeHandler: null,
                    h3ExportMenuOpen: false,
                    h3ExportTasksOpen: false,
                    h3ExportIncludePoi: true,
                    h3ExportScope: 'grid_only',
                    h3PoiFilterCategoryIds: [],
                    isExportingH3: false,
                    h3ExportTasks: [],
                    h3ExportTaskSeq: 0,
                    h3Toast: { message: '', type: 'info' },
                    h3ToastTimer: null,

                }
            },
            async mounted() {
                try {
                    // 1. Initialize config from server-injected variables directly to save an RTT
                    this.config = {
                        amap_js_api_key: "{{ amap_js_api_key }}",
                        amap_js_security_code: "{{ amap_js_security_code }}",
                        tianditu_key: "{{ tianditu_key }}"
                    };
                    this.initializePoiCategoriesFromTypeMap();
                    if (this.basemapSource === 'tianditu') {
                        const tileReady = await this.validateTiandituSource();
                        if (!tileReady) {
                            this.tdtDiagCopyStatus = '';
                        }
                    }

                    // 2. AMap load with timeout to avoid long blocking
                    const amapTimeoutMs = 8000;
                    await Promise.race([
                        this.loadAMapScript(this.config.amap_js_api_key, this.config.amap_js_security_code),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("AMap 加载超时，请检查网络或 Key")), amapTimeoutMs))
                    ]);

                    // 3. Initialize Map after script is ready
                    this.initMap();
                } catch (e) {
                    console.error("Initialization Failed:", e);
                    this.errorMessage = "系统初始化失败: " + e.message;
                } finally {
                    // Preload history in background so opening history panel reads from cache.
                    this.preloadHistoryListInBackground();
                    document.addEventListener('click', this.handleGlobalClick, true);
                    this.loadingConfig = false;
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) overlay.style.display = 'none';
                }
            },
            beforeUnmount() {
                document.removeEventListener('click', this.handleGlobalClick, true);
                this.destroyPlaceSearch();
                this.roadSyntaxDetachMapListeners();
                this.invalidateRoadSyntaxCache('unmount', { resetData: true });
                if (this.h3ToastTimer) {
                    clearTimeout(this.h3ToastTimer);
                    this.h3ToastTimer = null;
                }
                this.cancelHistoryLoading();
                this.disposePoiChart();
                this.disposeH3Charts();
            },
            watch: {
                step(newStep, oldStep) {
                    if (oldStep === 1 && newStep !== 1) {
                        this.destroyPlaceSearch();
                    }
                },
                sidebarView(newView, oldView) {
                    if (oldView === 'history' && newView !== 'history') {
                        this.cancelHistoryLoading();
                    }
                },
                transportMode(newMode, oldMode) {
                    if (!oldMode || newMode === oldMode) return;
                    if (this.roadSyntaxMode === oldMode || !this.roadSyntaxSummary) {
                        this.roadSyntaxMode = newMode || 'walking';
                    }
                    const hasCache = this.roadSyntaxHasCache();
                    if (this.roadSyntaxSummary || hasCache) {
                        this.resetRoadSyntaxState();
                        this.roadSyntaxStatus = '交通方式已切换，请重新计算路网指标';
                    }
                },
                roadSyntaxMode(newMode, oldMode) {
                    if (!oldMode || newMode === oldMode) return;
                    const hasCache = this.roadSyntaxHasCache();
                    if (this.roadSyntaxSummary || hasCache) {
                        this.resetRoadSyntaxState();
                        this.roadSyntaxStatus = '路网交通模式已变更，请重新计算路网指标';
                    }
                },
            },
            methods: {
                ...roadSyntaxUiMethods,
                cancelHistoryLoading() {
                    if (this.historyFetchAbortController) {
                        try {
                            this.historyFetchAbortController.abort();
                        } catch (e) {
                            console.warn('history abort failed', e);
                        }
                        this.historyFetchAbortController = null;
                    }
                    if (this.historyRenderRafId !== null) {
                        window.cancelAnimationFrame(this.historyRenderRafId);
                        this.historyRenderRafId = null;
                    }
                    this.historyRenderSessionId += 1;
                },
                normalizeHistoryRecord(item) {
                    const record = Object.assign({}, item || {});
                    const rawDate = record.created_at;
                    let dateText = String(rawDate || '');
                    if (rawDate) {
                        const d = new Date(rawDate);
                        if (!Number.isNaN(d.getTime())) {
                            dateText = d.toLocaleDateString();
                        }
                    }
                    record._createdDateText = dateText;
                    return record;
                },
                progressiveRenderHistory(sessionId) {
                    if (sessionId !== this.historyRenderSessionId) return;
                    if (!Array.isArray(this.historyListRaw)) {
                        this.historyLoading = false;
                        this.historyRenderRafId = null;
                        return;
                    }
                    if (this.historyLoadedCount >= this.historyListRaw.length) {
                        this.historyLoading = false;
                        this.historyRenderRafId = null;
                        return;
                    }

                    const nextItem = this.historyListRaw[this.historyLoadedCount];
                    this.historyList.push(nextItem);
                    this.historyLoadedCount += 1;

                    this.historyRenderRafId = window.requestAnimationFrame(() => {
                        this.progressiveRenderHistory(sessionId);
                    });
                },
                preloadHistoryListInBackground() {
                    if (this.historyHasLoadedOnce || this.historyLoading) {
                        return;
                    }
                    this.loadHistoryList({ force: true, keepExisting: false, background: true }).catch((err) => {
                        console.warn('History background preload failed', err);
                    });
                },
                openHistoryView() {
                    this.sidebarView = 'history';
                    this.loadHistoryList({ force: false, keepExisting: true, background: false }).catch((err) => {
                        console.warn('History load failed', err);
                    });
                },
                refreshHistoryList() {
                    this.loadHistoryList({ force: true, keepExisting: true }).catch((err) => {
                        console.warn('History refresh failed', err);
                    });
                },
                normalizeTypeCode(value) {
                    const digits = String(value || '').replace(/\D/g, '');
                    return digits.length >= 6 ? digits.slice(0, 6) : digits;
                },
                _normalizeCategoryTitle(value) {
                    return String(value || '').replace(/\s+/g, '').trim();
                },
                _buildDefaultH3CategoryMeta() {
                    const fromTypeMap = (this.typeMapGroups || []).map((group) => ({
                        key: String(group.id || ''),
                        label: String(group.title || group.id || ''),
                    })).filter(item => item.key && item.label);
                    if (fromTypeMap.length) return fromTypeMap;
                    return [
                        { key: 'group-7', label: '餐饮' },
                        { key: 'group-6', label: '购物' },
                        { key: 'group-4', label: '商务住宅' },
                        { key: 'group-3', label: '交通' },
                        { key: 'group-2', label: '旅游' },
                        { key: 'group-13', label: '科教文化' },
                        { key: 'group-10', label: '医疗' },
                    ];
                },
                _resolveDefaultH3TargetCategory() {
                    const categories = Array.isArray(this.h3CategoryMeta) ? this.h3CategoryMeta : [];
                    if (!categories.length) return '';
                    const dining = categories.find(item => this._normalizeCategoryTitle(item.label) === '餐饮');
                    if (dining && dining.key) return dining.key;
                    return String((categories[0] && categories[0].key) || '');
                },
                _ensureH3CategoryState() {
                    if (!Array.isArray(this.h3CategoryMeta) || !this.h3CategoryMeta.length) {
                        this.h3CategoryMeta = this._buildDefaultH3CategoryMeta();
                    }
                    const hasCurrentTarget = (this.h3CategoryMeta || []).some(item => String(item.key) === String(this.h3TargetCategory));
                    if (!hasCurrentTarget) {
                        this.h3TargetCategory = this._resolveDefaultH3TargetCategory();
                    }
                },
                _resolveGapDemandCategoryMap() {
                    const aliases = {
                        transport: '交通',
                        life: '商务住宅',
                        education: '科教文化',
                        medical: '医疗',
                    };
                    const labelToKey = {};
                    (this.h3CategoryMeta || []).forEach((item) => {
                        const normalized = this._normalizeCategoryTitle(item.label);
                        if (!normalized || !item.key || labelToKey[normalized]) return;
                        labelToKey[normalized] = String(item.key);
                    });
                    const mapping = {};
                    const missingTitles = [];
                    Object.entries(aliases).forEach(([weightKey, title]) => {
                        const normalized = this._normalizeCategoryTitle(title);
                        const key = labelToKey[normalized];
                        if (key) {
                            mapping[weightKey] = key;
                        } else {
                            missingTitles.push(title);
                        }
                    });
                    return { mapping, missingTitles };
                },
                initializePoiCategoriesFromTypeMap() {
                    const raw = (this.typeMapConfig && Array.isArray(this.typeMapConfig.groups))
                        ? this.typeMapConfig
                        : { groups: [] };
                    this.typeCodeToCategoryId = {};
                    this.typePrefixToCategoryId = {};
                    this.typeCodeToTypeId = {};
                    this.typePrefixToTypeId = {};
                    this.typeIdToGroupId = {};
                    this.typeIdToLabel = {};
                    const groups = (raw.groups || []).map((group, gi) => {
                        const itemList = Array.isArray(group.items) ? group.items : [];
                        const mergedCodes = [];
                        const seenCodes = new Set();
                        let cardColor = '#888';
                        itemList.forEach((item) => {
                            if (!item || !item.id) return;
                            if (item.color && cardColor === '#888') {
                                cardColor = item.color;
                            }
                            String(item.types || '').split('|').forEach((rawCode) => {
                                const code = this.normalizeTypeCode(rawCode);
                                if (!code || seenCodes.has(code)) return;
                                seenCodes.add(code);
                                mergedCodes.push(code);
                                this.typeCodeToCategoryId[code] = String(group.id || '');
                                this.typeCodeToTypeId[code] = String(item.id || '');
                                if (code.length >= 2 && !this.typePrefixToCategoryId[code.slice(0, 2)]) {
                                    this.typePrefixToCategoryId[code.slice(0, 2)] = String(group.id || '');
                                }
                                if (code.length >= 2 && !this.typePrefixToTypeId[code.slice(0, 2)]) {
                                    this.typePrefixToTypeId[code.slice(0, 2)] = String(item.id || '');
                                }
                            });
                            this.typeIdToGroupId[String(item.id || '')] = String(group.id || '');
                            this.typeIdToLabel[String(item.id || '')] = String(item.label || item.id || '');
                        });

                        return {
                            id: String(group.id || `group-${gi}`),
                            name: String(group.title || group.id || `分类${gi + 1}`),
                            checked: true,
                            color: cardColor,
                            types: mergedCodes.join('|'),
                        };
                    }).filter(g => g.id && g.types);

                    this.typeMapGroups = (raw.groups || []).map((group) => ({
                        ...group,
                        id: String(group.id || ''),
                        title: String(group.title || group.id || ''),
                        items: Array.isArray(group.items) ? group.items.map((item) => ({
                            ...item,
                            id: String(item.id || ''),
                            label: String(item.label || item.id || ''),
                        })) : []
                    })).filter(g => g.id);
                    this.h3CategoryMeta = this._buildDefaultH3CategoryMeta();
                    this.h3TargetCategory = this._resolveDefaultH3TargetCategory();

                    this.poiCategories = groups;
                    if (!this.poiCategories.length) {
                        this.poiCategories = [
                            { id: 'dining', name: '餐饮', checked: true, color: '#f44336', types: '050000' },
                            { id: 'shopping', name: '购物', checked: true, color: '#2196f3', types: '060000' },
                            { id: 'life', name: '生活', checked: true, color: '#ff9800', types: '070000' },
                            { id: 'transport', name: '交通', checked: true, color: '#4caf50', types: '150000' },
                            { id: 'scenic', name: '风景', checked: true, color: '#9c27b0', types: '110000' },
                            { id: 'education', name: '科教', checked: true, color: '#00bcd4', types: '140000' },
                            { id: 'medical', name: '医疗', checked: true, color: '#e91e63', types: '090000' },
                        ];
                        this.poiCategories.forEach((cat) => {
                            this.typeCodeToCategoryId[String(cat.types)] = cat.id;
                            this.typePrefixToCategoryId[String(cat.types).slice(0, 2)] = cat.id;
                            this.typeCodeToTypeId[String(cat.types)] = cat.id;
                            this.typePrefixToTypeId[String(cat.types).slice(0, 2)] = cat.id;
                            this.typeIdToGroupId[cat.id] = cat.id;
                            this.typeIdToLabel[cat.id] = cat.name;
                        });
                    }
                    this.categoryById = {};
                    this.poiCategories.forEach((cat) => {
                        this.categoryById[cat.id] = cat;
                    });
                    this.syncH3PoiFilterSelection(true);
                    this.poiSubSelectionState = {};
                    this.typeMapGroups.forEach((group) => {
                        (group.items || []).forEach((item) => {
                            this.poiSubSelectionState[item.id] = true;
                        });
                    });
                    this.poiCategories.forEach((cat) => this.syncPoiCategorySelection(cat));
                    this.expandedPoiCategoryId = null;
                    this.resetFetchSubtypeProgress();
                },
                resetFetchSubtypeProgress() {
                    this.fetchSubtypeHitMap = {};
                    this.fetchSubtypeProgress = {
                        categoryId: '',
                        categoryName: '',
                        typeNamesPreview: [],
                        typeNamesFullCount: 0,
                        hiddenTypeCount: 0,
                    };
                },
                getPoiTypeLabel(typeId) {
                    const key = String(typeId || '');
                    if (!key) return '';
                    return this.typeIdToLabel[key] || key;
                },
                updateFetchSubtypeProgressDisplay(cat) {
                    const categoryId = String((cat && cat.id) || '');
                    if (!categoryId) return;
                    const typeIds = Object.keys(this.fetchSubtypeHitMap[categoryId] || {});
                    const typeNames = typeIds.map((typeId) => this.getPoiTypeLabel(typeId)).filter(Boolean);
                    const previewLimit = 6;
                    this.fetchSubtypeProgress = {
                        categoryId: categoryId,
                        categoryName: String((cat && cat.name) || categoryId),
                        typeNamesPreview: typeNames.slice(0, previewLimit),
                        typeNamesFullCount: typeNames.length,
                        hiddenTypeCount: Math.max(0, typeNames.length - previewLimit),
                    };
                },
                accumulateFetchSubtypeHits(cat, poiList) {
                    const categoryId = String((cat && cat.id) || '');
                    if (!categoryId) return;
                    if (!this.fetchSubtypeHitMap[categoryId]) {
                        this.fetchSubtypeHitMap[categoryId] = {};
                    }
                    const bucket = this.fetchSubtypeHitMap[categoryId];
                    (poiList || []).forEach((poi) => {
                        const typeId = this.resolvePoiTypeId(poi && poi.type);
                        if (!typeId) return;
                        bucket[String(typeId)] = true;
                    });
                    this.updateFetchSubtypeProgressDisplay(cat);
                },
                getPoiSubItems(categoryId) {
                    const group = (this.typeMapGroups || []).find(g => String(g.id) === String(categoryId));
                    return group && Array.isArray(group.items) ? group.items : [];
                },
                isPoiSubItemChecked(itemId) {
                    return !!this.poiSubSelectionState[itemId];
                },
                getPoiSubSelectedCount(categoryId) {
                    const items = this.getPoiSubItems(categoryId);
                    if (!items.length) return 0;
                    return items.filter(item => !!this.poiSubSelectionState[item.id]).length;
                },
                togglePoiCategoryExpand(categoryId) {
                    this.expandedPoiCategoryId = this.expandedPoiCategoryId === categoryId ? null : categoryId;
                },
                syncPoiCategorySelection(cat) {
                    const items = this.getPoiSubItems(cat.id);
                    if (!items.length) return;
                    const selectedItems = items.filter(item => !!this.poiSubSelectionState[item.id]);
                    cat.checked = selectedItems.length > 0;
                    const seen = new Set();
                    const merged = [];
                    selectedItems.forEach((item) => {
                        String(item.types || '').split('|').forEach((rawCode) => {
                            const code = this.normalizeTypeCode(rawCode);
                            if (!code || seen.has(code)) return;
                            seen.add(code);
                            merged.push(code);
                        });
                    });
                    cat.types = merged.join('|');
                },
                togglePoiCategory(cat, checked) {
                    const items = this.getPoiSubItems(cat.id);
                    if (!items.length) {
                        cat.checked = !!checked;
                        return;
                    }
                    items.forEach((item) => {
                        this.poiSubSelectionState[item.id] = !!checked;
                    });
                    this.syncPoiCategorySelection(cat);
                },
                onPoiSubItemToggle(cat, item, checked) {
                    this.poiSubSelectionState[item.id] = !!checked;
                    this.syncPoiCategorySelection(cat);
                },
                buildSelectedCategoryBuckets() {
                    const buckets = [];
                    (this.poiCategories || []).forEach((cat) => {
                        this.syncPoiCategorySelection(cat);
                        if (!cat.checked || !cat.types) return;
                        buckets.push({
                            id: cat.id,
                            name: cat.name,
                            types: String(cat.types || ''),
                        });
                    });
                    return buckets;
                },
                syncH3PoiFilterSelection(forceAll = false) {
                    const ids = (this.poiCategories || [])
                        .map((cat) => String((cat && cat.id) || ''))
                        .filter(Boolean);
                    if (!ids.length) {
                        this.h3PoiFilterCategoryIds = [];
                        return;
                    }
                    if (forceAll || !Array.isArray(this.h3PoiFilterCategoryIds) || this.h3PoiFilterCategoryIds.length === 0) {
                        this.h3PoiFilterCategoryIds = ids.slice();
                        return;
                    }
                    const currentSet = new Set(
                        this.h3PoiFilterCategoryIds
                            .map((id) => String(id || ''))
                            .filter(Boolean)
                    );
                    const kept = ids.filter((id) => currentSet.has(id));
                    this.h3PoiFilterCategoryIds = kept.length ? kept : ids.slice();
                },
                selectAllH3PoiFilters() {
                    this.syncH3PoiFilterSelection(true);
                },
                clearH3PoiFilters() {
                    this.h3PoiFilterCategoryIds = [];
                },
                _getH3PoiFilterSet() {
                    return new Set(
                        (this.h3PoiFilterCategoryIds || [])
                            .map((id) => String(id || ''))
                            .filter(Boolean)
                    );
                },
                _buildH3AnalysisPois() {
                    const source = Array.isArray(this.allPoisDetails) ? this.allPoisDetails : [];
                    if (!source.length) return [];
                    const selectedCategoryIds = this._getH3PoiFilterSet();
                    if (!selectedCategoryIds.size) return [];
                    return source.filter((poi) => {
                        const categoryId = String(this.resolvePoiCategoryId(poi && poi.type) || '');
                        return categoryId && selectedCategoryIds.has(categoryId);
                    });
                },
                getH3FilteredPoiCount() {
                    return this._buildH3AnalysisPois().length;
                },
                resolvePoiCategoryId(typeText) {
                    const raw = String(typeText || '');
                    if (raw && this.typeIdToGroupId[raw]) {
                        return this.typeIdToGroupId[raw];
                    }
                    const code = this.normalizeTypeCode(typeText);
                    if (code && this.typeCodeToCategoryId[code]) {
                        return this.typeCodeToCategoryId[code];
                    }
                    if (code.length >= 2 && this.typePrefixToCategoryId[code.slice(0, 2)]) {
                        return this.typePrefixToCategoryId[code.slice(0, 2)];
                    }
                    return '';
                },
                resolvePoiTypeId(typeText) {
                    const raw = String(typeText || '');
                    if (raw && this.typeIdToGroupId[raw]) {
                        return raw;
                    }
                    const code = this.normalizeTypeCode(typeText);
                    if (code && this.typeCodeToTypeId[code]) {
                        return this.typeCodeToTypeId[code];
                    }
                    if (code.length >= 2 && this.typePrefixToTypeId[code.slice(0, 2)]) {
                        return this.typePrefixToTypeId[code.slice(0, 2)];
                    }
                    return '';
                },
                resolvePoiCategory(typeText) {
                    const id = this.resolvePoiCategoryId(typeText);
                    return id ? this.categoryById[id] : null;
                },
                saveAnalysisHistoryAsync(polygon, selectedCats, pois) {
                    if (!this.selectedPoint || !Array.isArray(pois) || pois.length === 0) return;
                    const typesLabel = (selectedCats || []).map(c => c.name).join(',');
                    const compactPois = pois.map((p) => ({
                        id: p && p.id ? String(p.id) : '',
                        name: p && p.name ? String(p.name) : '未命名',
                        location: Array.isArray(p && p.location) ? [p.location[0], p.location[1]] : null,
                        address: p && p.address ? String(p.address) : '',
                        type: p && p.type ? String(p.type) : '',
                        adname: p && p.adname ? String(p.adname) : '',
                        lines: Array.isArray(p && p.lines) ? p.lines : []
                    })).filter((p) => Array.isArray(p.location) && p.location.length === 2);
                    const payload = {
                        center: [this.selectedPoint.lng, this.selectedPoint.lat],
                        polygon: polygon,
                        pois: compactPois,
                        keywords: typesLabel,
                        location_name: this.selectedPoint.lng.toFixed(4) + "," + this.selectedPoint.lat.toFixed(4),
                        mode: this.transportMode,
                        time_min: parseInt(this.timeHorizon),
                    };
                    setTimeout(() => {
                        fetch('/api/v1/analysis/history/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        })
                            .then(async (res) => {
                                if (!res.ok) {
                                    let detail = '';
                                    try {
                                        detail = (await res.text()) || '';
                                    } catch (_) { }
                                    throw new Error(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
                                }
                                return res.json().catch(() => ({}));
                            })
                            .then(() => { })
                            .catch((err) => {
                                console.warn('Failed to save history', err);
                                this.poiStatus = `抓取完成，但历史保存失败：${err && err.message ? err.message : String(err)}`;
                            });
                    }, 0);
                },
                clearAnalysisLayers() {
                    if (this.abortController) {
                        this.abortController.abort();
                        this.abortController = null;
                    }
                    this.isFetchingPois = false;
                    this.isFetchingAois = false;
                    this.fetchProgress = 0;
                    this.poiStatus = '';
                    this.aoiStatus = '';
                    this.roadSyntaxStatus = '';
                    this.resetFetchSubtypeProgress();
                    this.allPoisDetails = [];
                    this.allAoisDetails = [];
                    this.aoiSamplePoints = 0;
                    this.aoiTotalCalls = 0;
                    this.lastIsochroneGeoJSON = null;
                    this.h3GridStatus = '';
                    this.h3GridCount = 0;
                    this.h3GridFeatures = [];
                    this.isGeneratingGrid = false;
                    this.resetH3AnalysisState();

                    if (this.markerManager) {
                        if (this.markerManager.markers) {
                            this.markerManager.markers.forEach(m => m.setMap(null));
                        }
                        if (this.markerManager.destroyClusterers) {
                            this.markerManager.destroyClusterers();
                        }
                        this.markerManager = null;
                    }
                    if (this.poiMarkers) {
                        this.poiMarkers.forEach(m => m.setMap(null));
                        this.poiMarkers = [];
                    }
                    this.clearAoiMarkers();
                    this.resetRoadSyntaxState();

                    const filterContainer = document.getElementById('filtersContainer');
                    if (filterContainer) filterContainer.innerHTML = '';

                    if (this.mapCore) {
                        if (this.mapCore.clearGridPolygons) {
                            this.mapCore.clearGridPolygons();
                        }
                        this.mapCore.clearCustomPolygons();
                        this.mapCore.setRadius(0);
                    }
                    this.disposePoiChart();
                },
                resetH3AnalysisState() {
                    this.isComputingH3Analysis = false;
                    this.h3AnalysisSummary = null;
                    this.h3AnalysisCharts = null;
                    this.h3AnalysisGridFeatures = [];
                    this.selectedH3Id = null;
                    this.h3MainStage = 'params';
                    this.h3MetricView = 'density';
                    this.h3StructureFillMode = 'gi_z';
                    this.h3ParamsSubTab = 'grid';
                    this.h3SubTab = 'metric_map';
                    this._ensureH3CategoryState();
                    this.h3TargetCategory = this._resolveDefaultH3TargetCategory();
                    this.h3DecisionTopN = 10;
                    this.h3OnlySignificant = false;
                    this.h3Legend = null;
                    this.h3DerivedStats = {
                        structureSummary: null,
                        typingSummary: null,
                        lqSummary: null,
                        gapSummary: null,
                        topCells: {},
                    };
                    this.disposeH3Charts();
                },
                getIsochronePolygonRing() {
                    if (!this.lastIsochroneGeoJSON || !this.lastIsochroneGeoJSON.geometry) return null;
                    const geometry = this.lastIsochroneGeoJSON.geometry;
                    if (geometry.type === 'Polygon') {
                        return geometry.coordinates[0] || null;
                    }
                    if (geometry.type === 'MultiPolygon') {
                        return geometry.coordinates[0] ? geometry.coordinates[0][0] : null;
                    }
                    return null;
                },
                clearH3Grid() {
                    this.h3GridFeatures = [];
                    this.h3GridCount = 0;
                    this.h3GridStatus = '';
                    this.h3ExportMenuOpen = false;
                    this.h3ExportTasksOpen = false;
                    this.h3ExportScope = 'grid_only';
                    this.resetH3AnalysisState();
                    if (this.mapCore && this.mapCore.clearGridPolygons) {
                        this.mapCore.clearGridPolygons();
                    }
                },
                async onH3ResolutionChange() {
                    const rawRing = this.getIsochronePolygonRing();
                    if (!rawRing) {
                        this.clearH3Grid();
                        this.h3GridStatus = '请先完成范围分析后再生成网格';
                        return;
                    }
                    if (this.isComputingH3Analysis) {
                        this.h3GridStatus = '正在计算网格分析，请稍后再调整网格级别';
                        return;
                    }
                    this.h3GridStatus = `网格级别已切换为 res=${this.h3GridResolution}，正在自动刷新网格...`;
                    await this.generateH3Grid();
                },
                onH3GridSettingsChange() {
                    this.clearH3Grid();
                    if (this.h3GridIncludeMode === 'inside') {
                        this.h3GridStatus = `已切换到“完全包含（严格）”，请点击“计算分析”`;
                    } else {
                        this.h3GridStatus = `已切换到“相交优先（边缘保留）”，最小重叠比例=${this.h3GridMinOverlapRatio.toFixed(2)}，请点击“计算分析”`;
                    }
                },
                toggleH3BasemapMuted() {
                    const next = !this.pointSimplifyEnabled;
                    this.pointSimplifyEnabled = next;
                    this.h3BasemapMuted = next;
                    this.onH3BasemapStyleChange();
                },
                onH3BasemapStyleChange() {
                    const hide = !!(this.pointSimplifyEnabled || this.h3BasemapMuted);
                    this.pointSimplifyEnabled = hide;
                    this.h3BasemapMuted = hide;
                    console.info('[point-simplify]', {
                        point_simplify: hide,
                        step: this.step,
                        panel: this.activeStep3Panel || ''
                    });
                    this.applySimplifyPointVisibility();
                },
                applySimplifyPointVisibility() {
                    const hide = !!this.pointSimplifyEnabled;
                    const panel = this.activeStep3Panel || '';
                    const showMarkers = panel !== 'syntax';

                    if (this.markerManager && typeof this.markerManager.setHideAllPoints === 'function') {
                        if (typeof this.markerManager.setShowMarkers === 'function') {
                            this.markerManager.setShowMarkers(showMarkers);
                        }
                        this.markerManager.setHideAllPoints(hide);
                        this.markerManager.applyFilters();
                    }

                    if (this.marker) {
                        if (hide) {
                            this.marker.setMap(null);
                        } else if (this.selectedPoint && this.mapCore && this.mapCore.map) {
                            this.marker.setMap(this.mapCore.map);
                        }
                    }

                    if (!this.markerManager && Array.isArray(this.poiMarkers)) {
                        if (hide) {
                            this.poiMarkers.forEach(m => m && m.setMap && m.setMap(null));
                        } else if (this.allPoisDetails && this.allPoisDetails.length > 0) {
                            this.toggleCategory();
                        }
                    }
                },
                async onBasemapSourceChange() {
                    const allowedSources = ['amap', 'osm', 'tianditu'];
                    let source = allowedSources.includes(this.basemapSource) ? this.basemapSource : 'amap';
                    if (source === 'tianditu') {
                        const tileReady = await this.validateTiandituSource();
                        if (!tileReady) {
                            this.tdtDiagCopyStatus = '';
                        }
                    } else {
                        this.tdtDiag = null;
                        this.tdtDiagCopyStatus = '';
                        if (this.errorMessage && this.errorMessage.indexOf('天地图') >= 0) {
                            this.errorMessage = '';
                        }
                    }
                    this.basemapSource = source;
                    if (this.mapCore && this.mapCore.setBasemapSource) {
                        const applyResult = this.mapCore.setBasemapSource(source);
                        if (source === 'tianditu' && applyResult && applyResult.ok === false) {
                            this.tdtDiag = {
                                ok: false,
                                phase: 'map-init',
                                status: null,
                                contentType: '',
                                bodySnippet: applyResult.message || '',
                                reason: applyResult.code || 'wmts-layer-init-failed',
                            };
                            this.errorMessage = '天地图 WMTS 图层初始化失败，请检查：Key 类型=Web JS，白名单包含 localhost/127.0.0.1（及端口）。';
                        } else if (source === 'tianditu' && applyResult && applyResult.ok === true) {
                            if (this.errorMessage && this.errorMessage.indexOf('天地图') >= 0) {
                                this.errorMessage = '';
                            }
                        }
                    }
                    this.applySimplifyPointVisibility();
                },
                async generateH3Grid() {
                    const rawRing = this.getIsochronePolygonRing();
                    if (!rawRing || this.isGeneratingGrid || this.isComputingH3Analysis) return;

                    this.isGeneratingGrid = true;
                    this.resetH3AnalysisState();
                    this.h3GridStatus = '正在生成网络...';
                    try {
                        const polygon = rawRing.map(pt => {
                            if (Array.isArray(pt)) return [pt[0], pt[1]];
                            if (pt && typeof pt.lng === 'number') return [pt.lng, pt.lat];
                            return pt;
                        }).filter(pt => Array.isArray(pt) && pt.length >= 2);

                        const res = await fetch('/api/v1/analysis/h3-grid', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                polygon: polygon,
                                resolution: this.h3GridResolution,
                                coord_type: 'gcj02',
                                include_mode: this.h3GridIncludeMode,
                                min_overlap_ratio: this.h3GridIncludeMode === 'intersects'
                                    ? this.h3GridMinOverlapRatio
                                    : 0
                            })
                        });
                        if (!res.ok) {
                            let detail = '';
                            try {
                                detail = await res.text();
                            } catch (_) { }
                            throw new Error(detail || '网络生成失败');
                        }

                        const data = await res.json();
                        this.h3GridFeatures = data.features || [];
                        this.h3GridCount = Number.isFinite(data.count) ? data.count : this.h3GridFeatures.length;

                        if (this.mapCore && this.mapCore.setGridFeatures) {
                            this.mapCore.setGridFeatures(this.h3GridFeatures, {
                                strokeColor: '#2c6ecb',
                                strokeWeight: 1.1,
                                fillOpacity: 0,
                            });
                        }
                        this.h3GridStatus = this.h3GridCount > 0
                            ? `已生成 ${this.h3GridCount} 个 H3 网格`
                            : '已生成网络，但当前范围无可用网格';
                    } catch (e) {
                        console.error(e);
                        this.h3GridStatus = '网络生成失败: ' + e.message;
                    } finally {
                        this.isGeneratingGrid = false;
                    }
                },
                _toNumber(value, fallback = 0) {
                    const n = Number(value);
                    return Number.isFinite(n) ? n : fallback;
                },
                shortH3Id(h3Id) {
                    const id = h3Id ? String(h3Id) : '';
                    if (!id) return '-';
                    if (id.length <= 12) return id;
                    return `${id.slice(0, 5)}...${id.slice(-4)}`;
                },
                focusGridByH3Id(h3Id) {
                    const id = h3Id ? String(h3Id) : '';
                    if (!id || !this.mapCore || !this.mapCore.focusGridCellById) return;
                    this.selectedH3Id = id;
                    const found = this.mapCore.focusGridCellById(id, {
                        fitView: true,
                        zoomMin: 16,
                        animate: true,
                        strokeColor: '#22d3ee',
                        pulseColor: '#ecfeff'
                    });
                    if (!found) {
                        this.h3GridStatus = `未找到对应网格：${id}`;
                        return;
                    }
                    const row = this._findH3RowById(id);
                    if (row) {
                        this.h3GridStatus = this._buildH3StructureStatusText(row);
                    } else {
                        this.h3GridStatus = `已定位网格：${id}`;
                    }
                },
                onH3GridFeatureClick(payload) {
                    const id = payload && payload.h3_id ? String(payload.h3_id) : '';
                    if (!id) return;
                    this.focusGridByH3Id(id);
                },
                _findH3RowById(h3Id) {
                    const id = h3Id ? String(h3Id) : '';
                    if (!id) return null;
                    const rows = (this.h3DerivedStats && this.h3DerivedStats.structureSummary && this.h3DerivedStats.structureSummary.rows) || [];
                    const found = rows.find((row) => String(row.h3_id || '') === id);
                    if (found) return found;
                    const feature = (this.h3AnalysisGridFeatures || []).find((f) => String((f.properties || {}).h3_id || '') === id);
                    if (!feature) return null;
                    const props = feature.properties || {};
                    const giZ = Number.isFinite(Number(props.gi_star_z_score)) ? Number(props.gi_star_z_score) : null;
                    const lisaI = Number.isFinite(Number(props.lisa_i)) ? Number(props.lisa_i) : null;
                    const fallbackSignal = Math.max(
                        Number.isFinite(giZ) ? Math.abs(giZ) : 0,
                        Number.isFinite(lisaI) ? Math.abs(lisaI) : 0
                    );
                    return {
                        h3_id: id,
                        gi_star_z_score: giZ,
                        lisa_i: lisaI,
                        structure_signal: Number.isFinite(Number(props.structure_signal)) ? Number(props.structure_signal) : fallbackSignal,
                        density: this._toNumber(props.density_poi_per_km2, 0),
                    };
                },
                _buildH3StructureStatusText(row) {
                    const giText = row && Number.isFinite(this._toNumber(row.gi_star_z_score, NaN))
                        ? this._toNumber(row.gi_star_z_score, 0).toFixed(2)
                        : '-';
                    const lisaText = row && Number.isFinite(this._toNumber(row.lisa_i, NaN))
                        ? this._toNumber(row.lisa_i, 0).toFixed(2)
                        : '-';
                    const signalText = row && Number.isFinite(this._toNumber(row.structure_signal, NaN))
                        ? this._toNumber(row.structure_signal, 0).toFixed(2)
                        : '-';
                    const densityText = row && Number.isFinite(this._toNumber(row.density, NaN))
                        ? this._toNumber(row.density, 0).toFixed(2)
                        : '-';
                    return `Gi*z=${giText} | LISA I=${lisaText} | 结构信号=${signalText} | 密度=${densityText}`;
                },
                getArcgisSnapshotUrl() {
                    const summary = this.h3AnalysisSummary || {};
                    const giUrl = this._normalizeArcgisSnapshotUrl(summary.arcgis_image_url_gi);
                    const lisaUrl = this._normalizeArcgisSnapshotUrl(summary.arcgis_image_url_lisa);
                    const legacyUrl = this._normalizeArcgisSnapshotUrl(summary.arcgis_image_url);
                    if (this.h3SubTab === 'structure_map') {
                        if (this.h3StructureFillMode === 'lisa_i') {
                            // Keep snapshot layer-consistent: never fallback to Gi* image in LISA mode.
                            return lisaUrl || null;
                        }
                        // Keep snapshot layer-consistent: never fallback to LISA image in Gi* mode.
                        return giUrl || null;
                    }
                    return legacyUrl || giUrl || lisaUrl || null;
                },
                getArcgisSnapshotSrc() {
                    const url = this.getArcgisSnapshotUrl();
                    if (!url) return '';
                    if (String(url).startsWith('data:')) return url;
                    return `${url}?v=${this.h3ArcgisImageVersion}`;
                },
                _normalizeArcgisSnapshotUrl(rawUrl) {
                    const raw = String(rawUrl || '').trim();
                    if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'none') return null;
                    if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
                        return raw;
                    }
                    const slashNorm = raw.replace(/\\\\/g, '/').replace(/\\/g, '/');
                    const marker = '/static/generated/arcgis/';
                    const idx = slashNorm.indexOf(marker);
                    if (idx >= 0) {
                        return slashNorm.slice(idx);
                    }
                    const marker2 = 'static/generated/arcgis/';
                    const idx2 = slashNorm.indexOf(marker2);
                    if (idx2 >= 0) {
                        return '/' + slashNorm.slice(idx2);
                    }
                    return null;
                },
                getArcgisSnapshotTitle() {
                    if (this.h3SubTab === 'structure_map') {
                        if (this.h3StructureFillMode === 'lisa_i') {
                            return 'ArcGIS 结构快照（LISA / LMiIndex）';
                        }
                        return 'ArcGIS 结构快照（Gi* / Z-score）';
                    }
                    return 'ArcGIS 结构快照';
                },
                clearGridLock() {
                    if (this.mapCore && this.mapCore.clearGridFocus) {
                        this.mapCore.clearGridFocus({ restoreView: true });
                    }
                    this.selectedH3Id = null;
                    this.h3GridStatus = '';
                },
                tryRefocusSelectedGrid() {
                    if (!this.selectedH3Id || !this.mapCore || !this.mapCore.focusGridCellById) return;
                    this.mapCore.focusGridCellById(this.selectedH3Id, { panTo: false, animate: false });
                },
                _quantile(sortedValues, q) {
                    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0;
                    if (sortedValues.length === 1) return sortedValues[0];
                    const qq = Math.max(0, Math.min(1, q));
                    const pos = qq * (sortedValues.length - 1);
                    const lower = Math.floor(pos);
                    const upper = Math.min(sortedValues.length - 1, lower + 1);
                    const ratio = pos - lower;
                    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * ratio;
                },
                _calcContinuousStats(values) {
                    const valid = (values || [])
                        .map(v => this._toNumber(v, NaN))
                        .filter(v => Number.isFinite(v))
                        .sort((a, b) => a - b);
                    if (!valid.length) {
                        return {
                            count: 0,
                            mean: null,
                            std: null,
                            min: null,
                            max: null,
                            p10: null,
                            p50: null,
                            p90: null,
                        };
                    }
                    const count = valid.length;
                    const mean = valid.reduce((sum, v) => sum + v, 0) / count;
                    const variance = valid.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / count;
                    return {
                        count: count,
                        mean: mean,
                        std: Math.sqrt(Math.max(0, variance)),
                        min: valid[0],
                        max: valid[valid.length - 1],
                        p10: this._quantile(valid, 0.1),
                        p50: this._quantile(valid, 0.5),
                        p90: this._quantile(valid, 0.9),
                    };
                },
                _normalizeContinuousStats(stats, fallback) {
                    const source = (stats && typeof stats === 'object') ? stats : (fallback || {});
                    const toMetric = (value) => Number.isFinite(this._toNumber(value, NaN))
                        ? this._toNumber(value, 0)
                        : null;
                    return {
                        count: Math.max(0, Math.round(this._toNumber(source.count, 0))),
                        mean: toMetric(source.mean),
                        std: toMetric(source.std),
                        min: toMetric(source.min),
                        max: toMetric(source.max),
                        p10: toMetric(source.p10),
                        p50: toMetric(source.p50),
                        p90: toMetric(source.p90),
                    };
                },
                _normalizeGiRenderMeta(meta) {
                    const source = (meta && typeof meta === 'object') ? meta : {};
                    const min = Number.isFinite(this._toNumber(source.min, NaN)) ? this._toNumber(source.min, -3) : -3;
                    const max = Number.isFinite(this._toNumber(source.max, NaN)) ? this._toNumber(source.max, 3) : 3;
                    const center = Number.isFinite(this._toNumber(source.center, NaN)) ? this._toNumber(source.center, 0) : 0;
                    return {
                        mode: 'fixed_z',
                        min: Math.min(min, max),
                        max: Math.max(min, max),
                        center: Math.max(Math.min(center, Math.max(min, max)), Math.min(min, max)),
                    };
                },
                _normalizeLisaRenderMeta(meta, lisaIStats) {
                    const stats = lisaIStats || {};
                    const mean = Number.isFinite(this._toNumber(stats.mean, NaN)) ? this._toNumber(stats.mean, 0) : 0;
                    const std = Number.isFinite(this._toNumber(stats.std, NaN)) ? this._toNumber(stats.std, 0) : 0;
                    const p10 = Number.isFinite(this._toNumber(stats.p10, NaN)) ? this._toNumber(stats.p10, NaN) : null;
                    const p90 = Number.isFinite(this._toNumber(stats.p90, NaN)) ? this._toNumber(stats.p90, NaN) : null;
                    const minV = Number.isFinite(this._toNumber(stats.min, NaN)) ? this._toNumber(stats.min, NaN) : null;
                    const maxV = Number.isFinite(this._toNumber(stats.max, NaN)) ? this._toNumber(stats.max, NaN) : null;
                    const source = (meta && typeof meta === 'object') ? meta : {};
                    const clipMinRaw = Number.isFinite(this._toNumber(source.clip_min, NaN))
                        ? this._toNumber(source.clip_min, NaN)
                        : Math.max(
                            Number.isFinite(this._toNumber(mean - 2 * std, NaN)) ? this._toNumber(mean - 2 * std, NaN) : -Infinity,
                            Number.isFinite(this._toNumber(p10, NaN)) ? this._toNumber(p10, NaN) : -Infinity,
                            Number.isFinite(this._toNumber(minV, NaN)) ? this._toNumber(minV, NaN) : -Infinity
                        );
                    const clipMaxRaw = Number.isFinite(this._toNumber(source.clip_max, NaN))
                        ? this._toNumber(source.clip_max, NaN)
                        : Math.min(
                            Number.isFinite(this._toNumber(mean + 2 * std, NaN)) ? this._toNumber(mean + 2 * std, NaN) : Infinity,
                            Number.isFinite(this._toNumber(p90, NaN)) ? this._toNumber(p90, NaN) : Infinity,
                            Number.isFinite(this._toNumber(maxV, NaN)) ? this._toNumber(maxV, NaN) : Infinity
                        );
                    const clipMin = Number.isFinite(clipMinRaw) ? clipMinRaw : mean;
                    const clipMax = Number.isFinite(clipMaxRaw) ? clipMaxRaw : mean;
                    const fallbackDegraded = !(Number.isFinite(std) && std > 0 && Number.isFinite(clipMin) && Number.isFinite(clipMax) && clipMax > clipMin);
                    return {
                        mode: 'stddev',
                        mean: Number.isFinite(this._toNumber(source.mean, NaN)) ? this._toNumber(source.mean, mean) : mean,
                        std: Number.isFinite(this._toNumber(source.std, NaN)) ? this._toNumber(source.std, std) : std,
                        min: Number.isFinite(this._toNumber(source.min, NaN)) ? this._toNumber(source.min, NaN) : stats.min,
                        max: Number.isFinite(this._toNumber(source.max, NaN)) ? this._toNumber(source.max, NaN) : stats.max,
                        clip_min: Math.min(clipMin, clipMax),
                        clip_max: Math.max(clipMin, clipMax),
                        degraded: source.degraded === true || fallbackDegraded,
                        message: source.message || (fallbackDegraded ? 'LMiIndex方差不足' : null),
                    };
                },
                _buildQuantileBreaks(values, binCount = 5) {
                    const sorted = (values || [])
                        .map(v => this._toNumber(v, NaN))
                        .filter(v => Number.isFinite(v))
                        .sort((a, b) => a - b);
                    if (!sorted.length || sorted[0] === sorted[sorted.length - 1]) {
                        return [];
                    }
                    const breaks = [];
                    for (let i = 1; i < binCount; i += 1) {
                        breaks.push(this._quantile(sorted, i / binCount));
                    }
                    for (let i = 1; i < breaks.length; i += 1) {
                        if (breaks[i] < breaks[i - 1]) {
                            breaks[i] = breaks[i - 1];
                        }
                    }
                    const deduped = [];
                    const eps = 1e-9;
                    for (const value of breaks) {
                        if (!deduped.length || Math.abs(value - deduped[deduped.length - 1]) > eps) {
                            deduped.push(value);
                        }
                    }
                    return deduped;
                },
                _buildDivergingBreaks(values) {
                    const valid = (values || [])
                        .map(v => this._toNumber(v, NaN))
                        .filter(v => Number.isFinite(v))
                        .sort((a, b) => a - b);
                    if (!valid.length) return [];
                    const negatives = valid.filter(v => v < 0);
                    const positives = valid.filter(v => v > 0);
                    if (!negatives.length || !positives.length) {
                        return this._buildQuantileBreaks(valid, 5);
                    }
                    const breaks = [
                        this._quantile(negatives, 1 / 3),
                        this._quantile(negatives, 2 / 3),
                        this._quantile(positives, 1 / 3),
                        this._quantile(positives, 2 / 3),
                    ];
                    for (let i = 1; i < breaks.length; i += 1) {
                        if (breaks[i] < breaks[i - 1]) {
                            breaks[i] = breaks[i - 1];
                        }
                    }
                    const deduped = [];
                    const eps = 1e-9;
                    for (const value of breaks) {
                        if (!deduped.length || Math.abs(value - deduped[deduped.length - 1]) > eps) {
                            deduped.push(value);
                        }
                    }
                    return deduped;
                },
                _getMetricSpec(metricKey) {
                    if (metricKey === 'entropy') {
                        return {
                            key: 'entropy',
                            label: '局部熵（归一化）',
                            unit: '0~1',
                            diverging: false,
                            palette: ['#f4fbe8', '#d6efbe', '#a5d88a', '#6bb65d', '#2f7e39'],
                            noDataColor: '#d1d5db',
                            noDataOpacity: 0.10,
                            fillOpacity: 0.24,
                            noDataLabel: `无数据（样本<${this.h3EntropyMinPoi}）`,
                        };
                    }
                    if (metricKey === 'neighbor_delta') {
                        return {
                            key: 'neighbor_delta',
                            label: '邻域差值（本格-邻域）',
                            unit: 'POI/km²',
                            diverging: true,
                            palette: ['#2b6cb0', '#90cdf4', '#f7f7f7', '#f6ad55', '#c53030'],
                            noDataColor: '#d1d5db',
                            noDataOpacity: 0.10,
                            fillOpacity: 0.24,
                            noDataLabel: '',
                        };
                    }
                    return {
                        key: 'density',
                        label: '密度',
                        unit: 'POI/km²',
                        diverging: false,
                        palette: ['#e8f1ff', '#b7d2ff', '#7eaef9', '#3f82e0', '#1f4f9a'],
                        noDataColor: '#d1d5db',
                        noDataOpacity: 0.10,
                        fillOpacity: 0.24,
                        noDataLabel: '',
                    };
                },
                _getH3MetricValue(props, metricKey) {
                    if (!props) return { value: null, noData: true };
                    const density = this._toNumber(props.density_poi_per_km2, 0);
                    if (metricKey === 'entropy') {
                        const poiCount = this._toNumber(props.poi_count, 0);
                        if (poiCount < this.h3EntropyMinPoi) {
                            return { value: null, noData: true };
                        }
                        const rawEntropy = this._toNumber(props.local_entropy, 0);
                        const normalized = rawEntropy / Math.log(7);
                        const bounded = Math.max(0, Math.min(1, normalized));
                        return { value: bounded, noData: false };
                    }
                    if (metricKey === 'neighbor_delta') {
                        const neighbor = this._toNumber(props.neighbor_mean_density, 0);
                        return { value: density - neighbor, noData: false };
                    }
                    return { value: density, noData: false };
                },
                _colorByBreaks(value, breaks, palette) {
                    if (!Number.isFinite(value)) return '#d1d5db';
                    if (!Array.isArray(breaks) || !breaks.length) {
                        return palette[Math.max(0, Math.floor((palette.length - 1) / 2))] || '#dbe9ff';
                    }
                    let idx = breaks.findIndex(bound => value <= bound);
                    if (idx < 0) idx = palette.length - 1;
                    return palette[Math.max(0, Math.min(idx, palette.length - 1))] || '#dbe9ff';
                },
                _formatLegendValue(value, metricKey) {
                    if (!Number.isFinite(value)) return '-';
                    if (metricKey === 'entropy') return value.toFixed(2);
                    const abs = Math.abs(value);
                    if (abs >= 100) return value.toFixed(0);
                    if (abs >= 10) return value.toFixed(1);
                    return value.toFixed(2);
                },
                _buildLegend(metricSpec, breaks, validValues) {
                    const palette = metricSpec.palette || [];
                    const legend = {
                        title: metricSpec.label,
                        unit: metricSpec.unit,
                        items: [],
                        noDataLabel: metricSpec.noDataLabel || '',
                        noDataColor: metricSpec.noDataColor || '#d1d5db',
                    };
                    if (!palette.length) return legend;
                    if (!Array.isArray(validValues) || !validValues.length) {
                        legend.items = [{ color: palette[0], label: '无有效数据' }];
                        return legend;
                    }
                    if (!breaks.length) {
                        const minV = Math.min(...validValues);
                        const maxV = Math.max(...validValues);
                        legend.items = [{
                            color: palette[palette.length - 1],
                            label: `${this._formatLegendValue(minV, metricSpec.key)} ~ ${this._formatLegendValue(maxV, metricSpec.key)}`
                        }];
                        return legend;
                    }
                    const classCount = Math.min(palette.length, breaks.length + 1);
                    for (let i = 0; i < classCount; i += 1) {
                        let label = '';
                        if (i === 0) {
                            label = `≤ ${this._formatLegendValue(breaks[0], metricSpec.key)}`;
                        } else if (i === classCount - 1) {
                            label = `> ${this._formatLegendValue(breaks[breaks.length - 1], metricSpec.key)}`;
                        } else {
                            label = `${this._formatLegendValue(breaks[i - 1], metricSpec.key)} ~ ${this._formatLegendValue(breaks[i], metricSpec.key)}`;
                        }
                        legend.items.push({ color: palette[i], label: label });
                    }
                    return legend;
                },
                _percentileFromSorted(sortedValues, value) {
                    if (!Array.isArray(sortedValues) || !sortedValues.length || !Number.isFinite(value)) return 0;
                    const n = sortedValues.length;
                    if (n === 1) return 0.5;
                    let lower = 0;
                    while (lower < n && sortedValues[lower] < value) lower += 1;
                    let upper = lower;
                    while (upper < n && sortedValues[upper] <= value) upper += 1;
                    const midRank = (lower + upper - 1) / 2;
                    return Math.max(0, Math.min(1, midRank / (n - 1)));
                },
                _getConfidenceInfo(poiCount) {
                    const count = this._toNumber(poiCount, 0);
                    if (count >= 10) return { score: 2, label: '高' };
                    if (count >= 5) return { score: 1, label: '中' };
                    return { score: 0, label: '低' };
                },
                _getH3CategoryLabel(key) {
                    const hit = (this.h3CategoryMeta || []).find(item => item.key === key);
                    return hit ? hit.label : key;
                },
                classifyGridType(featureProps, thresholds = {}) {
                    const density = this._toNumber(featureProps.density, 0);
                    const entropyNorm = Number.isFinite(featureProps.entropy_norm) ? featureProps.entropy_norm : null;
                    const neighborDelta = this._toNumber(featureProps.neighbor_delta, 0);
                    if (entropyNorm === null) {
                        return {
                            type_key: 'no_data',
                            type_label: '样本不足',
                            is_opportunity: false,
                        };
                    }
                    const highDensity = density >= this._toNumber(thresholds.densityP70, 0);
                    const highEntropy = entropyNorm >= this._toNumber(thresholds.entropyP70, 0);
                    let typeKey = 'low_density_low_mix';
                    let typeLabel = '低密-低混合';
                    if (highDensity && highEntropy) {
                        typeKey = 'high_density_high_mix';
                        typeLabel = '高密-高混合';
                    } else if (highDensity && !highEntropy) {
                        typeKey = 'high_density_low_mix';
                        typeLabel = '高密-低混合';
                    } else if (!highDensity && highEntropy) {
                        typeKey = 'low_density_high_mix';
                        typeLabel = '低密-高混合';
                    }
                    const isOpportunity = typeKey === 'high_density_high_mix' && neighborDelta > 0;
                    return {
                        type_key: typeKey,
                        type_label: typeLabel,
                        is_opportunity: isOpportunity,
                    };
                },
                computeCellLQ(featureProps, globalCategoryCounts, globalTotal) {
                    const poiCount = this._toNumber(featureProps.poi_count, 0);
                    if (poiCount < this.h3EntropyMinPoi) return null;
                    const categoryCounts = featureProps.category_counts || {};
                    const categorySize = Math.max(1, (this.h3CategoryMeta || []).length);
                    const alpha = Math.max(0, this._toNumber(this.h3LqSmoothingAlpha, 0.5));
                    const result = {};
                    (this.h3CategoryMeta || []).forEach(item => {
                        const key = item.key;
                        const gCount = this._toNumber(globalCategoryCounts[key], 0);
                        const cCount = this._toNumber(categoryCounts[key], 0);
                        const gShare = (gCount + alpha) / (Math.max(0, globalTotal) + alpha * categorySize);
                        const cShare = (cCount + alpha) / (Math.max(0, poiCount) + alpha * categorySize);
                        result[key] = gShare > 0 ? (cShare / gShare) : null;
                    });
                    return result;
                },
                computeGapScore(featureProps, targetCategory, gapDemandMapping = null) {
                    const density = this._toNumber(featureProps.density, 0);
                    const poiCount = this._toNumber(featureProps.poi_count, 0);
                    const categoryCounts = featureProps.category_counts || {};
                    const densityByCategory = {};
                    (this.h3CategoryMeta || []).forEach(item => {
                        const count = this._toNumber(categoryCounts[item.key], 0);
                        densityByCategory[item.key] = poiCount > 0 ? density * (count / poiCount) : 0;
                    });
                    const weights = this.h3GapWeights || {};
                    const mapping = gapDemandMapping || {};
                    const demandProxy =
                        this._toNumber(weights.transport, 0) * this._toNumber(densityByCategory[mapping.transport], 0) +
                        this._toNumber(weights.life, 0) * this._toNumber(densityByCategory[mapping.life], 0) +
                        this._toNumber(weights.education, 0) * this._toNumber(densityByCategory[mapping.education], 0) +
                        this._toNumber(weights.medical, 0) * this._toNumber(densityByCategory[mapping.medical], 0);
                    const supplyTargetDensity = this._toNumber(densityByCategory[targetCategory], 0);
                    return {
                        demand_proxy: demandProxy,
                        supply_target_density: supplyTargetDensity,
                    };
                },
                classifyGapZone(demandPct, supplyPct, gapScore) {
                    const demand = this._toNumber(demandPct, 0);
                    const supply = this._toNumber(supplyPct, 0);
                    const gap = this._toNumber(gapScore, 0);
                    if (demand >= 0.6 && supply < 0.4) return '补位机会区';
                    if (demand >= 0.6 && supply >= 0.6) return '高需求高供给（竞争区）';
                    if (demand < 0.4 && supply >= 0.6) return '低需求高供给（偏饱和）';
                    if (demand < 0.4 && supply < 0.4) return '低需求低供给（观察区）';
                    if (gap >= 0.15) return '偏机会区';
                    if (gap <= -0.15) return '偏饱和区';
                    return '相对平衡区';
                },
                computeH3DerivedStats() {
                    this._ensureH3CategoryState();
                    const features = this.h3AnalysisGridFeatures || [];
                    const topN = Math.max(3, Math.min(30, Math.round(this._toNumber(this.h3DecisionTopN, 10))));
                    this.h3DecisionTopN = topN;
                    if (!features.length) {
                        this.h3DerivedStats = {
                            structureSummary: null,
                            typingSummary: null,
                            lqSummary: null,
                            gapSummary: null,
                            topCells: {},
                        };
                        return;
                    }

                    const rowsBase = features.map((feature) => {
                        const props = feature.properties || {};
                        const entropyRaw = this._getH3MetricValue(props, 'entropy');
                        const density = this._toNumber(props.density_poi_per_km2, 0);
                        const neighborDensity = this._toNumber(props.neighbor_mean_density, 0);
                        return {
                            h3_id: props.h3_id || '',
                            poi_count: this._toNumber(props.poi_count, 0),
                            density: density,
                            entropy_norm: entropyRaw.noData ? null : entropyRaw.value,
                            neighbor_delta: density - neighborDensity,
                            category_counts: Object.assign({}, props.category_counts || {}),
                            confidence: this._getConfidenceInfo(props.poi_count),
                            lisa_i: Number.isFinite(Number(props.lisa_i)) ? Number(props.lisa_i) : null,
                            gi_star_z_score: Number.isFinite(Number(props.gi_star_z_score)) ? Number(props.gi_star_z_score) : null,
                        };
                    });
                    const rowsEnriched = rowsBase;

                    const densitySorted = rowsEnriched.map(r => r.density).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
                    const entropySorted = rowsEnriched.map(r => r.entropy_norm).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
                    const densityP70 = densitySorted.length ? this._quantile(densitySorted, 0.7) : 0;
                    const entropyP70 = entropySorted.length ? this._quantile(entropySorted, 0.7) : 0;

                    const typingRowsAll = rowsEnriched.map((row) => {
                        const typed = this.classifyGridType(row, { densityP70, entropyP70 });
                        return Object.assign({}, row, typed);
                    }).sort((a, b) => {
                        if ((b.is_opportunity ? 1 : 0) !== (a.is_opportunity ? 1 : 0)) {
                            return (b.is_opportunity ? 1 : 0) - (a.is_opportunity ? 1 : 0);
                        }
                        if (b.density !== a.density) return b.density - a.density;
                        const confidenceDiff = this._toNumber(b.confidence && b.confidence.score, 0)
                            - this._toNumber(a.confidence && a.confidence.score, 0);
                        if (confidenceDiff !== 0) return confidenceDiff;
                        return this._toNumber(b.entropy_norm, -1) - this._toNumber(a.entropy_norm, -1);
                    });

                    const baseGiStats = this._normalizeContinuousStats(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.gi_z_stats,
                        this._calcContinuousStats(rowsEnriched.map(r => r.gi_star_z_score))
                    );
                    const baseLisaStats = this._normalizeContinuousStats(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.lisa_i_stats,
                        this._calcContinuousStats(rowsEnriched.map(r => r.lisa_i))
                    );
                    const lisaMean = this._toNumber(baseLisaStats.mean, 0);
                    const lisaStd = this._toNumber(baseLisaStats.std, 0);
                    const structureRowsBase = rowsEnriched.map((row) => {
                        const giSignal = Number.isFinite(row.gi_star_z_score)
                            ? Math.abs(this._toNumber(row.gi_star_z_score, 0))
                            : 0;
                        let lisaSignal = 0;
                        if (Number.isFinite(row.lisa_i)) {
                            if (lisaStd > 0) {
                                lisaSignal = Math.abs((this._toNumber(row.lisa_i, 0) - lisaMean) / lisaStd);
                            } else {
                                lisaSignal = Math.abs(this._toNumber(row.lisa_i, 0) - lisaMean) > 0 ? 1 : 0;
                            }
                        }
                        const structureSignal = Math.max(giSignal, lisaSignal);
                        const hasStructureMetric = Number.isFinite(row.gi_star_z_score) || Number.isFinite(row.lisa_i);
                        return Object.assign({}, row, {
                            structure_signal: structureSignal,
                            structure_rank: structureSignal,
                            is_structure_signal: hasStructureMetric && structureSignal > 1,
                        });
                    });
                    const structureSignalByH3 = {};
                    structureRowsBase.forEach((row) => {
                        const key = String(row.h3_id || '');
                        if (!key) return;
                        structureSignalByH3[key] = {
                            structure_signal: row.structure_signal,
                            structure_rank: row.structure_rank,
                            is_structure_signal: !!row.is_structure_signal,
                        };
                    });
                    const typingRowsAllWithSignal = typingRowsAll.map((row) => {
                        const key = String(row.h3_id || '');
                        const signalMeta = structureSignalByH3[key] || {};
                        return Object.assign({}, row, signalMeta);
                    });
                    const typingRows = (this.h3OnlySignificant
                        ? typingRowsAllWithSignal.filter(r => r.is_structure_signal)
                        : typingRowsAllWithSignal
                    );
                    const typingCountByType = {};
                    typingRows.forEach(row => {
                        const key = row.type_key || 'unknown';
                        typingCountByType[key] = (typingCountByType[key] || 0) + 1;
                    });
                    const typingOpportunityCount = typingRows.filter(r => r.is_opportunity).length;
                    const typingMaxDensity = typingRows.length ? Math.max(...typingRows.map(r => this._toNumber(r.density, 0))) : 0;
                    const structureRows = (this.h3OnlySignificant
                        ? structureRowsBase.filter(r => r.is_structure_signal)
                        : structureRowsBase
                    ).sort((a, b) => {
                        const rankDiff = this._toNumber(b.structure_rank, 0) - this._toNumber(a.structure_rank, 0);
                        if (rankDiff !== 0) return rankDiff;
                        const giDiff = Math.abs(this._toNumber(b.gi_star_z_score, 0)) - Math.abs(this._toNumber(a.gi_star_z_score, 0));
                        if (giDiff !== 0) return giDiff;
                        if (b.density !== a.density) return b.density - a.density;
                        return this._toNumber(b.poi_count, 0) - this._toNumber(a.poi_count, 0);
                    });
                    const giZStats = this._normalizeContinuousStats(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.gi_z_stats,
                        this._calcContinuousStats(structureRowsBase.map(r => r.gi_star_z_score))
                    );
                    const lisaIStats = this._normalizeContinuousStats(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.lisa_i_stats,
                        this._calcContinuousStats(structureRowsBase.map(r => r.lisa_i))
                    );
                    const giRenderMeta = this._normalizeGiRenderMeta(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.gi_render_meta
                    );
                    const lisaRenderMeta = this._normalizeLisaRenderMeta(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.lisa_render_meta,
                        lisaIStats
                    );
                    const lisaValidCount = Math.max(0, this._toNumber(lisaIStats.count, 0));
                    const lisaPositiveCount = structureRowsBase.filter(r => Number.isFinite(r.lisa_i) && this._toNumber(r.lisa_i, 0) > 0).length;
                    const lisaNegativeCount = structureRowsBase.filter(r => Number.isFinite(r.lisa_i) && this._toNumber(r.lisa_i, 0) < 0).length;
                    const lisaPositivePct = lisaValidCount > 0 ? (lisaPositiveCount / lisaValidCount) : null;
                    const lisaNegativePct = lisaValidCount > 0 ? (lisaNegativeCount / lisaValidCount) : null;

                    const rowsWithSignal = structureRowsBase;
                    const globalCategoryCounts = {};
                    (this.h3CategoryMeta || []).forEach(item => { globalCategoryCounts[item.key] = 0; });
                    rowsWithSignal.forEach(row => {
                        (this.h3CategoryMeta || []).forEach(item => {
                            globalCategoryCounts[item.key] += this._toNumber(row.category_counts[item.key], 0);
                        });
                    });
                    const globalTotal = Object.values(globalCategoryCounts).reduce((s, v) => s + this._toNumber(v, 0), 0);
                    const lqRowsAll = rowsWithSignal.map(row => {
                        const lqMap = this.computeCellLQ(row, globalCategoryCounts, globalTotal);
                        let dominantKey = null;
                        let dominantValue = null;
                        if (lqMap) {
                            (this.h3CategoryMeta || []).forEach(item => {
                                const v = lqMap[item.key];
                                if (!Number.isFinite(v)) return;
                                if (!Number.isFinite(dominantValue) || v > dominantValue) {
                                    dominantValue = v;
                                    dominantKey = item.key;
                                }
                            });
                        }
                        return Object.assign({}, row, {
                            lq_map: lqMap,
                            lq_target: lqMap ? lqMap[this.h3TargetCategory] : null,
                            dominant_key: dominantKey,
                            dominant_value: dominantValue,
                        });
                    }).sort((a, b) => {
                        const lqDiff = this._toNumber(b.lq_target, -1) - this._toNumber(a.lq_target, -1);
                        if (lqDiff !== 0) return lqDiff;
                        return this._toNumber(b.confidence && b.confidence.score, 0)
                            - this._toNumber(a.confidence && a.confidence.score, 0);
                    });
                    const lqRows = this.h3OnlySignificant
                        ? lqRowsAll.filter(r => r.is_structure_signal)
                        : lqRowsAll;
                    const lqOpportunityCount = lqRows.filter(r => Number.isFinite(r.lq_target) && r.lq_target >= 1.2).length;
                    const lqMax = lqRows.length ? Math.max(...lqRows.map(r => this._toNumber(r.lq_target, 0))) : 0;
                    const dominantCounts = {};
                    (this.h3CategoryMeta || []).forEach(item => { dominantCounts[item.key] = 0; });
                    lqRowsAll.forEach(row => {
                        if (row.dominant_key && Number.isFinite(row.dominant_value) && row.dominant_value > 1) {
                            dominantCounts[row.dominant_key] += 1;
                        }
                    });

                    const gapDemandCategory = this._resolveGapDemandCategoryMap();
                    const missingMapTitles = gapDemandCategory.missingTitles || [];
                    const gapMappingWarning = missingMapTitles.length
                        ? `Gap映射缺失：未找到“${missingMapTitles.join('、')}”，对应权重按0处理`
                        : '';
                    const gapRowsRaw = rowsWithSignal.map(row => Object.assign({}, row, this.computeGapScore(
                        row,
                        this.h3TargetCategory,
                        gapDemandCategory.mapping || {}
                    )));
                    const demandValues = gapRowsRaw.map(r => r.demand_proxy).filter(v => Number.isFinite(v));
                    const supplyValues = gapRowsRaw.map(r => r.supply_target_density).filter(v => Number.isFinite(v));
                    const demandSorted = demandValues.slice().sort((a, b) => a - b);
                    const supplySorted = supplyValues.slice().sort((a, b) => a - b);
                    const gapRowsAll = gapRowsRaw.map(row => {
                        const demandPct = this._percentileFromSorted(demandSorted, row.demand_proxy);
                        const supplyPct = this._percentileFromSorted(supplySorted, row.supply_target_density);
                        const gapScore = demandPct - supplyPct;
                        return Object.assign({}, row, {
                            demand_pct: demandPct,
                            supply_pct: supplyPct,
                            gap_score: gapScore,
                            gap_zone_label: this.classifyGapZone(demandPct, supplyPct, gapScore),
                        });
                    }).sort((a, b) => {
                        const gapDiff = this._toNumber(b.gap_score, -999) - this._toNumber(a.gap_score, -999);
                        if (gapDiff !== 0) return gapDiff;
                        return this._toNumber(b.confidence && b.confidence.score, 0)
                            - this._toNumber(a.confidence && a.confidence.score, 0);
                    });
                    const gapRows = this.h3OnlySignificant
                        ? gapRowsAll.filter(r => r.is_structure_signal)
                        : gapRowsAll;
                    const gapOpportunityCount = gapRows.filter(r => this._toNumber(r.gap_score, 0) > 0.25 && this._toNumber(r.demand_pct, 0) >= 0.6).length;
                    const gapMax = gapRows.length ? Math.max(...gapRows.map(r => this._toNumber(r.gap_score, 0))) : 0;
                    const topGap = gapRows.length ? gapRows[0] : null;
                    const gapInsightBase = topGap
                        ? `Top1 网格需求分位 ${Math.round(this._toNumber(topGap.demand_pct, 0) * 100)}，供给分位 ${Math.round(this._toNumber(topGap.supply_pct, 0) * 100)}，结论：${topGap.gap_zone_label}`
                        : '当前缺口结果为空，请调整范围或业态后重算';
                    const gapInsight = gapMappingWarning
                        ? `${gapMappingWarning}。${gapInsightBase}`
                        : gapInsightBase;

                    this.h3DerivedStats = {
                        structureSummary: {
                            rows: structureRows,
                            giZStats: giZStats,
                            lisaIStats: lisaIStats,
                            lisaPositivePct: lisaPositivePct,
                            lisaNegativePct: lisaNegativePct,
                            giRenderMeta: giRenderMeta,
                            lisaRenderMeta: lisaRenderMeta,
                            recommendation: structureRows.length > 0
                                ? '优先观察Gi*与LMiIndex连续梯度，再结合LQ/缺口结果做落位'
                                : '当前结构梯度较弱，可扩大范围或切换圈层复核',
                        },
                        typingSummary: {
                            counts: typingCountByType,
                            rows: typingRows,
                            densityP70: densityP70,
                            entropyP70: entropyP70,
                            opportunityCount: typingOpportunityCount,
                            maxDensity: typingMaxDensity,
                            recommendation: typingOpportunityCount > 0
                                ? '优先排查高密-高混合且邻域为正的网格'
                                : '当前高密高混合机会有限，可结合区位商优势与缺口优先区复核',
                        },
                        lqSummary: {
                            rows: lqRows,
                            dominantCounts: dominantCounts,
                            opportunityCount: lqOpportunityCount,
                            maxLq: lqMax,
                            recommendation: `${this._getH3CategoryLabel(this.h3TargetCategory)}区位商优势格可优先巩固`,
                        },
                        gapSummary: {
                            rows: gapRows,
                            opportunityCount: gapOpportunityCount,
                            maxGap: gapMax,
                            mappingWarning: gapMappingWarning,
                            recommendation: topGap
                                ? `${this._getH3CategoryLabel(this.h3TargetCategory)}优先关注${topGap.gap_zone_label}`
                                : `${this._getH3CategoryLabel(this.h3TargetCategory)}当前无明显缺口优先区`,
                            insight: gapInsight,
                        },
                        topCells: {
                            structure: structureRows.slice(0, topN),
                            typing: typingRows.slice(0, topN),
                            lq: lqRows.slice(0, topN),
                            gap: gapRows.slice(0, topN),
                        },
                    };
                },
                _renderTypingMap() {
                    const typing = this.h3DerivedStats && this.h3DerivedStats.typingSummary;
                    if (!typing || !this.mapCore || !this.mapCore.setGridFeatures) return;
                    this.h3StructureRenderStats = null;
                    const colorByType = {
                        high_density_high_mix: '#0f766e',
                        high_density_low_mix: '#b45309',
                        low_density_high_mix: '#2563eb',
                        low_density_low_mix: '#64748b',
                        no_data: '#d1d5db',
                    };
                    const rowMap = {};
                    (typing.rows || []).forEach(row => { rowMap[row.h3_id] = row; });
                    const styled = (this.h3AnalysisGridFeatures || []).map(feature => {
                        const props = Object.assign({}, feature.properties || {});
                        const row = rowMap[props.h3_id] || {};
                        const typeKey = row.type_key || 'no_data';
                        props.fillColor = colorByType[typeKey] || '#d1d5db';
                        props.fillOpacity = typeKey === 'no_data' ? 0.10 : 0.24;
                        props.strokeColor = '#2c6ecb';
                        props.strokeWeight = 1;
                        return { type: feature.type, geometry: feature.geometry, properties: props };
                    });
                    this.h3Legend = {
                        title: '功能混合度',
                        unit: '分类',
                        items: [
                            { color: colorByType.high_density_high_mix, label: '高密-高混合' },
                            { color: colorByType.high_density_low_mix, label: '高密-低混合' },
                            { color: colorByType.low_density_high_mix, label: '低密-高混合' },
                            { color: colorByType.low_density_low_mix, label: '低密-低混合' },
                        ],
                        noDataLabel: `无数据（样本<${this.h3EntropyMinPoi}）`,
                        noDataColor: '#d1d5db',
                    };
                    this.mapCore.setGridFeatures(styled, { fillOpacity: 0.22, strokeWeight: 1.2 });
                    this.tryRefocusSelectedGrid();
                },
                _interpolateHexColor(fromHex, toHex, t) {
                    const from = String(fromHex || '#000000').replace('#', '');
                    const to = String(toHex || '#000000').replace('#', '');
                    if (from.length !== 6 || to.length !== 6) return fromHex || '#000000';
                    const ratio = Math.max(0, Math.min(1, this._toNumber(t, 0)));
                    const fr = parseInt(from.slice(0, 2), 16);
                    const fg = parseInt(from.slice(2, 4), 16);
                    const fb = parseInt(from.slice(4, 6), 16);
                    const tr = parseInt(to.slice(0, 2), 16);
                    const tg = parseInt(to.slice(2, 4), 16);
                    const tb = parseInt(to.slice(4, 6), 16);
                    const rr = Math.round(fr + (tr - fr) * ratio);
                    const rg = Math.round(fg + (tg - fg) * ratio);
                    const rb = Math.round(fb + (tb - fb) * ratio);
                    return '#' + [rr, rg, rb].map((v) => {
                        const s = v.toString(16);
                        return s.length === 1 ? `0${s}` : s;
                    }).join('');
                },
                _resolveContinuousDivergingStyle(value, min, center, max, options = {}) {
                    if (!Number.isFinite(value)) return { fillColor: '#000000', fillOpacity: 0 };
                    const low = Number.isFinite(this._toNumber(min, NaN)) ? this._toNumber(min, -1) : -1;
                    const high = Number.isFinite(this._toNumber(max, NaN)) ? this._toNumber(max, 1) : 1;
                    if (!(high > low)) {
                        return {
                            fillColor: options.midColor || '#f8fafc',
                            fillOpacity: options.minOpacity || 0.08,
                        };
                    }
                    const mid = Number.isFinite(this._toNumber(center, NaN))
                        ? this._toNumber(center, 0)
                        : (low + high) / 2;
                    const clamp = (v) => Math.min(high, Math.max(low, v));
                    const vv = clamp(value);
                    const safeMid = Math.min(high, Math.max(low, mid));
                    const minOpacity = Number.isFinite(this._toNumber(options.minOpacity, NaN))
                        ? this._toNumber(options.minOpacity, 0.08)
                        : 0.08;
                    const maxOpacity = Number.isFinite(this._toNumber(options.maxOpacity, NaN))
                        ? this._toNumber(options.maxOpacity, 0.48)
                        : 0.48;
                    const threshold = Number.isFinite(this._toNumber(options.thresholdAbs, NaN))
                        ? Math.max(0, this._toNumber(options.thresholdAbs, 0))
                        : 0;
                    const lowColor = options.lowColor || '#1d4ed8';
                    const midColor = options.midColor || '#f8fafc';
                    const highColor = options.highColor || '#b91c1c';
                    let ratio = 0;
                    let color = midColor;
                    if (vv >= safeMid) {
                        const span = Math.max(1e-9, high - safeMid);
                        ratio = (vv - safeMid) / span;
                        color = this._interpolateHexColor(midColor, highColor, ratio);
                    } else {
                        const span = Math.max(1e-9, safeMid - low);
                        ratio = (safeMid - vv) / span;
                        color = this._interpolateHexColor(midColor, lowColor, ratio);
                    }
                    if (Math.abs(vv - safeMid) < threshold) {
                        return { fillColor: color, fillOpacity: minOpacity * 0.6 };
                    }
                    const fillOpacity = minOpacity + (maxOpacity - minOpacity) * Math.max(0, Math.min(1, ratio));
                    return { fillColor: color, fillOpacity };
                },
                _resolveGiZFillStyle(zValue, giMeta) {
                    const meta = giMeta || { min: -3, max: 3, center: 0 };
                    return this._resolveContinuousDivergingStyle(
                        zValue,
                        this._toNumber(meta.min, -3),
                        this._toNumber(meta.center, 0),
                        this._toNumber(meta.max, 3),
                        {
                            lowColor: '#1d4ed8',
                            midColor: '#f8fafc',
                            highColor: '#b91c1c',
                            minOpacity: 0.06,
                            maxOpacity: 0.42,
                            thresholdAbs: 0.2,
                        }
                    );
                },
                _resolveLisaIFillStyle(lisaValue, lisaMeta) {
                    const meta = lisaMeta || {};
                    if (meta.degraded) {
                        if (!Number.isFinite(lisaValue)) return { fillColor: '#000000', fillOpacity: 0 };
                        return { fillColor: '#cbd5e1', fillOpacity: 0.06 };
                    }
                    return this._resolveContinuousDivergingStyle(
                        lisaValue,
                        this._toNumber(meta.clip_min, this._toNumber(meta.mean, 0)),
                        this._toNumber(meta.mean, 0),
                        this._toNumber(meta.clip_max, this._toNumber(meta.mean, 0)),
                        {
                            lowColor: '#0f766e',
                            midColor: '#f8fafc',
                            highColor: '#f97316',
                            minOpacity: 0.06,
                            maxOpacity: 0.38,
                            thresholdAbs: 0,
                        }
                    );
                },
                _formatStructureValue(value) {
                    if (!Number.isFinite(this._toNumber(value, NaN))) return '-';
                    return this._toNumber(value, 0).toFixed(2);
                },
                _buildGiLegend(giMeta) {
                    const meta = giMeta || { min: -3, max: 3, center: 0 };
                    const min = this._toNumber(meta.min, -3);
                    const max = this._toNumber(meta.max, 3);
                    const marks = [min, -2, -1, 0, 1, 2, max];
                    const items = [];
                    for (let i = 0; i < marks.length - 1; i += 1) {
                        const left = marks[i];
                        const right = marks[i + 1];
                        const mid = (left + right) / 2;
                        const style = this._resolveGiZFillStyle(mid, meta);
                        items.push({
                            color: style.fillColor,
                            label: `${this._formatStructureValue(left)} ~ ${this._formatStructureValue(right)}`,
                        });
                    }
                    return {
                        title: '结构图（Gi*）',
                        unit: 'GiZScore',
                        items: items,
                        noDataLabel: '|z| 近0或缺失时透明',
                        noDataColor: '#d1d5db',
                    };
                },
                _buildLisaLegend(lisaMeta) {
                    const meta = lisaMeta || {};
                    if (meta.degraded) {
                        return {
                            title: '结构图（LISA）',
                            unit: 'LMiIndex',
                            items: [{ color: '#cbd5e1', label: '方差不足（弱结构）' }],
                            noDataLabel: '无效值透明',
                            noDataColor: '#d1d5db',
                        };
                    }
                    const mean = this._toNumber(meta.mean, 0);
                    const std = Math.max(0, this._toNumber(meta.std, 0));
                    const clipMin = this._toNumber(meta.clip_min, mean - 3 * std);
                    const clipMax = this._toNumber(meta.clip_max, mean + 3 * std);
                    const marks = [clipMin, mean - 2 * std, mean - std, mean, mean + std, mean + 2 * std, clipMax];
                    const items = [];
                    for (let i = 0; i < marks.length - 1; i += 1) {
                        const left = marks[i];
                        const right = marks[i + 1];
                        const mid = (left + right) / 2;
                        const style = this._resolveLisaIFillStyle(mid, meta);
                        items.push({
                            color: style.fillColor,
                            label: `${this._formatStructureValue(left)} ~ ${this._formatStructureValue(right)}`,
                        });
                    }
                    return {
                        title: '结构图（LISA）',
                        unit: 'LMiIndex（标准差）',
                        items: items,
                        noDataLabel: '无效值透明',
                        noDataColor: '#d1d5db',
                    };
                },
                _renderStructureMapStandalone() {
                    const summary = this.h3DerivedStats && this.h3DerivedStats.structureSummary;
                    if (!summary || !this.mapCore || !this.mapCore.setGridFeatures) return;
                    const mode = this.h3StructureFillMode === 'lisa_i' ? 'lisa_i' : 'gi_z';
                    const rowMap = {};
                    (summary.rows || []).forEach((row) => { rowMap[row.h3_id] = row; });
                    const giMeta = summary.giRenderMeta || this._normalizeGiRenderMeta(this.h3AnalysisSummary && this.h3AnalysisSummary.gi_render_meta);
                    const lisaMeta = summary.lisaRenderMeta || this._normalizeLisaRenderMeta(
                        this.h3AnalysisSummary && this.h3AnalysisSummary.lisa_render_meta,
                        summary.lisaIStats
                    );
                    const styled = (this.h3AnalysisGridFeatures || []).map((feature) => {
                        const props = Object.assign({}, feature.properties || {});
                        const row = rowMap[props.h3_id] || {};
                        const giZValue = Number.isFinite(Number(row.gi_star_z_score))
                            ? Number(row.gi_star_z_score)
                            : (Number.isFinite(Number(props.gi_star_z_score)) ? Number(props.gi_star_z_score) : null);
                        const lisaIValue = Number.isFinite(Number(row.lisa_i))
                            ? Number(row.lisa_i)
                            : (Number.isFinite(Number(props.lisa_i)) ? Number(props.lisa_i) : null);
                        const fillStyle = mode === 'lisa_i'
                            ? this._resolveLisaIFillStyle(lisaIValue, lisaMeta)
                            : this._resolveGiZFillStyle(giZValue, giMeta);
                        props.gi_star_z_score = giZValue;
                        props.lisa_i = lisaIValue;
                        props.fillColor = fillStyle.fillColor;
                        props.fillOpacity = fillStyle.fillOpacity;
                        props.strokeColor = '#2c6ecb';
                        props.strokeWeight = 1;
                        return { type: feature.type, geometry: feature.geometry, properties: props };
                    });
                    this.h3Legend = mode === 'lisa_i' ? this._buildLisaLegend(lisaMeta) : this._buildGiLegend(giMeta);
                    this.mapCore.setGridFeatures(styled, {
                        fillOpacity: 0.22,
                        strokeWeight: 1.2,
                        structureBoundaryEdges: false,
                    });
                    this.h3StructureRenderStats = null;
                    this.tryRefocusSelectedGrid();
                },
                _renderLqMap() {
                    const lq = this.h3DerivedStats && this.h3DerivedStats.lqSummary;
                    if (!lq || !this.mapCore || !this.mapCore.setGridFeatures) return;
                    this.h3StructureRenderStats = null;
                    const metricSpec = {
                        key: 'lq',
                        label: `${this._getH3CategoryLabel(this.h3TargetCategory)} 区位商优势（LQ）`,
                        unit: '相对值',
                        palette: ['#edf7ed', '#c4e3c4', '#8ccb8c', '#4ea95d', '#1b6e33'],
                        noDataColor: '#d1d5db',
                        noDataOpacity: 0.10,
                        fillOpacity: 0.24,
                        noDataLabel: `无数据（样本<${this.h3EntropyMinPoi}）`,
                    };
                    const rowMap = {};
                    (lq.rows || []).forEach(row => { rowMap[row.h3_id] = row; });
                    const validValues = (lq.rows || []).map(r => r.lq_target).filter(v => Number.isFinite(v));
                    const breaks = this._buildQuantileBreaks(validValues, 5);
                    this.h3Legend = this._buildLegend(metricSpec, breaks, validValues);
                    const styled = (this.h3AnalysisGridFeatures || []).map(feature => {
                        const props = Object.assign({}, feature.properties || {});
                        const row = rowMap[props.h3_id] || {};
                        const value = row.lq_target;
                        if (!Number.isFinite(value)) {
                            props.fillColor = metricSpec.noDataColor;
                            props.fillOpacity = metricSpec.noDataOpacity;
                        } else {
                            props.fillColor = this._colorByBreaks(value, breaks, metricSpec.palette);
                            props.fillOpacity = metricSpec.fillOpacity;
                        }
                        props.strokeColor = '#2c6ecb';
                        props.strokeWeight = 1;
                        return { type: feature.type, geometry: feature.geometry, properties: props };
                    });
                    this.mapCore.setGridFeatures(styled, { fillOpacity: 0.22, strokeWeight: 1.2 });
                    this.tryRefocusSelectedGrid();
                },
                _renderGapMap() {
                    const gap = this.h3DerivedStats && this.h3DerivedStats.gapSummary;
                    if (!gap || !this.mapCore || !this.mapCore.setGridFeatures) return;
                    this.h3StructureRenderStats = null;
                    const metricSpec = {
                        key: 'gap',
                        label: `${this._getH3CategoryLabel(this.h3TargetCategory)} 缺口分`,
                        unit: '百分位差值',
                        palette: ['#2b6cb0', '#90cdf4', '#f7f7f7', '#f6ad55', '#c53030'],
                        noDataColor: '#d1d5db',
                        noDataOpacity: 0.10,
                        fillOpacity: 0.24,
                        noDataLabel: '',
                    };
                    const rowMap = {};
                    (gap.rows || []).forEach(row => { rowMap[row.h3_id] = row; });
                    const validValues = (gap.rows || []).map(r => r.gap_score).filter(v => Number.isFinite(v));
                    const breaks = this._buildDivergingBreaks(validValues);
                    this.h3Legend = this._buildLegend(metricSpec, breaks, validValues);
                    const styled = (this.h3AnalysisGridFeatures || []).map(feature => {
                        const props = Object.assign({}, feature.properties || {});
                        const row = rowMap[props.h3_id] || {};
                        const value = row.gap_score;
                        if (!Number.isFinite(value)) {
                            props.fillColor = metricSpec.noDataColor;
                            props.fillOpacity = metricSpec.noDataOpacity;
                        } else {
                            props.fillColor = this._colorByBreaks(value, breaks, metricSpec.palette);
                            props.fillOpacity = metricSpec.fillOpacity;
                        }
                        props.strokeColor = '#2c6ecb';
                        props.strokeWeight = 1;
                        return { type: feature.type, geometry: feature.geometry, properties: props };
                    });
                    this.mapCore.setGridFeatures(styled, { fillOpacity: 0.22, strokeWeight: 1.2 });
                    this.tryRefocusSelectedGrid();
                },
                renderH3BySubTab() {
                    if (!this.h3AnalysisGridFeatures || !this.h3AnalysisGridFeatures.length) {
                        this.h3Legend = null;
                        return;
                    }
                    if (this.h3SubTab === 'structure_map') {
                        this._renderStructureMapStandalone();
                    } else if (this.h3SubTab === 'typing') {
                        this._renderTypingMap();
                    } else if (this.h3SubTab === 'lq') {
                        this._renderLqMap();
                    } else if (this.h3SubTab === 'gap') {
                        this._renderGapMap();
                    } else {
                        this.renderH3AnalysisGrid(this.h3MetricView);
                    }
                },
                updateDecisionCards() {
                    if (!window.echarts || !this.h3DerivedStats) return;
                    const lqEl = document.getElementById('h3LqChart');
                    const gapEl = document.getElementById('h3GapChart');
                    const structureEl = document.getElementById('h3StructureChart');
                    if (!this.h3ChartsResizeHandler) {
                        this.h3ChartsResizeHandler = () => {
                            if (this.h3CategoryChart) this.h3CategoryChart.resize();
                            if (this.h3DensityChart) this.h3DensityChart.resize();
                            if (this.h3LqChart) this.h3LqChart.resize();
                            if (this.h3GapChart) this.h3GapChart.resize();
                            if (this.h3StructureChart) this.h3StructureChart.resize();
                        };
                        window.addEventListener('resize', this.h3ChartsResizeHandler);
                    }

                    if (structureEl && this.h3SubTab === 'structure_map') {
                        let chart = echarts.getInstanceByDom(structureEl);
                        if (!chart) chart = echarts.init(structureEl);
                        this.h3StructureChart = chart;
                        const summary = this.h3DerivedStats.structureSummary || {};
                        const giStats = summary.giZStats || {};
                        const lisaStats = summary.lisaIStats || {};
                        const labels = ['均值', '中位数', 'P90', 'P10', '最小', '最大'];
                        const giValues = [
                            this._toNumber(giStats.mean, 0),
                            this._toNumber(giStats.p50, 0),
                            this._toNumber(giStats.p90, 0),
                            this._toNumber(giStats.p10, 0),
                            this._toNumber(giStats.min, 0),
                            this._toNumber(giStats.max, 0),
                        ];
                        const lisaValues = [
                            this._toNumber(lisaStats.mean, 0),
                            this._toNumber(lisaStats.p50, 0),
                            this._toNumber(lisaStats.p90, 0),
                            this._toNumber(lisaStats.p10, 0),
                            this._toNumber(lisaStats.min, 0),
                            this._toNumber(lisaStats.max, 0),
                        ];
                        chart.setOption({
                            title: { text: '结构连续指标概览', left: 'center', top: 2, textStyle: { fontSize: 12 } },
                            grid: { left: 44, right: 14, top: 28, bottom: 24, containLabel: true },
                            legend: { top: 4, right: 8, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 11 } },
                            xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eceff3' } } },
                            yAxis: {
                                type: 'category',
                                data: labels,
                                axisTick: { show: false },
                                axisLine: { show: false }
                            },
                            series: [
                                {
                                    name: 'Gi* Z',
                                    type: 'bar',
                                    data: giValues,
                                    barWidth: 10,
                                    itemStyle: { color: '#b91c1c' },
                                },
                                {
                                    name: 'LISA I',
                                    type: 'bar',
                                    data: lisaValues,
                                    barWidth: 10,
                                    itemStyle: { color: '#0f766e' },
                                }
                            ]
                        }, true);
                    }

                    if (lqEl && this.h3SubTab === 'lq') {
                        let chart = echarts.getInstanceByDom(lqEl);
                        if (!chart) chart = echarts.init(lqEl);
                        this.h3LqChart = chart;
                        const summary = this.h3DerivedStats.lqSummary || {};
                        const labels = (this.h3CategoryMeta || []).map(item => item.label);
                        const values = (this.h3CategoryMeta || []).map(item => this._toNumber((summary.dominantCounts || {})[item.key], 0));
                        chart.setOption({
                            title: { text: '主导优势类别分布', left: 'center', top: 2, textStyle: { fontSize: 12 } },
                            grid: { left: 44, right: 14, top: 28, bottom: 24, containLabel: true },
                            xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eceff3' } } },
                            yAxis: { type: 'category', data: labels, axisTick: { show: false }, axisLine: { show: false } },
                            series: [{ type: 'bar', data: values, barWidth: 12, itemStyle: { color: '#4f8ad9' } }]
                        }, true);
                    }

                    if (gapEl && this.h3SubTab === 'gap') {
                        let chart = echarts.getInstanceByDom(gapEl);
                        if (!chart) chart = echarts.init(gapEl);
                        this.h3GapChart = chart;
                        const rows = ((this.h3DerivedStats.gapSummary || {}).rows || []);
                        const data = rows.map((row) => {
                            const demandPct = Math.max(0, Math.min(1, this._toNumber(row.demand_pct, 0)));
                            const supplyPct = Math.max(0, Math.min(1, this._toNumber(row.supply_pct, 0)));
                            const gapScore = this._toNumber(row.gap_score, 0);
                            const poiCount = Math.max(0, this._toNumber(row.poi_count, 0));
                            const symbolSize = Math.max(8, Math.min(26, 8 + Math.sqrt(poiCount) * 2));
                            return {
                                h3_id: row.h3_id,
                                gap_zone_label: row.gap_zone_label || '',
                                confidence_label: (row.confidence && row.confidence.label) || '低',
                                demand_pct: demandPct,
                                supply_pct: supplyPct,
                                gap_score: gapScore,
                                poi_count: poiCount,
                                symbolSize: symbolSize,
                                value: [Math.round(supplyPct * 100), Math.round(demandPct * 100), gapScore]
                            };
                        });
                        chart.setOption({
                            title: { text: '需求-供给散点（每点=网格）', left: 'center', top: 2, textStyle: { fontSize: 12 } },
                            grid: { left: 54, right: 14, top: 28, bottom: 34, containLabel: true },
                            tooltip: {
                                trigger: 'item',
                                formatter: (params) => {
                                    const d = params.data || {};
                                    const hid = d.h3_id || '-';
                                    return [
                                        `<b>${this.shortH3Id(hid)}</b>`,
                                        `需求分位: ${d.value ? d.value[1] : 0}`,
                                        `供给分位: ${d.value ? d.value[0] : 0}`,
                                        `缺口分: ${this._toNumber(d.gap_score, 0).toFixed(2)}`,
                                        `可信度: ${d.confidence_label || '-'}`,
                                        `结论: ${d.gap_zone_label || '-'}`,
                                    ].join('<br/>');
                                }
                            },
                            xAxis: {
                                type: 'value',
                                name: '供给百分位',
                                min: 0,
                                max: 100,
                                splitLine: { lineStyle: { color: '#eceff3' } }
                            },
                            yAxis: {
                                type: 'value',
                                name: '需求百分位',
                                min: 0,
                                max: 100,
                                splitLine: { lineStyle: { color: '#eceff3' } }
                            },
                            series: [{
                                type: 'scatter',
                                data: data,
                                symbolSize: (item) => item.symbolSize || 10,
                                itemStyle: {
                                    color: (params) => {
                                        const gap = this._toNumber(params && params.data && params.data.gap_score, 0);
                                        if (gap >= 0.25) return '#d8573f';
                                        if (gap <= -0.25) return '#3f7fd8';
                                        return '#93a5bf';
                                    },
                                    opacity: 0.85
                                },
                                emphasis: {
                                    itemStyle: {
                                        borderColor: '#111827',
                                        borderWidth: 1
                                    }
                                },
                                markLine: {
                                    silent: true,
                                    symbol: ['none', 'none'],
                                    lineStyle: { type: 'dashed', color: '#cbd5e1' },
                                    data: [{ xAxis: 50 }, { yAxis: 50 }]
                                }
                            }]
                        }, true);
                        chart.off('click');
                        chart.on('click', (params) => {
                            const h3Id = params && params.data && params.data.h3_id;
                            if (h3Id) this.focusGridByH3Id(h3Id);
                        });
                    }
                },
                renderH3AnalysisGrid(metricKey) {
                    const source = this.h3AnalysisGridFeatures;
                    if (!Array.isArray(source) || source.length === 0 || !this.mapCore || !this.mapCore.setGridFeatures) {
                        this.h3Legend = null;
                        return;
                    }
                    this.h3StructureRenderStats = null;

                    const metricSpec = this._getMetricSpec(metricKey);
                    const measured = source.map((feature) => {
                        const datum = this._getH3MetricValue((feature && feature.properties) || {}, metricKey);
                        return {
                            feature: feature,
                            value: datum.value,
                            noData: datum.noData
                        };
                    });
                    const validValues = measured
                        .filter(item => !item.noData && Number.isFinite(item.value))
                        .map(item => item.value);
                    const breaks = metricSpec.diverging
                        ? this._buildDivergingBreaks(validValues)
                        : this._buildQuantileBreaks(validValues, 5);
                    this.h3Legend = this._buildLegend(metricSpec, breaks, validValues);

                    const styled = measured.map((item) => {
                        const feature = item.feature;
                        const props = Object.assign({}, feature.properties || {});
                        if (item.noData || !Number.isFinite(item.value)) {
                            props.fillColor = metricSpec.noDataColor;
                            props.fillOpacity = metricSpec.noDataOpacity;
                            props.metric_value = null;
                            props.metric_no_data = true;
                        } else {
                            props.fillColor = this._colorByBreaks(item.value, breaks, metricSpec.palette);
                            props.fillOpacity = metricSpec.fillOpacity;
                            props.metric_value = item.value;
                            props.metric_no_data = false;
                        }
                        props.strokeColor = '#2c6ecb';
                        props.strokeWeight = 1;

                        return {
                            type: feature.type,
                            geometry: feature.geometry,
                            properties: props
                        };
                    });

                    this.mapCore.setGridFeatures(styled, {
                        fillOpacity: 0.22,
                        strokeWeight: 1.2,
                        structureBoundaryEdges: false,
                        structureBoundaryGi: false,
                        structureBoundaryLisa: false,
                    });
                    this.tryRefocusSelectedGrid();
                },
                getH3CurrentStageTabs() {
                    const fallback = ['metric_map'];
                    const stageTabs = this.h3MainStageTabs || {};
                    const tabs = stageTabs[this.h3MainStage] || fallback;
                    return Array.isArray(tabs) && tabs.length ? tabs : fallback;
                },
                getH3DefaultSubTabByStage(stage) {
                    const stageTabs = this.h3MainStageTabs || {};
                    const tabs = stageTabs[stage];
                    if (Array.isArray(tabs) && tabs.length) return tabs[0];
                    return 'metric_map';
                },
                resolveH3MainStageBySubTab(tab) {
                    const stageTabs = this.h3MainStageTabs || {};
                    const stageOrder = ['analysis', 'diagnosis', 'evaluate'];
                    for (const stage of stageOrder) {
                        const tabs = stageTabs[stage];
                        if (Array.isArray(tabs) && tabs.includes(tab)) return stage;
                    }
                    return 'analysis';
                },
                async onH3MainStageChange(stage) {
                    if (stage !== 'params' && stage !== 'analysis' && stage !== 'diagnosis' && stage !== 'evaluate') return;
                    this.h3MainStage = stage;
                    if (stage === 'params') {
                        this.h3ParamsSubTab = 'grid';
                        return;
                    }
                    const targetTab = this.getH3DefaultSubTabByStage(stage);
                    await this.onH3SubTabChange(targetTab);
                },
                onH3MetricViewChange() {
                    if (!this.h3AnalysisGridFeatures.length) return;
                    if (this.h3SubTab !== 'metric_map') return;
                    this.refreshMetricMapView();
                },
                onH3StructureFillModeChange() {
                    if (!this.h3AnalysisGridFeatures.length) return;
                    if (this.h3SubTab !== 'structure_map') return;
                    this._renderStructureMapStandalone();
                },
                async refreshMetricMapView() {
                    if (!this.h3AnalysisGridFeatures.length) return;
                    if (this.h3SubTab !== 'metric_map') return;
                    this.renderH3AnalysisGrid(this.h3MetricView);
                    await this.$nextTick();
                    this.updateH3Charts();
                },
                async onH3SubTabChange(tab) {
                    this.h3SubTab = tab;
                    this.h3MainStage = this.resolveH3MainStageBySubTab(tab);
                    if (!this.h3AnalysisGridFeatures.length) return;
                    this.computeH3DerivedStats();
                    await this.$nextTick();
                    this.renderH3BySubTab();
                    await this.$nextTick();
                    this.updateH3Charts();
                    this.updateDecisionCards();
                },
                async onH3DecisionSettingsChange() {
                    if (!this.h3AnalysisGridFeatures.length) return;
                    this.computeH3DerivedStats();
                    await this.$nextTick();
                    this.renderH3BySubTab();
                    await this.$nextTick();
                    this.updateH3Charts();
                    this.updateDecisionCards();
                },
                toggleH3ExportMenu() {
                    if (this.h3ExportScope === 'analysis_result' && !this.hasH3AnalysisForExport()) {
                        this.h3ExportScope = 'grid_only';
                    }
                    this.h3ExportTasksOpen = false;
                    this.h3ExportMenuOpen = !this.h3ExportMenuOpen;
                },
                closeH3ExportMenu() {
                    this.h3ExportMenuOpen = false;
                },
                toggleH3ExportTasks() {
                    this.h3ExportMenuOpen = false;
                    this.h3ExportTasksOpen = !this.h3ExportTasksOpen;
                },
                closeH3ExportTasks() {
                    this.h3ExportTasksOpen = false;
                },
                handleGlobalClick(event) {
                    const target = event && event.target;
                    const hasClosest = !!(target && target.closest);
                    const inExportWrap = hasClosest && !!target.closest('.h3-export-wrap');
                    const inTaskPanel = hasClosest && !!target.closest('.h3-export-task-panel');
                    const inTaskWrap = hasClosest && !!target.closest('.h3-task-wrap');
                    if (this.h3ExportMenuOpen && !inExportWrap) {
                        this.h3ExportMenuOpen = false;
                    }
                    if (this.h3ExportTasksOpen && !inTaskPanel && !inTaskWrap) {
                        this.h3ExportTasksOpen = false;
                    }
                },
                getH3PendingTaskCount() {
                    return (this.h3ExportTasks || []).filter((task) => task.status === 'running').length;
                },
                _buildH3ExportTaskTitle(exportFormat) {
                    return exportFormat === 'arcgis_package' ? '高级导出（LPK+MPK）' : '快速导出（.gpkg）';
                },
                _buildH3ExportScopeLabel() {
                    return this.h3ExportScope === 'analysis_result' ? '分析结果' : '仅网格';
                },
                _createH3ExportTask(exportFormat) {
                    this.h3ExportTaskSeq = Number(this.h3ExportTaskSeq || 0) + 1;
                    const now = new Date();
                    const task = {
                        id: `h3-export-${Date.now()}-${this.h3ExportTaskSeq}`,
                        title: this._buildH3ExportTaskTitle(exportFormat),
                        scope_label: this._buildH3ExportScopeLabel(),
                        status: 'running',
                        status_label: '导出中',
                        created_at: now.toISOString(),
                        created_at_text: now.toLocaleTimeString([], { hour12: false }),
                        filename: '',
                        error: '',
                    };
                    this.h3ExportTasks = [task].concat(this.h3ExportTasks || []).slice(0, 20);
                    return task.id;
                },
                _updateH3ExportTask(taskId, patch) {
                    this.h3ExportTasks = (this.h3ExportTasks || []).map((task) => {
                        if (task.id !== taskId) return task;
                        return Object.assign({}, task, patch || {});
                    });
                },
                clearH3CompletedTasks() {
                    this.h3ExportTasks = (this.h3ExportTasks || []).filter((task) => task.status === 'running');
                },
                _showH3ExportToast(message, type = 'info', durationMs = 2200) {
                    if (this.h3ToastTimer) {
                        clearTimeout(this.h3ToastTimer);
                        this.h3ToastTimer = null;
                    }
                    this.h3Toast = {
                        message: String(message || ''),
                        type: String(type || 'info'),
                    };
                    this.h3ToastTimer = setTimeout(() => {
                        this.h3Toast = { message: '', type: 'info' };
                        this.h3ToastTimer = null;
                    }, Math.max(800, Number(durationMs) || 2200));
                },
                _resolveH3ExportStyleMode() {
                    if (this.h3ExportScope === 'grid_only') return 'density';
                    if (this.h3MainStage === 'analysis' && this.h3SubTab === 'structure_map') {
                        return this.h3StructureFillMode === 'lisa_i' ? 'lisa_i' : 'gi_z';
                    }
                    return 'density';
                },
                hasH3GridForExport() {
                    return Array.isArray(this.h3GridFeatures) && this.h3GridFeatures.length > 0;
                },
                hasH3AnalysisForExport() {
                    return Array.isArray(this.h3AnalysisGridFeatures)
                        && this.h3AnalysisGridFeatures.length > 0
                        && !!this.h3AnalysisSummary;
                },
                _resolveH3ExportSourceFeatures() {
                    if (this.h3ExportScope === 'analysis_result') {
                        return this.hasH3AnalysisForExport() ? this.h3AnalysisGridFeatures : [];
                    }
                    if (this.hasH3GridForExport()) {
                        return this.h3GridFeatures;
                    }
                    if (this.hasH3AnalysisForExport()) {
                        return this.h3AnalysisGridFeatures;
                    }
                    return [];
                },
                _buildH3ExportGridFeatures() {
                    const source = this._resolveH3ExportSourceFeatures();
                    return (source || []).map((feature) => ({
                        type: String((feature && feature.type) || 'Feature'),
                        geometry: this._normalizeGeometryForExport((feature && feature.geometry) || null),
                        properties: Object.assign({}, (feature && feature.properties) || {}),
                    })).filter((feature) => feature.geometry && feature.properties);
                },
                _normalizeCoordPointForExport(point) {
                    if (Array.isArray(point) && point.length >= 2) {
                        const lng = Number(point[0]);
                        const lat = Number(point[1]);
                        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
                    }
                    if (point && typeof point === 'object') {
                        const lng = Number(point.lng ?? point.lon);
                        const lat = Number(point.lat);
                        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
                    }
                    return null;
                },
                _normalizeRingForExport(ring) {
                    if (!Array.isArray(ring)) return [];
                    const points = ring
                        .map((pt) => this._normalizeCoordPointForExport(pt))
                        .filter((pt) => Array.isArray(pt) && pt.length >= 2);
                    if (points.length < 3) return [];
                    const first = points[0];
                    const last = points[points.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        points.push([first[0], first[1]]);
                    }
                    return points.length >= 4 ? points : [];
                },
                _normalizeGeometryForExport(geometry) {
                    if (!geometry || typeof geometry !== 'object') return null;
                    const type = String(geometry.type || '');
                    const coords = geometry.coordinates;
                    if (type === 'Polygon') {
                        if (!Array.isArray(coords)) return null;
                        const first = coords[0];
                        const directRing = this._normalizeRingForExport(coords);
                        if (directRing.length) {
                            return { type: 'Polygon', coordinates: [directRing] };
                        }
                        const outerRing = this._normalizeRingForExport(first);
                        if (!outerRing.length) return null;
                        return { type: 'Polygon', coordinates: [outerRing] };
                    }
                    if (type === 'MultiPolygon') {
                        if (!Array.isArray(coords)) return null;
                        const polygons = [];
                        coords.forEach((poly) => {
                            if (!Array.isArray(poly)) return;
                            const directRing = this._normalizeRingForExport(poly);
                            if (directRing.length) {
                                polygons.push([directRing]);
                                return;
                            }
                            const outer = this._normalizeRingForExport(poly[0]);
                            if (outer.length) polygons.push([outer]);
                        });
                        if (!polygons.length) return null;
                        return { type: 'MultiPolygon', coordinates: polygons };
                    }
                    return null;
                },
                _buildH3ExportPoiFeatures() {
                    if (!this.h3ExportIncludePoi) return [];
                    const source = this._buildH3AnalysisPois();
                    if (!source.length) return [];
                    return source
                        .map((poi) => {
                            const location = Array.isArray(poi && poi.location) ? poi.location : [];
                            const lng = Number(location[0]);
                            const lat = Number(location[1]);
                            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
                            const category = this.resolvePoiCategory(poi && poi.type);
                            return {
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [lng, lat],
                                },
                                properties: {
                                    id: String((poi && poi.id) || ''),
                                    name: String((poi && poi.name) || ''),
                                    type: String((poi && poi.type) || ''),
                                    category_id: String((category && category.id) || ''),
                                    category: String((category && category.name) || ''),
                                }
                            };
                        })
                        .filter(Boolean);
                },
                _getFilenameFromContentDisposition(disposition) {
                    const raw = String(disposition || '');
                    if (!raw) return '';
                    const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
                    if (utf8Match && utf8Match[1]) {
                        try { return decodeURIComponent(utf8Match[1]); } catch (_) { return utf8Match[1]; }
                    }
                    const normalMatch = raw.match(/filename=\"?([^\";]+)\"?/i);
                    return normalMatch && normalMatch[1] ? normalMatch[1] : '';
                },
                _downloadBlobFile(blob, filename) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename || 'h3_export.bin';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                },
                async exportH3Analysis(format) {
                    if (this.isExportingH3) {
                        this._showH3ExportToast('已有导出任务进行中，请稍候', 'info');
                        this.h3ExportTasksOpen = true;
                        return;
                    }
                    if (this.h3ExportScope === 'analysis_result' && !this.hasH3AnalysisForExport()) {
                        this._showH3ExportToast('请先完成计算分析，再导出分析结果', 'warning');
                        return;
                    }
                    const gridFeatures = this._buildH3ExportGridFeatures();
                    if (!gridFeatures.length) {
                        this._showH3ExportToast('暂无可导出的网格', 'warning');
                        return;
                    }
                    const exportFormat = format === 'arcgis_package' ? 'arcgis_package' : 'gpkg';
                    const taskId = this._createH3ExportTask(exportFormat);
                    this.h3ExportTasksOpen = true;
                    const styleMode = this._resolveH3ExportStyleMode();
                    const payload = {
                        format: exportFormat,
                        include_poi: !!this.h3ExportIncludePoi,
                        style_mode: styleMode,
                        grid_features: gridFeatures,
                        poi_features: this._buildH3ExportPoiFeatures(),
                        style_meta: {
                            legend: this.h3Legend || null,
                            metric_view: this.h3MetricView,
                            structure_fill_mode: this.h3StructureFillMode,
                            gi_render_meta: (this.h3AnalysisSummary && this.h3AnalysisSummary.gi_render_meta) || null,
                            lisa_render_meta: (this.h3AnalysisSummary && this.h3AnalysisSummary.lisa_render_meta) || null,
                        },
                        arcgis_python_path: this.h3ArcgisPythonPath || null,
                        arcgis_timeout_sec: 300,
                    };
                    this.isExportingH3 = true;
                    try {
                        const res = await fetch('/api/v1/analysis/h3/export', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                            let detail = '';
                            try {
                                const errJson = await res.json();
                                detail = errJson && (errJson.detail || errJson.error || JSON.stringify(errJson));
                            } catch (_) {
                                try { detail = await res.text(); } catch (_) { detail = ''; }
                            }
                            throw new Error(detail || `HTTP ${res.status}`);
                        }
                        const blob = await res.blob();
                        const filename = this._getFilenameFromContentDisposition(res.headers.get('content-disposition'))
                            || (exportFormat === 'arcgis_package' ? 'h3_analysis.zip' : 'h3_analysis.gpkg');
                        this._downloadBlobFile(blob, filename);
                        this._updateH3ExportTask(taskId, {
                            status: 'success',
                            status_label: '已完成',
                            filename: filename,
                            error: '',
                        });
                        this._showH3ExportToast(`导出成功：${filename}`, 'success');
                        this.h3ExportMenuOpen = false;
                    } catch (e) {
                        console.error(e);
                        this._updateH3ExportTask(taskId, {
                            status: 'failed',
                            status_label: '失败',
                            error: String((e && e.message) || e || '导出失败'),
                        });
                        this._showH3ExportToast(`导出失败：${(e && e.message) || e}`, 'error', 3200);
                    } finally {
                        this.isExportingH3 = false;
                    }
                },
                async computeH3Analysis() {
                    const rawRing = this.getIsochronePolygonRing();
                    if (!rawRing || this.isComputingH3Analysis) return;
                    const progressTotal = 5;
                    const startedAt = Date.now();
                    const engineName = 'ArcGIS';
                    let progressStep = 0;
                    let progressLabel = '准备中';
                    let progressTimer = null;
                    const setProgress = (step, label) => {
                        progressStep = step;
                        progressLabel = label;
                        const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
                        this.h3GridStatus = `网格分析进度 ${progressStep}/${progressTotal}：${progressLabel}（${sec}s）`;
                    };
                    this.isComputingH3Analysis = true;
                    setProgress(1, '准备分析参数');
                    progressTimer = window.setInterval(() => {
                        if (!this.isComputingH3Analysis) return;
                        const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
                        this.h3GridStatus = `网格分析进度 ${progressStep}/${progressTotal}：${progressLabel}（${sec}s）`;
                    }, 1000);
                    try {
                        const polygon = rawRing.map(pt => {
                            if (Array.isArray(pt)) return [pt[0], pt[1]];
                            if (pt && typeof pt.lng === 'number') return [pt.lng, pt.lat];
                            return pt;
                        }).filter(pt => Array.isArray(pt) && pt.length >= 2);
                        const neighborRing = Math.max(1, Math.min(3, Math.round(this._toNumber(this.h3NeighborRing, 1))));
                        this.h3NeighborRing = neighborRing;
                        const analysisPois = this._buildH3AnalysisPois();
                        if (!analysisPois.length) {
                            throw new Error('当前“分析POI”配置下无可计算样本，请先在参数页勾选至少一个有数据的POI分类');
                        }

                        const payload = {
                            polygon: polygon,
                            resolution: this.h3GridResolution,
                            coord_type: 'gcj02',
                            include_mode: this.h3GridIncludeMode,
                            min_overlap_ratio: this.h3GridIncludeMode === 'intersects' ? this.h3GridMinOverlapRatio : 0,
                            pois: analysisPois,
                            poi_coord_type: 'gcj02',
                            neighbor_ring: neighborRing,
                            use_arcgis: true,
                            arcgis_python_path: this.h3ArcgisPythonPath || null,
                            arcgis_neighbor_ring: neighborRing,
                            arcgis_export_image: true,
                            arcgis_timeout_sec: 240
                        };

                        setProgress(2, `请求已发送，后端计算中（${engineName}）`);
                        const res = await fetch('/api/v1/analysis/h3-metrics', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                            let detail = '';
                            try {
                                const errJson = await res.json();
                                if (errJson && typeof errJson === 'object') {
                                    detail = errJson.detail || JSON.stringify(errJson);
                                } else {
                                    detail = String(errJson || '');
                                }
                            } catch (_) {
                                try { detail = await res.text(); } catch (_) { }
                            }
                            throw new Error(detail || '网格分析失败');
                        }

                        setProgress(3, '结果已返回，正在解析数据');
                        const data = await res.json();
                        const grid = data.grid || {};
                        this.h3AnalysisGridFeatures = grid.features || [];
                        this.h3GridFeatures = this.h3AnalysisGridFeatures;
                        this.h3GridCount = Number.isFinite(grid.count) ? grid.count : this.h3AnalysisGridFeatures.length;
                        this.h3AnalysisSummary = data.summary || null;
                        this.h3AnalysisCharts = data.charts || null;
                        this.h3ArcgisSnapshotLoadError = false;
                        this.h3ArcgisImageVersion = Date.now();
                        setProgress(4, '正在计算衍生指标');
                        this.computeH3DerivedStats();
                        setProgress(5, '正在渲染图层与图表');
                        this.renderH3BySubTab();
                        await this.$nextTick();
                        this.updateH3Charts();
                        this.updateDecisionCards();
                        this.h3GridStatus = this.h3GridCount > 0
                            ? `分析完成：${this.h3GridCount} 个网格，${(this.h3AnalysisSummary && this.h3AnalysisSummary.poi_count) || 0} 个POI`
                            : '分析完成，但当前范围无可用网格';
                    } catch (e) {
                        console.error(e);
                        this.h3GridStatus = '网格分析失败: ' + e.message;
                    } finally {
                        if (progressTimer) {
                            window.clearInterval(progressTimer);
                            progressTimer = null;
                        }
                        this.isComputingH3Analysis = false;
                    }
                },
                selectStep3Panel(panelId) {
                    if (this.isDraggingNav) return;
                    if (panelId === 'h3_settings') {
                        panelId = 'h3';
                    }
                    if (!this.isStep3PanelVisible(panelId)) return;
                    const previousPanel = this.activeStep3Panel;
                    this.activeStep3Panel = panelId;
                    if (previousPanel === 'syntax' && panelId !== 'syntax') {
                        this.suspendRoadSyntaxDisplay();
                    }
                    if (panelId !== 'h3') {
                        this.h3ExportMenuOpen = false;
                    }
                    if (panelId === 'poi') {
                        this.applySimplifyPointVisibility();
                        setTimeout(() => this.resizePoiChart(), 0);
                        return;
                    }
                    if (panelId === 'h3') {
                        this.h3MainStage = 'params';
                        this.h3ParamsSubTab = 'grid';
                        this.syncH3PoiFilterSelection(false);
                        if (!this.h3GridFeatures.length && !this.isGeneratingGrid && !this.isComputingH3Analysis) {
                            this.h3GridStatus = '已进入网格参数页，请点击“计算分析”';
                        }
                        this.applySimplifyPointVisibility();
                        return;
                    }
                    if (panelId === 'syntax') {
                        this.setRoadSyntaxMainTab('params', { refresh: false, syncMetric: false });
                        this.resumeRoadSyntaxDisplay();
                    }
                    this.applySimplifyPointVisibility();
                },
                onStep3DragStart(index, event) {
                    this.dragIndex = index;
                    this.dragOverIndex = index;
                    this.dragInsertPosition = 'before';
                    this.isDraggingNav = true;
                    if (event && event.dataTransfer) {
                        event.dataTransfer.effectAllowed = 'move';
                    }
                },
                onStep3DragOver(index, event) {
                    if (event) event.preventDefault();
                    this.dragOverIndex = index;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const midY = bounds.top + bounds.height / 2;
                    this.dragInsertPosition = event.clientY < midY ? 'before' : 'after';
                },
                onStep3Drop(index) {
                    if (this.dragIndex === null) {
                        this.dragOverIndex = null;
                        this.dragInsertPosition = null;
                        return;
                    }
                    const items = this.step3NavItems.slice();
                    const moved = items.splice(this.dragIndex, 1)[0];
                    let insertIndex = index;
                    if (this.dragInsertPosition === 'after') {
                        insertIndex = index + 1;
                    }
                    if (this.dragIndex < insertIndex) {
                        insertIndex -= 1;
                    }
                    items.splice(insertIndex, 0, moved);
                    this.step3NavItems = items;
                    this.dragIndex = null;
                    this.dragOverIndex = null;
                    this.dragInsertPosition = null;
                    this.isDraggingNav = false;
                },
                onStep3DragEnd() {
                    this.dragIndex = null;
                    this.dragOverIndex = null;
                    this.dragInsertPosition = null;
                    this.isDraggingNav = false;
                },
                goToStep(targetStep) {
                    this.confirmNavigation(() => {
                        if (targetStep < this.step) {
                            // Backwards navigation cleanup
                            if (this.step === 3 && targetStep <= 2) {
                                // Clear POI markers & data
                                if (this.markerManager) {
                                    if (this.markerManager.markers) {
                                        this.markerManager.markers.forEach(m => m.setMap(null));
                                    }
                                    if (this.markerManager.destroyClusterers) {
                                        this.markerManager.destroyClusterers();
                                    }
                                    this.markerManager = null;
                                }
                                if (this.poiMarkers) {
                                    this.poiMarkers.forEach(m => m.setMap(null));
                                    this.poiMarkers = [];
                                }
                                this.clearAoiMarkers();
                                this.allAoisDetails = [];
                                this.aoiSamplePoints = 0;
                                this.aoiTotalCalls = 0;
                                this.resetRoadSyntaxState();
                                // Clear Legacy Filter Panel
                                const filterContainer = document.getElementById('filtersContainer');
                                if (filterContainer) filterContainer.innerHTML = '';

                                this.poiStatus = '';
                                this.aoiStatus = '';
                                this.clearH3Grid();
                            }

                            if (this.step >= 2 && targetStep <= 1) {
                                // Clear Isochrone Polygon
                                if (this.mapCore && this.mapCore.clearCustomPolygons) {
                                    this.mapCore.clearCustomPolygons();
                                }
                                this.clearAoiMarkers();
                                this.allAoisDetails = [];
                                this.aoiSamplePoints = 0;
                                this.aoiTotalCalls = 0;
                                this.aoiStatus = '';
                                this.resetRoadSyntaxState();
                                this.lastIsochroneGeoJSON = null;
                                this.clearH3Grid();
                            }
                        }
                        this.step = targetStep;
                    });
                },
                confirmNavigation(callback) {
                    if (this.isFetchingPois || this.isFetchingAois) {
                        if (confirm('数据抓取正在进行中，离开将取消未完成的任务。确定要离开吗？')) {
                            this.cancelFetch();
                            callback();
                        }
                    } else {
                        callback();
                    }
                },
                cancelFetch() {
                    if (this.abortController) {
                        this.abortController.abort();
                        this.abortController = null;
                    }
                    this.isFetchingPois = false;
                    this.isFetchingAois = false;
                    this.poiStatus = "任务已取消";
                    this.aoiStatus = "任务已取消";
                    this.resetFetchSubtypeProgress();
                },
                backToHome() {
                    this.confirmNavigation(() => {
                        this.destroyPlaceSearch();
                        this.clearAnalysisLayers();
                        this.sidebarView = 'start';
                        this.step = 1;
                        this.selectedPoint = null;
                        if (this.marker) {
                            this.marker.setMap(null);
                            this.marker = null;
                        }
                        this.errorMessage = '';
                    });
                },
                loadAMapScript(key, securityCode) {
                    return new Promise((resolve, reject) => {
                        if (window.AMap && window.AMap.Map) {
                            resolve();
                            return;
                        }
                        window._AMapSecurityConfig = { securityJsCode: securityCode };
                        const script = document.createElement('script');
                        script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${key}`;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                },
                async probeTiandituTile(timeoutMs = 4500) {
                    const key = (this.config && this.config.tianditu_key ? String(this.config.tianditu_key) : '').trim();
                    if (!key) {
                        return {
                            ok: false,
                            phase: 'wmts-probe',
                            status: null,
                            contentType: '',
                            bodySnippet: '',
                            reason: 'missing-key',
                            url: '',
                        };
                    }
                    const probeUrl = `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX=7&TILEROW=53&TILECOL=107&tk=${encodeURIComponent(key)}&_ts=${Date.now()}`;
                    const controller = new AbortController();
                    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
                    try {
                        const response = await fetch(probeUrl, {
                            method: 'GET',
                            cache: 'no-store',
                            signal: controller.signal,
                        });
                        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
                        const isImage = this.isImageContentType(contentType);
                        let bodySnippet = '';
                        if (!isImage) {
                            try {
                                bodySnippet = this._trimText(await response.text(), 300);
                            } catch (_) {
                                bodySnippet = '';
                            }
                        }
                        const status = response.status;
                        const ok = response.ok && isImage;
                        let reason = 'ok';
                        if (!ok) {
                            if (status === 418) reason = 'http-418';
                            else if (status >= 500) reason = 'http-5xx';
                            else if (status >= 400) reason = 'http-4xx';
                            else if (response.ok) reason = 'non-image-response';
                            else reason = 'http-error';
                        }
                        return {
                            ok: ok,
                            phase: 'wmts-probe',
                            status: status,
                            contentType: contentType,
                            bodySnippet: bodySnippet,
                            reason: reason,
                            url: probeUrl,
                        };
                    } catch (e) {
                        if (e && e.name === 'AbortError') {
                            return {
                                ok: false,
                                phase: 'wmts-probe',
                                status: null,
                                contentType: '',
                                bodySnippet: '',
                                reason: 'timeout',
                                url: probeUrl,
                            };
                        }
                        return {
                            ok: false,
                            phase: 'wmts-probe',
                            status: null,
                            contentType: '',
                            bodySnippet: this._trimText(e && e.message ? e.message : String(e), 300),
                            reason: 'network-error',
                            url: probeUrl,
                        };
                    } finally {
                        window.clearTimeout(timer);
                    }
                },
                async validateTiandituSource() {
                    const result = await this.probeTiandituTile();
                    this.tdtDiag = result;
                    this.tdtDiagCopyStatus = '';
                    if (result.ok) {
                        if (this.errorMessage && this.errorMessage.indexOf('天地图') >= 0) {
                            this.errorMessage = '';
                        }
                        return true;
                    }
                    if (result.reason === 'missing-key') {
                        this.errorMessage = '未配置天地图 Key（TIANDITU_KEY）。';
                    } else if (result.reason === 'timeout') {
                        this.errorMessage = '天地图 WMTS 探测超时，请稍后重试（配置修改可能需要 5-10 分钟生效）。';
                    } else if (result.reason === 'http-418') {
                        this.errorMessage = '天地图 WMTS 探测被拦截（HTTP 418），请检查 Key 类型=Web JS，白名单包含 localhost/127.0.0.1（及端口）。';
                    } else {
                        this.errorMessage = `天地图 WMTS 探测失败（${result.status || 'NO_STATUS'}），请检查 Key 与白名单。`;
                    }
                    return false;
                },
                isImageContentType(contentType) {
                    const ct = String(contentType || '').toLowerCase();
                    return ct.indexOf('image/') >= 0 || ct.indexOf('application/octet-stream') >= 0;
                },
                _trimText(value, maxLen = 300) {
                    const text = String(value || '');
                    if (text.length <= maxLen) return text;
                    return text.slice(0, maxLen) + '...';
                },
                buildTdtDiagText() {
                    if (!this.tdtDiag) return '';
                    const rows = [
                        `ok=${this.tdtDiag.ok}`,
                        `phase=${this.tdtDiag.phase || '-'}`,
                        `reason=${this.tdtDiag.reason || '-'}`,
                        `status=${this.tdtDiag.status === null || this.tdtDiag.status === undefined ? '-' : this.tdtDiag.status}`,
                        `contentType=${this.tdtDiag.contentType || '-'}`,
                    ];
                    if (this.tdtDiag.url) rows.push(`url=${this.tdtDiag.url}`);
                    if (this.tdtDiag.bodySnippet) rows.push(`body=${this.tdtDiag.bodySnippet}`);
                    return rows.join('\n');
                },
                async copyTdtDiag() {
                    const text = this.buildTdtDiagText();
                    if (!text) {
                        this.tdtDiagCopyStatus = '无可复制内容';
                        return;
                    }
                    try {
                        await navigator.clipboard.writeText(text);
                        this.tdtDiagCopyStatus = '已复制';
                    } catch (e) {
                        console.error(e);
                        this.tdtDiagCopyStatus = '复制失败，请手动复制';
                    }
                },
                initMap() {
                    const mapCore = new MapCore('container', {
                        center: { lng: 112.9388, lat: 28.2282 },
                        zoom: 13,
                        zooms: [3, 20],
                        mapData: {},
                        basemapSource: this.basemapSource,
                        basemapMuted: false,
                        tiandituKey: this.config ? this.config.tianditu_key : '',
                        tiandituContainerId: 'tianditu-container',
                        onGridFeatureClick: (payload) => this.onH3GridFeatureClick(payload)
                    });
                    mapCore.initMap();
                    this.mapCore = mapCore;
                    this.pointSimplifyEnabled = !!(this.pointSimplifyEnabled || this.h3BasemapMuted);
                    this.h3BasemapMuted = this.pointSimplifyEnabled;
                    this.applySimplifyPointVisibility();
                    if (this.basemapSource === 'tianditu' && mapCore.lastBasemapError) {
                        this.tdtDiag = {
                            ok: false,
                            phase: 'map-init',
                            status: null,
                            contentType: '',
                            bodySnippet: mapCore.lastBasemapError.message || '',
                            reason: mapCore.lastBasemapError.code || 'wmts-layer-init-failed',
                        };
                        this.errorMessage = '天地图 WMTS 图层初始化失败，请检查：Key 类型=Web JS，白名单包含 localhost/127.0.0.1（及端口）。';
                    }

                    mapCore.map.on('click', (e) => {
                        // Limit marker adjustment to Step 1 in Wizard mode
                        if (this.sidebarView !== 'wizard' || this.step !== 1) return;
                        this.setSelectedPoint(e.lnglat);
                    });
                    this.roadSyntaxAttachMapListeners();
                },
                isRoadSyntaxPanelActive() {
                    return this.activeStep3Panel === 'syntax';
                },
                isRoadSyntaxMetricViewActive() {
                    return this.isRoadSyntaxPanelActive() && this.roadSyntaxMainTab !== 'params';
                },
                roadSyntaxAttachMapListeners() {
                    const map = this.mapCore && this.mapCore.map ? this.mapCore.map : null;
                    if (!map) return;
                    this.roadSyntaxDetachMapListeners();
                    this.roadSyntaxZoomStartListener = () => {
                        this.roadSyntaxMapInteracting = true;
                        if (this.isRoadSyntaxMetricViewActive()) {
                            this.roadSyntaxEnterLowFidelityMode();
                        }
                    };
                    this.roadSyntaxMoveStartListener = () => {
                        this.roadSyntaxMapInteracting = true;
                        if (this.isRoadSyntaxMetricViewActive()) {
                            this.roadSyntaxEnterLowFidelityMode();
                        }
                    };
                    this.roadSyntaxMoveEndListener = () => {
                        this.roadSyntaxMapInteracting = false;
                        if (this.isRoadSyntaxMetricViewActive()) {
                            this.scheduleRoadSyntaxViewportRefresh('moveend');
                            this.roadSyntaxLogOverlayHealth('moveend');
                        }
                        if (this.markerManager && typeof this.markerManager.logCoordinateHealth === 'function') {
                            this.markerManager.logCoordinateHealth('road-syntax:moveend');
                        }
                    };
                    this.roadSyntaxZoomListener = () => {
                        this.roadSyntaxMapInteracting = false;
                        if (this.isRoadSyntaxMetricViewActive()) {
                            this.scheduleRoadSyntaxViewportRefresh('zoomend');
                            this.roadSyntaxLogOverlayHealth('zoomend');
                        }
                        if (this.isRoadSyntaxPanelActive() && this.resolveRoadSyntaxActiveMetric() === 'connectivity') {
                            this.scheduleRoadSyntaxNodeRefresh();
                        }
                        if (this.markerManager && typeof this.markerManager.logCoordinateHealth === 'function') {
                            this.markerManager.logCoordinateHealth('road-syntax:zoomend');
                        }
                    };
                    map.on('zoomstart', this.roadSyntaxZoomStartListener);
                    map.on('movestart', this.roadSyntaxMoveStartListener);
                    map.on('moveend', this.roadSyntaxMoveEndListener);
                    map.on('zoomend', this.roadSyntaxZoomListener);
                },
                roadSyntaxDetachMapListeners() {
                    const map = this.mapCore && this.mapCore.map ? this.mapCore.map : null;
                    if (map && this.roadSyntaxZoomListener) {
                        try { map.off('zoomend', this.roadSyntaxZoomListener); } catch (_) { }
                    }
                    if (map && this.roadSyntaxZoomStartListener) {
                        try { map.off('zoomstart', this.roadSyntaxZoomStartListener); } catch (_) { }
                    }
                    if (map && this.roadSyntaxMoveStartListener) {
                        try { map.off('movestart', this.roadSyntaxMoveStartListener); } catch (_) { }
                    }
                    if (map && this.roadSyntaxMoveEndListener) {
                        try { map.off('moveend', this.roadSyntaxMoveEndListener); } catch (_) { }
                    }
                    this.roadSyntaxZoomListener = null;
                    this.roadSyntaxZoomStartListener = null;
                    this.roadSyntaxMoveStartListener = null;
                    this.roadSyntaxMoveEndListener = null;
                },
                destroyPlaceSearch() {
                    this.placeSearchBuildToken += 1;
                    if (this.placeSearchErrorListener && window.AMap && AMap.event && typeof AMap.event.removeListener === 'function') {
                        try {
                            AMap.event.removeListener(this.placeSearchErrorListener);
                        } catch (_) { }
                    }
                    this.placeSearchErrorListener = null;
                    this.placeSearch = null;
                    this.placeSearchLoadingPromise = null;
                },
                async ensurePlaceSearchReady(timeoutMs = 3000) {
                    if (this.step !== 1) {
                        return { ok: false, reason: 'step' };
                    }
                    if (this.placeSearch && typeof this.placeSearch.search === 'function') {
                        return { ok: true, cached: true };
                    }
                    if (!window.AMap || typeof AMap.plugin !== 'function') {
                        return { ok: false, reason: 'amap-not-ready' };
                    }
                    if (this.placeSearchLoadingPromise) {
                        return this.placeSearchLoadingPromise;
                    }
                    const buildToken = this.placeSearchBuildToken + 1;
                    this.placeSearchBuildToken = buildToken;
                    const startAt = Date.now();
                    const timeoutPromise = new Promise((resolve) => {
                        window.setTimeout(() => resolve({ ok: false, reason: 'timeout' }), Math.max(800, Number(timeoutMs) || 3000));
                    });
                    const initPromise = new Promise((resolve) => {
                        try {
                            AMap.plugin(['AMap.PlaceSearch'], () => {
                                try {
                                    if (buildToken !== this.placeSearchBuildToken || this.step !== 1) {
                                        resolve({ ok: false, reason: 'stale-request' });
                                        return;
                                    }
                                    const placeSearch = new AMap.PlaceSearch({
                                        pageSize: 10,
                                        autoFitView: false,
                                    });
                                    this.placeSearch = placeSearch;
                                    this.placeSearchErrorListener = AMap.event.addListener(placeSearch, 'error', (e) => {
                                        console.error('PlaceSearch error', e);
                                    });
                                    resolve({ ok: true, createdAt: Date.now() });
                                } catch (e) {
                                    console.error('PlaceSearch init error', e);
                                    resolve({ ok: false, reason: 'init-failed' });
                                }
                            });
                        } catch (e) {
                            console.error('AMap.plugin PlaceSearch failed', e);
                            resolve({ ok: false, reason: 'plugin-failed' });
                        }
                    });
                    this.placeSearchLoadingPromise = Promise.race([initPromise, timeoutPromise])
                        .then((result) => {
                            if (!result || !result.ok) {
                                this.destroyPlaceSearch();
                            }
                            if (result && result.ok) {
                                console.info('[place-search] ready', { ms: Date.now() - startAt });
                            } else {
                                console.warn('[place-search] unavailable', result);
                            }
                            return result || { ok: false, reason: 'unknown' };
                        })
                        .finally(() => {
                            this.placeSearchLoadingPromise = null;
                        });
                    return this.placeSearchLoadingPromise;
                },
                extractSearchPois(result) {
                    const list = result && result.poiList && Array.isArray(result.poiList.pois)
                        ? result.poiList.pois
                        : [];
                    return list.filter((poi) => poi && poi.location);
                },
                runPlaceSearch(keyword) {
                    return new Promise((resolve) => {
                        if (!this.placeSearch || typeof this.placeSearch.search !== 'function') {
                            resolve({ ok: false, pois: [], status: 'error', raw: null, serviceError: true, errorInfo: '' });
                            return;
                        }
                        const query = (typeof keyword === 'string' ? keyword : String(keyword || '')).trim();
                        if (!query) {
                            resolve({ ok: false, pois: [], status: 'empty', raw: null, serviceError: false, errorInfo: '' });
                            return;
                        }

                        try {
                            this.placeSearch.search(query, (status, result) => {
                                const pois = this.extractSearchPois(result);
                                const errorInfo = String((result && result.info) || '');
                                resolve({
                                    ok: status === 'complete',
                                    pois: pois,
                                    status: status || '',
                                    raw: result || null,
                                    serviceError: status === 'error',
                                    errorInfo: errorInfo
                                });
                            });
                        } catch (e) {
                            console.error('placeSearch.search error', e);
                            resolve({ ok: false, pois: [], status: 'error', raw: null, serviceError: true, errorInfo: '' });
                        }
                    });
                },
                resolveCurrentSearchCity() {
                    return new Promise((resolve) => {
                        const map = this.mapCore && this.mapCore.map;
                        if (!map || typeof map.getCity !== 'function') {
                            resolve({ city: '', citycode: '' });
                            return;
                        }

                        let settled = false;
                        const done = (value) => {
                            if (settled) return;
                            settled = true;
                            const payload = value && typeof value === 'object' ? value : {};
                            resolve({
                                city: String(payload.city || payload.province || '').trim(),
                                citycode: String(payload.citycode || '').trim()
                            });
                        };

                        const timer = setTimeout(() => done({}), 1200);
                        try {
                            map.getCity((info) => {
                                clearTimeout(timer);
                                if (!info || info.info === 'FAILED') {
                                    done({});
                                    return;
                                }
                                done(info);
                            });
                        } catch (e) {
                            clearTimeout(timer);
                            console.warn('map.getCity failed', e);
                            done({});
                        }
                    });
                },
                setSelectedPoint(lnglat) {
                    if (!lnglat) return;
                    const lng = (typeof lnglat.lng === 'number')
                        ? lnglat.lng
                        : (typeof lnglat.getLng === 'function' ? lnglat.getLng() : NaN);
                    const lat = (typeof lnglat.lat === 'number')
                        ? lnglat.lat
                        : (typeof lnglat.getLat === 'function' ? lnglat.getLat() : NaN);
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

                    this.selectedPoint = { lng, lat };
                    if (this.mapCore) {
                        this.mapCore.center = { lng, lat };
                    }
                    this.errorMessage = '';
                    const markerPos = (window.AMap && typeof AMap.LngLat === 'function')
                        ? new AMap.LngLat(lng, lat)
                        : [lng, lat];
                    if (this.marker) {
                        this.marker.setPosition(markerPos);
                        return;
                    }
                    if (!this.mapCore || !this.mapCore.map) return;
                    this.marker = new AMap.Marker({ position: markerPos });
                    this.mapCore.map.add(this.marker);
                },
                onCaptureTargetChange(target) {
                    const next = target === 'aoi' ? 'aoi' : 'poi';
                    this.captureTarget = next;
                    this.poiStatus = '';
                    this.aoiStatus = '';
                    this.fetchProgress = 0;
                    if (this.step === 3) {
                        this.activeStep3Panel = next === 'aoi' ? 'aoi' : 'poi';
                    }
                },
                isStep3PanelVisible(panelId) {
                    if (this.captureTarget === 'aoi') {
                        return panelId === 'aoi' || panelId === 'syntax';
                    }
                    return panelId !== 'aoi';
                },
                step2StatusText() {
                    return this.captureTarget === 'aoi' ? this.aoiStatus : this.poiStatus;
                },
                getIsochronePolygonPoints() {
                    if (!this.lastIsochroneGeoJSON || !this.lastIsochroneGeoJSON.geometry) return [];
                    const geometry = this.lastIsochroneGeoJSON.geometry;
                    const rawPoly = (geometry.type === 'Polygon')
                        ? geometry.coordinates[0]
                        : (geometry.coordinates[0] ? geometry.coordinates[0][0] : []);
                    return (rawPoly || []).map((pt) => {
                        if (Array.isArray(pt)) return [pt[0], pt[1]];
                        if (pt && typeof pt.lng === 'number') return [pt.lng, pt.lat];
                        return pt;
                    }).filter((pt) => Array.isArray(pt) && pt.length >= 2);
                },
                async fetchStep2Data() {
                    if (this.captureTarget === 'aoi') {
                        await this.fetchAois();
                        return;
                    }
                    await this.fetchPois();
                },
                async startAnalysis() {
                    if (!this.selectedPoint || this.isCalculating) return;
                    this.isCalculating = true;
                    this.errorMessage = '';
                    this.fetchProgress = 0;
                    this.poiStatus = '';
                    this.aoiStatus = '';
                    this.allAoisDetails = [];
                    this.aoiSamplePoints = 0;
                    this.aoiTotalCalls = 0;
                    this.clearAoiMarkers();
                    this.roadSyntaxMode = this.transportMode || 'walking';
                    this.resetRoadSyntaxState();

                    try {
                        const payload = {
                            lat: this.selectedPoint.lat,
                            lon: this.selectedPoint.lng,
                            time_min: parseInt(this.timeHorizon),
                            mode: this.transportMode,
                            coord_type: 'gcj02'
                        };

                        const res = await fetch('/api/v1/analysis/isochrone', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!res.ok) throw new Error("API 请求失败");
                        const geojson = await res.json();

                        this.clearH3Grid();
                        this.lastIsochroneGeoJSON = geojson;
                        this.renderResult(geojson);
                        this.step = 2; // Advance to Step 2
                        this.activeStep3Panel = this.captureTarget === 'aoi' ? 'aoi' : 'poi';

                    } catch (e) {
                        console.error(e);
                        this.errorMessage = "计算失败: " + e.message;
                    } finally {
                        this.isCalculating = false;
                    }
                },
                async fetchPois() {
                    if (!this.lastIsochroneGeoJSON) return;
                    this.isFetchingPois = true;
                    this.fetchProgress = 0;
                    this.poiStatus = "准备抓取...";
                    this.aoiStatus = '';
                    this.allAoisDetails = [];
                    this.aoiSamplePoints = 0;
                    this.aoiTotalCalls = 0;
                    this.clearAoiMarkers();
                    this.resetRoadSyntaxState();
                    this.resetFetchSubtypeProgress();

                    if (this.poiMarkers) this.poiMarkers.forEach(m => m.setMap(null));
                    this.poiMarkers = [];
                    this.allPoisDetails = [];

                    try {
                        const polygon = this.getIsochronePolygonPoints();

                        // Get selected categories (derived from selected subtypes).
                        const selectedCats = this.buildSelectedCategoryBuckets();
                        if (selectedCats.length === 0) {
                            alert("请至少选择一个分类");
                            this.isFetchingPois = false;
                            return;
                        }

                        let totalFetched = 0;
                        const totalCats = selectedCats.length;
                        if (selectedCats[0]) {
                            this.updateFetchSubtypeProgressDisplay(selectedCats[0]);
                        }

                        // Parallel Fetching: process in batches.
                        this.abortController = new AbortController();
                        const batchSize = 4;
                        this.poiStatus = `正在并行抓取 ${totalCats} 个分类（每批 ${batchSize} 个）...`;

                        const fetchOneCategory = async (cat) => {
                            const payload = {
                                polygon: polygon,
                                keywords: "",
                                types: String(cat.types || ''),
                                save_history: false, // Don't save individual batches
                                center: [this.selectedPoint.lng, this.selectedPoint.lat],
                                time_min: parseInt(this.timeHorizon),
                                mode: this.transportMode,
                                location_name: this.selectedPoint.name || (this.selectedPoint.lng.toFixed(4) + ',' + this.selectedPoint.lat.toFixed(4))
                            };

                            try {
                                const res = await fetch('/api/v1/analysis/pois', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload),
                                    signal: this.abortController.signal
                                });

                                if (res.ok) {
                                    const data = await res.json();
                                    return data.pois || [];
                                }
                            } catch (err) {
                                if (err.name !== 'AbortError') {
                                    console.warn(`Failed to fetch category ${cat.name}`, err);
                                }
                            }
                            return [];
                        };

                        for (let i = 0; i < selectedCats.length; i += batchSize) {
                            if (this.abortController.signal.aborted) return;
                            const batch = selectedCats.slice(i, i + batchSize);
                            const resultsArray = await Promise.all(batch.map(fetchOneCategory));
                            resultsArray.forEach((list, index) => {
                                if (list && list.length) this.allPoisDetails.push(...list);
                                const cat = batch[index];
                                if (cat) {
                                    this.accumulateFetchSubtypeHits(cat, list || []);
                                }
                            });

                            totalFetched = this.allPoisDetails.length;
                            const done = Math.min(i + batch.length, totalCats);
                            this.fetchProgress = Math.round((done / totalCats) * 100);
                            this.poiStatus = `已完成 ${done}/${totalCats} 分类，累计 ${totalFetched} 个结果`;
                        }

                        if (this.abortController.signal.aborted) return;

                        this.fetchProgress = 100;
                        this.poiStatus = `完成！共找到 ${totalFetched} 个结果`;

                        // Integration with Legacy Filter Panel (single render path).
                        if (this.updateLegacySystem) {
                            this.updateLegacySystem(this.allPoisDetails);
                        } else {
                            this.renderPois(this.allPoisDetails);
                        }

                        setTimeout(() => {
                            this.step = 3; // Advance to Step 3 after short delay to see 100%
                            this.activeStep3Panel = 'poi';
                            this.updatePoiCharts();
                            this.resizePoiChart();
                        }, 120);
                        this.saveAnalysisHistoryAsync(polygon, selectedCats, this.allPoisDetails);

                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            console.error(e);
                            this.poiStatus = "失败: " + e.message;
                        }
                    } finally {
                        this.isFetchingPois = false;
                        this.abortController = null;
                        this.resetFetchSubtypeProgress();
                    }
                },
                roadSyntaxMap() {
                    return (this.mapCore && this.mapCore.map) ? this.mapCore.map : null;
                },
                roadSyntaxHasCache() {
                    if (Array.isArray(this.roadSyntaxPolylines) && this.roadSyntaxPolylines.length) return true;
                    const styleCache = this.roadSyntaxLayerStyleCache || {};
                    return Object.keys(styleCache).length > 0;
                },
                roadSyntaxGetLayer(layerKey = '') {
                    const pool = this.roadSyntaxLayerPool || {};
                    const key = String(layerKey || '');
                    return key ? (pool[key] || null) : null;
                },
                roadSyntaxSetStatus(text = '') {
                    this.roadSyntaxStatus = String(text || '');
                },
                roadSyntaxLogOverlayHealth(reason = '', options = {}) {
                    const force = !!(options && options.force);
                    const throttleMs = Math.max(0, Number((options && options.throttleMs) || 1200));
                    const now = this.roadSyntaxNow();
                    const lastAt = Number(this._roadSyntaxOverlayHealthLastAt || 0);
                    if (!force && (now - lastAt) < throttleMs) {
                        return null;
                    }
                    this._roadSyntaxOverlayHealthLastAt = now;
                    const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    const visibleSet = this.roadSyntaxVisibleLineSet || {};
                    const visibleIndexes = Object.keys(visibleSet)
                        .map((v) => Number(v))
                        .filter((v) => Number.isFinite(v) && v >= 0 && v < lines.length);
                    const inspectIndexes = visibleIndexes.length
                        ? visibleIndexes
                        : lines.map((_, idx) => idx);
                    const sampleLimit = 5;
                    const invalidCount = { path: 0, endpoint: 0, line: 0 };
                    const samples = [];

                    const resolvePathMeta = (pathValue) => {
                        let count = 0;
                        let first = null;
                        let last = null;
                        if (Array.isArray(pathValue)) {
                            count = pathValue.length;
                            first = count > 0 ? pathValue[0] : null;
                            last = count > 0 ? pathValue[count - 1] : null;
                            return { count, first, last };
                        }
                        if (!pathValue || typeof pathValue !== 'object') {
                            return { count, first, last };
                        }
                        if (typeof pathValue.getLength === 'function') {
                            try { count = Number(pathValue.getLength()) || 0; } catch (_) { count = 0; }
                        } else if (typeof pathValue.length === 'number') {
                            count = Number(pathValue.length) || 0;
                        }
                        if (count > 0) {
                            if (typeof pathValue.getAt === 'function') {
                                try { first = pathValue.getAt(0); } catch (_) { first = null; }
                                try { last = pathValue.getAt(count - 1); } catch (_) { last = null; }
                            } else {
                                first = pathValue[0] || null;
                                last = pathValue[count - 1] || null;
                            }
                        }
                        return { count, first, last };
                    };

                    inspectIndexes.forEach((lineIdx) => {
                        const line = lines[lineIdx];
                        if (!line) {
                            invalidCount.line += 1;
                            if (samples.length < sampleLimit) {
                                samples.push({ issue: 'missing-line', line_idx: lineIdx });
                            }
                            return;
                        }
                        let path = null;
                        try {
                            path = (typeof line.getPath === 'function') ? line.getPath() : null;
                        } catch (_) {
                            path = null;
                        }
                        const meta = resolvePathMeta(path);
                        if (meta.count < 2) {
                            invalidCount.path += 1;
                            if (samples.length < sampleLimit) {
                                samples.push({
                                    issue: 'invalid-path',
                                    line_idx: lineIdx,
                                    path_count: meta.count
                                });
                            }
                            return;
                        }
                        const first = this.normalizeLngLat(meta.first, 'road_syntax.overlay.path_endpoint');
                        const last = this.normalizeLngLat(meta.last, 'road_syntax.overlay.path_endpoint');
                        if (!first || !last) {
                            invalidCount.endpoint += 1;
                            if (samples.length < sampleLimit) {
                                samples.push({
                                    issue: 'invalid-endpoint',
                                    line_idx: lineIdx,
                                    first_raw: this.roadSyntaxSummarizeCoordInput(meta.first),
                                    last_raw: this.roadSyntaxSummarizeCoordInput(meta.last)
                                });
                            }
                        }
                    });

                    const invalidTotal = invalidCount.path + invalidCount.endpoint + invalidCount.line;
                    if (force || invalidTotal > 0) {
                        const level = invalidTotal > 0 ? 'warn' : 'info';
                        console[level]('[road-syntax] overlay coordinate health', {
                            reason: String(reason || ''),
                            active_layer: String(this.roadSyntaxActiveLayerKey || ''),
                            visible_lines: visibleIndexes.length,
                            inspected_lines: inspectIndexes.length,
                            invalid: invalidCount,
                            samples: samples
                        });
                    }
                    return {
                        inspectedLines: inspectIndexes.length,
                        visibleLines: visibleIndexes.length,
                        invalid: invalidCount
                    };
                },
                roadSyntaxFormatReadyStatus(prefix = '图层预加载中', done = 0, total = 0) {
                    const safeDone = Number.isFinite(Number(done)) ? Number(done) : 0;
                    const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
                    return `${prefix}：${safeDone}/${safeTotal}`;
                },
                roadSyntaxSetOverlayGroupVisible(group, visible, mapRef = null) {
                    if (!group) return false;
                    const map = mapRef || this.roadSyntaxMap();
                    try {
                        if (typeof group.setMap === 'function') {
                            group.setMap(visible ? map : null);
                            return true;
                        }
                        if (visible && typeof group.show === 'function') {
                            group.show();
                            return true;
                        }
                        if (!visible && typeof group.hide === 'function') {
                            group.hide();
                            return true;
                        }
                    } catch (_) { }
                    return false;
                },
                roadSyntaxSetLinesVisible(lines, visible, mapRef = null, options = {}) {
                    const list = Array.isArray(lines) ? lines : [];
                    if (!list.length) return true;
                    const map = mapRef || this.roadSyntaxMap();
                    const preferBatch = !(options && options.preferBatch === false);
                    if (preferBatch && map) {
                        try {
                            if (visible) {
                                if (typeof map.add !== 'function') throw new Error('map.add unavailable');
                                map.add(list);
                            } else {
                                if (typeof map.remove !== 'function') throw new Error('map.remove unavailable');
                                map.remove(list);
                            }
                            return true;
                        } catch (_) { }
                    }
                    list.forEach((line) => {
                        if (line && typeof line.setMap === 'function') {
                            line.setMap(visible ? map : null);
                        }
                    });
                    return false;
                },
                roadSyntaxTryGroupSwitch(currentGroup, targetGroup, mapRef = null) {
                    const map = mapRef || this.roadSyntaxMap();
                    if (!targetGroup) return false;
                    if (currentGroup) {
                        this.roadSyntaxSetOverlayGroupVisible(currentGroup, false, map);
                    }
                    return this.roadSyntaxSetOverlayGroupVisible(targetGroup, true, map);
                },
                roadSyntaxTryBatchLineSwitch(hideLines, showLines, mapRef = null) {
                    const map = mapRef || this.roadSyntaxMap();
                    if (!map) return false;
                    const hideList = Array.isArray(hideLines) ? hideLines : [];
                    const showList = Array.isArray(showLines) ? showLines : [];
                    if (hideList.length && typeof map.remove !== 'function') return false;
                    if (showList.length && typeof map.add !== 'function') return false;
                    try {
                        if (hideList.length) map.remove(hideList);
                        if (showList.length) map.add(showList);
                        return true;
                    } catch (_) {
                        return false;
                    }
                },
                async prewarmRoadSyntaxFirstSwitch(requestToken, activeLayerKey = '') {
                    if (requestToken !== this.roadSyntaxRequestToken) return false;
                    if (!this.roadSyntaxViewportLazyEnabled) return true;
                    const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    if (!lines.length) return false;
                    const cache = this.roadSyntaxLayerStyleCache || {};
                    const activeKey = String(activeLayerKey || this.roadSyntaxActiveLayerKey || '');
                    if (!activeKey || !Array.isArray(cache[activeKey])) return false;
                    const sampleIndexes = this.roadSyntaxCollectVisibleLineIndexes().slice(0, 120);
                    if (!sampleIndexes.length) return false;
                    const warmKeys = this.roadSyntaxLayerKeysForPrebuild().filter((key) => {
                        if (key === activeKey) return false;
                        return this.isRoadSyntaxLayerReady(key);
                    });
                    if (!warmKeys.length) return true;
                    try {
                        this.switchRoadSyntaxLayerByKey(warmKeys[0], { force: true, trackPerf: false });
                        this.switchRoadSyntaxLayerByKey(activeKey, { force: true, trackPerf: false });
                    } catch (_) { }
                    const remainingWarmKeys = warmKeys.slice(1);
                    if (!remainingWarmKeys.length) return true;
                    const applyOneKey = (key) => new Promise((resolve) => {
                        const styles = Array.isArray(cache[key]) ? cache[key] : [];
                        if (styles.length !== lines.length) {
                            resolve(true);
                            return;
                        }
                        let idx = 0;
                        const step = () => {
                            if (requestToken !== this.roadSyntaxRequestToken) {
                                resolve(false);
                                return;
                            }
                            if (this.roadSyntaxIsInteractingInMetricView()) {
                                window.requestAnimationFrame(step);
                                return;
                            }
                            const nowFn = (window.performance && typeof window.performance.now === 'function')
                                ? () => window.performance.now()
                                : () => Date.now();
                            const frameStart = nowFn();
                            const budgetMs = 3.5;
                            while (idx < sampleIndexes.length) {
                                const lineIdx = sampleIndexes[idx];
                                idx += 1;
                                const line = lines[lineIdx];
                                const style = styles[lineIdx] || null;
                                if (line && style && typeof line.setOptions === 'function') {
                                    try { line.setOptions(style); } catch (_) { }
                                }
                                if ((nowFn() - frameStart) >= budgetMs) break;
                            }
                            if (idx < sampleIndexes.length) {
                                window.requestAnimationFrame(step);
                                return;
                            }
                            resolve(true);
                        };
                        step();
                    });
                    for (let i = 0; i < remainingWarmKeys.length; i += 1) {
                        const ok = await applyOneKey(remainingWarmKeys[i]);
                        if (!ok) return false;
                    }
                    const revertStyles = cache[activeKey];
                    sampleIndexes.forEach((lineIdx) => {
                        const line = lines[lineIdx];
                        const style = revertStyles[lineIdx] || null;
                        if (line && style && typeof line.setOptions === 'function') {
                            try { line.setOptions(style); } catch (_) { }
                        }
                    });
                    return true;
                },
                roadSyntaxNow() {
                    if (window.performance && typeof window.performance.now === 'function') {
                        return window.performance.now();
                    }
                    return Date.now();
                },
                resolveRoadSyntaxPerformanceProfile() {
                    const hc = Number((window.navigator && window.navigator.hardwareConcurrency) || 0);
                    const dm = Number((window.navigator && window.navigator.deviceMemory) || 0);
                    if ((hc > 0 && hc <= 4) || (dm > 0 && dm <= 4)) return 'low';
                    if ((hc > 0 && hc <= 8) || (dm > 0 && dm <= 8)) return 'mid';
                    return 'high';
                },
                resolveRoadSyntaxEdgeCap() {
                    const profile = this.resolveRoadSyntaxPerformanceProfile();
                    this.roadSyntaxPerformanceProfile = profile;
                    const capByProfile = {
                        high: 1000,
                        mid: 800,
                        low: 600,
                    };
                    this.roadSyntaxActiveEdgeCap = Number(capByProfile[profile] || 800);
                    return this.roadSyntaxActiveEdgeCap;
                },
                roadSyntaxLayerReadyCounts() {
                    const readyMap = this.roadSyntaxLayerReadyMap || {};
                    const total = Object.keys(readyMap).length;
                    const ready = Object.values(readyMap).filter((v) => !!v).length;
                    return { ready, total };
                },
                recordRoadSyntaxSwitchDuration(startAt, layerKey, hideCount = 0, showCount = 0, path = '') {
                    const ms = Math.max(0, this.roadSyntaxNow() - Number(startAt || 0));
                    const samples = Array.isArray(this.roadSyntaxSwitchSamples) ? this.roadSyntaxSwitchSamples.slice() : [];
                    samples.push(ms);
                    if (samples.length > ROAD_SYNTAX_CONST.SWITCH_SAMPLE_LIMIT) {
                        samples.splice(0, samples.length - ROAD_SYNTAX_CONST.SWITCH_SAMPLE_LIMIT);
                    }
                    const sorted = samples.slice().sort((a, b) => a - b);
                    const p = (ratio) => {
                        if (!sorted.length) return 0;
                        const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
                        return sorted[idx];
                    };
                    this.roadSyntaxSwitchSamples = samples;
                    this.roadSyntaxSwitchLastMs = Number(ms.toFixed(2));
                    this.roadSyntaxSwitchP50Ms = Number(p(0.5).toFixed(2));
                    this.roadSyntaxSwitchP95Ms = Number(p(0.95).toFixed(2));
                    this.roadSyntaxSwitchPath = String(path || '');
                    const readyCounts = this.roadSyntaxLayerReadyCounts();
                    this.roadSyntaxSwitchStatsText = `N=${samples.length}, P50=${this.roadSyntaxSwitchP50Ms}ms, P95=${this.roadSyntaxSwitchP95Ms}ms, path=${this.roadSyntaxSwitchPath || '-'}, ready=${readyCounts.ready}/${readyCounts.total}`;
                    if (this.roadSyntaxSwitchP95Ms > Number(this.roadSyntaxSwitchTargetMs || 120)) {
                        console.warn('[road-syntax] switch latency high', {
                            p95_ms: this.roadSyntaxSwitchP95Ms,
                            p50_ms: this.roadSyntaxSwitchP50Ms,
                            last_ms: this.roadSyntaxSwitchLastMs,
                            active_layer: layerKey,
                            edge_count: Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems.length : 0,
                            hide_count: hideCount,
                            show_count: showCount,
                            profile: this.roadSyntaxPerformanceProfile,
                            edge_cap: this.roadSyntaxActiveEdgeCap,
                            path: this.roadSyntaxSwitchPath || '-',
                            ready_layers: readyCounts.ready,
                            total_layers: readyCounts.total,
                        });
                    }
                },
                invalidateRoadSyntaxCache(reason = 'manual', options = {}) {
                    const resetData = !!(options && options.resetData);
                    const resetPerf = !!(options && options.resetPerf);
                    this.roadSyntaxStyleUpdateToken += 1;
                    this.roadSyntaxPoolWarmToken += 1;
                    this.roadSyntaxLayerBuildToken += 1;
                    this.roadSyntaxLayerSwitchToken += 1;
                    this.roadSyntaxPrewarmToken += 1;
                    this.roadSyntaxStyleApplyToken += 1;
                    this.roadSyntaxSwitchInProgress = false;
                    this.roadSyntaxSwitchQueuedLayerKey = '';
                    this.roadSyntaxSwitchLastAt = 0;
                    this.roadSyntaxClearSwitchThrottleTimer();
                    this.roadSyntaxClearViewportRefreshHandles();
                    this.roadSyntaxClearNodeRefreshTimer();
                    this.roadSyntaxBumpViewportRefreshToken();
                    this.roadSyntaxInteractionLowFidelity = false;
                    this.roadSyntaxDisplaySuspended = false;
                    this.clearRoadSyntaxLayerPool();
                    this.roadSyntaxPolylines = [];
                    this.roadSyntaxPolylineItems = [];
                    this.roadSyntaxResetVisibleIndexCache();
                    this.roadSyntaxResetLodScoreCache();
                    this.roadSyntaxResetSpatialIndex();
                    this.roadSyntaxSourceFingerprint = '';
                    this.roadSyntaxPoolRadiusLabel = '';
                    this.roadSyntaxLastStyleKey = '';
                    this.roadSyntaxConnectivityReuseLayerKey = '';
                    this.roadSyntaxNodeBuildToken += 1;
                    this.roadSyntaxNodeBuildRunning = false;
                    this.roadSyntaxNodeSourceFingerprint = '';
                    this.clearRoadSyntaxNodeMarkers();
                    this.disposeRoadSyntaxScatterChart();
                    if (resetData) {
                        this.roadSyntaxStatus = '';
                        this.roadSyntaxStatusCopyHint = '';
                        this.roadSyntaxSummary = null;
                        this.roadSyntaxRoadFeatures = [];
                        this.roadSyntaxNodes = [];
                        this.roadSyntaxDiagnostics = null;
                        this.roadSyntaxLegendModel = null;
                        this.roadSyntaxSkeletonOnly = false;
                        this.roadSyntaxMainTab = 'params';
                        this.roadSyntaxMetric = 'accessibility';
                        this.roadSyntaxLastMetricTab = 'accessibility';
                        this.roadSyntaxRadiusLabel = 'global';
                    }
                    if (resetPerf) {
                        this.roadSyntaxSwitchSamples = [];
                        this.roadSyntaxSwitchLastMs = 0;
                        this.roadSyntaxSwitchP50Ms = 0;
                        this.roadSyntaxSwitchP95Ms = 0;
                        this.roadSyntaxSwitchStatsText = '';
                        this.roadSyntaxSwitchPath = '';
                    }
                    if (reason === 'unmount') {
                        this.roadSyntaxStatus = '';
                    }
                },
                resetRoadSyntaxState() {
                    this.roadSyntaxRequestToken += 1;
                    this.isComputingRoadSyntax = false;
                    this.invalidateRoadSyntaxCache('reset-state', { resetData: true, resetPerf: true });
                },
                clearRoadSyntaxOverlays() {
                    this.invalidateRoadSyntaxCache('clear-overlays', { resetData: false, resetPerf: false });
                },
                suspendRoadSyntaxDisplay() {
                    const map = this.roadSyntaxMap();
                    if (!map) return;
                    this.roadSyntaxDisplaySuspended = true;
                    this.roadSyntaxLayerSwitchToken += 1;
                    this.roadSyntaxClearViewportRefreshHandles();
                    this.roadSyntaxClearNodeRefreshTimer();
                    this.roadSyntaxBumpViewportRefreshToken();
                    this.roadSyntaxInteractionLowFidelity = false;
                    const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    this.roadSyntaxSetLinesVisible(lines, false, map, { preferBatch: true });
                    this.roadSyntaxVisibleLineSet = {};
                    this.roadSyntaxResetVisibleIndexCache();
                    this.roadSyntaxCurrentStride = 1;
                    this.cancelRoadSyntaxNodeBuild();
                    this.setRoadSyntaxNodeMarkersVisible(false);
                    this.disposeRoadSyntaxScatterChart();
                },
                resumeRoadSyntaxDisplay() {
                    if (
                        !this.roadSyntaxSummary
                        || !Array.isArray(this.roadSyntaxRoadFeatures)
                        || !this.roadSyntaxRoadFeatures.length
                    ) {
                        this.roadSyntaxDisplaySuspended = false;
                        return;
                    }
                    this.roadSyntaxDisplaySuspended = true;
                    this.renderRoadSyntaxOverlays({
                        type: 'FeatureCollection',
                        features: this.roadSyntaxRoadFeatures,
                    }, { forceRebuild: false, displayActive: true });
                },
                clearRoadSyntaxLayerPool() {
                    const map = this.roadSyntaxMap();
                    const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    this.roadSyntaxSetLinesVisible(lines, false, map, { preferBatch: true });
                    this.roadSyntaxClearViewportRefreshHandles();
                    this.roadSyntaxClearNodeRefreshTimer();
                    this.roadSyntaxLayerPool = {};
                    this.roadSyntaxLayerStyleCache = {};
                    this.roadSyntaxPolylines = [];
                    this.roadSyntaxVisibleLineSet = {};
                    this.roadSyntaxResetVisibleIndexCache();
                    this.roadSyntaxResetLodScoreCache();
                    this.roadSyntaxResetSpatialIndex();
                    this.roadSyntaxBumpViewportRefreshToken();
                    this.roadSyntaxInteractionLowFidelity = false;
                    this.roadSyntaxCurrentStride = 1;
                    this.roadSyntaxActiveLayerKey = '';
                    this.roadSyntaxPendingLayerKey = '';
                    this.roadSyntaxLayerBuildState = {};
                    this.roadSyntaxLayerBuildQueue = [];
                    this.roadSyntaxLayerBuildRunning = false;
                    this.roadSyntaxPoolInitRunning = false;
                    this.roadSyntaxPoolReady = false;
                    this.roadSyntaxPoolDegraded = false;
                    this.roadSyntaxPoolInitTotal = 0;
                    this.roadSyntaxPoolInitDone = 0;
                    this.roadSyntaxLayerReadyMap = {};
                    this.roadSyntaxConnectivityReuseLayerKey = '';
                },
                refreshRoadSyntaxLayerReadyMap() {
                    const keys = this.roadSyntaxLayerKeysForPrebuild();
                    const state = this.roadSyntaxLayerBuildState || {};
                    const cache = this.roadSyntaxLayerStyleCache || {};
                    const readyMap = {};
                    keys.forEach((key) => {
                        readyMap[key] = !!cache[key] && state[key] === 'ready';
                    });
                    this.roadSyntaxLayerReadyMap = readyMap;
                    this.roadSyntaxPoolInitTotal = keys.length;
                    this.roadSyntaxPoolInitDone = Object.values(readyMap).filter((v) => !!v).length;
                    return readyMap;
                },
                isRoadSyntaxMetricReady(metricValue = null, options = {}) {
                    if (!this.roadSyntaxSummary) return false;
                    const metric = String(metricValue || this.resolveRoadSyntaxActiveMetric() || 'accessibility');
                    const radiusLabel = options && Object.prototype.hasOwnProperty.call(options, 'radiusLabel')
                        ? String(options.radiusLabel || 'global')
                        : (this.roadSyntaxMetricUsesRadius(metric) ? String(this.roadSyntaxRadiusLabel || 'global') : 'global');
                    const skeletonOnly = options && Object.prototype.hasOwnProperty.call(options, 'skeletonOnly')
                        ? !!options.skeletonOnly
                        : false;
                    const key = this.resolveRoadSyntaxLayerKey(metric, { radiusLabel, skeletonOnly });
                    return this.isRoadSyntaxLayerReady(key);
                },
                canActivateRoadSyntaxTab(tabValue) {
                    const tab = String(tabValue || '').trim();
                    if (tab === 'params') return true;
                    if (!this.roadSyntaxSummary) return false;
                    return this.isRoadSyntaxMetricReady(tab);
                },
                canToggleRoadSyntaxSkeleton() {
                    const metric = this.resolveRoadSyntaxActiveMetric();
                    if (!this.roadSyntaxSupportsSkeleton(metric)) return false;
                    if (!this.roadSyntaxSummary) return false;
                    if (!this.roadSyntaxSkeletonOnly) {
                        return this.isRoadSyntaxMetricReady(metric, { skeletonOnly: true });
                    }
                    return this.isRoadSyntaxMetricReady(metric, { skeletonOnly: false });
                },
                cancelRoadSyntaxNodeBuild() {
                    this.roadSyntaxNodeBuildToken += 1;
                    this.roadSyntaxNodeBuildRunning = false;
                },
                shouldRenderRoadSyntaxConnectivityNodes() {
                    if (!this.mapCore || !this.mapCore.map) return false;
                    const minZoom = Number(this.roadSyntaxConnectivityNodeMinZoom || 15);
                    const zoom = Number(this.mapCore.map.getZoom ? this.mapCore.map.getZoom() : NaN);
                    if (!Number.isFinite(zoom)) return true;
                    return zoom >= minZoom;
                },
                setRoadSyntaxNodeMarkersVisible(visible) {
                    if (!Array.isArray(this.roadSyntaxNodeMarkers) || !this.roadSyntaxNodeMarkers.length) {
                        return;
                    }
                    if (visible && !this.shouldRenderRoadSyntaxConnectivityNodes()) {
                        visible = false;
                    }
                    const targetMap = (visible && this.mapCore && this.mapCore.map) ? this.mapCore.map : null;
                    this.roadSyntaxNodeMarkers.forEach((marker) => {
                        if (marker && typeof marker.setMap === 'function') {
                            marker.setMap(targetMap);
                        }
                    });
                },
                clearRoadSyntaxNodeMarkers() {
                    this.cancelRoadSyntaxNodeBuild();
                    if (!Array.isArray(this.roadSyntaxNodeMarkers)) {
                        this.roadSyntaxNodeMarkers = [];
                        return;
                    }
                    this.roadSyntaxNodeMarkers.forEach((marker) => {
                        if (marker && typeof marker.setMap === 'function') {
                            marker.setMap(null);
                        }
                    });
                    this.roadSyntaxNodeMarkers = [];
                },
                disposeRoadSyntaxScatterChart() {
                    const chart = this.roadSyntaxScatterChart;
                    if (chart && typeof chart.dispose === 'function') {
                        chart.dispose();
                    }
                    this.roadSyntaxScatterChart = null;
                },
                setRoadSyntaxMainTab(tabValue, options = {}) {
                    const value = String(tabValue || '').trim();
                    const validTabs = (this.roadSyntaxTabs || []).map((tab) => tab.value);
                    if (!validTabs.includes(value)) return;
                    if (value !== 'params' && this.roadSyntaxPoolInitRunning) {
                        this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载中', this.roadSyntaxPoolInitDone, this.roadSyntaxPoolInitTotal || 0));
                        return;
                    }
                    const syncMetric = options.syncMetric !== false;
                    const refresh = options.refresh !== false;
                    const previousTab = this.roadSyntaxMainTab;
                    const previousMetric = this.roadSyntaxMetric;
                    this.roadSyntaxMainTab = value;
                    if (value === 'params') {
                        this.cancelRoadSyntaxNodeBuild();
                        this.setRoadSyntaxNodeMarkersVisible(false);
                        this.disposeRoadSyntaxScatterChart();
                        return;
                    }
                    if (!this.isRoadSyntaxMetricReady(value)) {
                        const counts = this.roadSyntaxLayerReadyCounts();
                        if (this.roadSyntaxPoolDegraded) {
                            this.roadSyntaxSetStatus(`图层预处理已降级，指标“${this.roadSyntaxLabelByMetric(value)}”仍未就绪（${counts.ready}/${counts.total || 0}）`);
                        } else {
                            this.roadSyntaxSetStatus(`指标“${this.roadSyntaxLabelByMetric(value)}”仍在预处理（${counts.ready}/${counts.total || 0}）`);
                        }
                        return;
                    }
                    if (syncMetric) {
                        this.roadSyntaxMetric = value;
                        this.roadSyntaxLastMetricTab = value;
                    }
                    if (!this.roadSyntaxMetricUsesRadius(value)) {
                        this.roadSyntaxRadiusLabel = 'global';
                    }
                    if (previousTab === value && previousMetric === this.roadSyntaxMetric) {
                        return;
                    }
                    if (refresh) {
                        this.refreshRoadSyntaxOverlay();
                    }
                },
                roadSyntaxMetricTabs() {
                    return (this.roadSyntaxTabs || []).filter((item) => item.value !== 'params');
                },
                roadSyntaxLabelByMetric(metricValue) {
                    const metric = String(metricValue || '').trim();
                    const matched = this.roadSyntaxMetricTabs().find((item) => item.value === metric);
                    return matched ? matched.label : metric;
                },
                roadSyntaxMetricUsesRadius(metricValue = null) {
                    const metric = metricValue || this.roadSyntaxMetric || 'accessibility';
                    return metric === 'accessibility' || metric === 'choice' || metric === 'integration';
                },
                roadSyntaxSupportsSkeleton(metricValue = null) {
                    const metric = metricValue || this.roadSyntaxMetric || 'accessibility';
                    return metric === 'choice' || metric === 'integration';
                },
                onRoadSyntaxMetricChange(metricValue) {
                    this.setRoadSyntaxMainTab(metricValue);
                },
                formatRoadSyntaxMetricValue(metricValue) {
                    const summary = this.roadSyntaxSummary || {};
                    const metric = metricValue || 'accessibility';
                    let value = NaN;
                    if (metric === 'accessibility') {
                        value = Number(summary.avg_accessibility_global ?? summary.avg_closeness);
                    } else if (metric === 'connectivity') {
                        value = Number(summary.avg_connectivity ?? summary.avg_degree);
                    } else if (metric === 'choice') {
                        value = Number(summary.avg_choice_global);
                    } else if (metric === 'integration') {
                        value = Number(summary.avg_integration_global);
                    } else if (metric === 'intelligibility') {
                        value = Number(summary.avg_intelligibility);
                    }
                    if (!Number.isFinite(value)) return '--';
                    if (metric === 'connectivity') return value.toFixed(2);
                    if (metric === 'intelligibility') return value.toFixed(4);
                    return value.toFixed(6);
                },
                async copyRoadSyntaxStatus() {
                    const text = String(this.roadSyntaxStatus || '').trim();
                    if (!text) return;
                    try {
                        await navigator.clipboard.writeText(text);
                        this.roadSyntaxStatusCopyHint = '已复制';
                    } catch (_) {
                        this.roadSyntaxStatusCopyHint = '复制失败';
                    }
                    if (this._syntaxCopyHintTimer) {
                        window.clearTimeout(this._syntaxCopyHintTimer);
                    }
                    this._syntaxCopyHintTimer = window.setTimeout(() => {
                        this.roadSyntaxStatusCopyHint = '';
                    }, 1400);
                },
                roadSyntaxRadiusOptions() {
                    const labels = (this.roadSyntaxSummary && Array.isArray(this.roadSyntaxSummary.radius_labels))
                        ? this.roadSyntaxSummary.radius_labels
                        : [];
                    const options = labels.map((label) => {
                        const radiusNum = Number(String(label || '').replace(/^r/i, ''));
                        const radiusText = Number.isFinite(radiusNum) && radiusNum > 0 ? `${radiusNum}m` : String(label || '');
                        return { value: label, label: `局部 ${radiusText}` };
                    });
                    options.push({ value: 'global', label: '全局 (Rn)' });
                    return options;
                },
                resolveRoadSyntaxRequestMetric() {
                    return this.roadSyntaxMetric === 'choice' ? 'choice' : 'integration';
                },
                clamp01(value) {
                    return Math.max(0, Math.min(1, Number(value) || 0));
                },
                blendTwoColor(colorA, colorB, ratio) {
                    const a = Array.isArray(colorA) ? colorA : [0, 0, 0];
                    const b = Array.isArray(colorB) ? colorB : [0, 0, 0];
                    const t = this.clamp01(ratio);
                    const r = Math.round(a[0] + (b[0] - a[0]) * t);
                    const g = Math.round(a[1] + (b[1] - a[1]) * t);
                    const b2 = Math.round(a[2] + (b[2] - a[2]) * t);
                    const toHex = (c) => {
                        const hex = Math.max(0, Math.min(255, c)).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    };
                    return `#${toHex(r)}${toHex(g)}${toHex(b2)}`;
                },
                blendPaletteColor(stops, ratio) {
                    const palette = Array.isArray(stops) && stops.length ? stops : [[0, 0, 0], [255, 255, 255]];
                    const t = this.clamp01(ratio);
                    const toHex = (c) => {
                        const hex = Math.max(0, Math.min(255, c)).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    };
                    if (palette.length === 1) {
                        const c = palette[0];
                        return `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])}`;
                    }
                    const seg = Math.min(palette.length - 2, Math.floor(t * (palette.length - 1)));
                    const segStart = seg / (palette.length - 1);
                    const segEnd = (seg + 1) / (palette.length - 1);
                    const local = (t - segStart) / Math.max(1e-9, segEnd - segStart);
                    return this.blendTwoColor(palette[seg], palette[seg + 1], local);
                },
                roadSyntaxSummarizeCoordInput(input) {
                    if (input === null) return { type: 'null' };
                    if (typeof input === 'undefined') return { type: 'undefined' };
                    if (typeof input === 'string') return { type: 'string', value: String(input).slice(0, 80) };
                    if (Array.isArray(input)) {
                        return {
                            type: 'array',
                            length: input.length,
                            head: input.slice(0, 2),
                        };
                    }
                    if (typeof input === 'object') {
                        const out = { type: 'object' };
                        if (Object.prototype.hasOwnProperty.call(input, 'lng')) out.lng = input.lng;
                        if (Object.prototype.hasOwnProperty.call(input, 'lat')) out.lat = input.lat;
                        if (Object.prototype.hasOwnProperty.call(input, 'lon')) out.lon = input.lon;
                        if (typeof input.getLng === 'function') out.getLng = true;
                        if (typeof input.getLat === 'function') out.getLat = true;
                        return out;
                    }
                    return { type: typeof input, value: input };
                },
                roadSyntaxLogInvalidCoordInput(source = '', input = null) {
                    const key = String(source || 'unknown');
                    if (!this._roadSyntaxInvalidCoordStats) {
                        this._roadSyntaxInvalidCoordStats = Object.create(null);
                    }
                    const stats = this._roadSyntaxInvalidCoordStats;
                    if (!stats[key]) {
                        stats[key] = { count: 0 };
                    }
                    stats[key].count += 1;
                    const count = stats[key].count;
                    if (count <= 5) {
                        console.warn('[road-syntax] invalid coordinate input', {
                            source: key,
                            count: count,
                            sample: this.roadSyntaxSummarizeCoordInput(input)
                        });
                    } else if (count % 100 === 0) {
                        console.warn('[road-syntax] invalid coordinate input aggregated', {
                            source: key,
                            count: count
                        });
                    }
                },
                normalizeLngLat(input, source = '') {
                    let lng = NaN;
                    let lat = NaN;
                    if (Array.isArray(input) && input.length >= 2) {
                        lng = Number(input[0]);
                        lat = Number(input[1]);
                    } else if (input && typeof input === 'object') {
                        if (typeof input.getLng === 'function' && typeof input.getLat === 'function') {
                            lng = Number(input.getLng());
                            lat = Number(input.getLat());
                        } else if (Object.prototype.hasOwnProperty.call(input, 'lng') && Object.prototype.hasOwnProperty.call(input, 'lat')) {
                            lng = Number(input.lng);
                            lat = Number(input.lat);
                        } else if (Object.prototype.hasOwnProperty.call(input, 'lon') && Object.prototype.hasOwnProperty.call(input, 'lat')) {
                            lng = Number(input.lon);
                            lat = Number(input.lat);
                        }
                    } else if (typeof input === 'string') {
                        const parts = input.split(',');
                        if (parts.length >= 2) {
                            lng = Number(parts[0].trim());
                            lat = Number(parts[1].trim());
                        }
                    }
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                        this.roadSyntaxLogInvalidCoordInput(source || 'normalize_lnglat', input);
                        return null;
                    }
                    return [lng, lat];
                },
                normalizePath(path, minPoints = 2, source = '') {
                    const raw = Array.isArray(path) ? path : [];
                    const out = [];
                    raw.forEach((pt) => {
                        const loc = this.normalizeLngLat(pt, source || 'normalize_path');
                        if (!loc) return;
                        out.push(loc);
                    });
                    return out.length >= minPoints ? out : [];
                },
                resolveRoadSyntaxActiveMetric() {
                    if (this.roadSyntaxMainTab === 'params') {
                        return this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || 'accessibility';
                    }
                    return this.roadSyntaxMetric || 'accessibility';
                },
                resolveRoadSyntaxMetricField(metricValue = null, radiusLabelValue = null) {
                    const metric = metricValue || this.resolveRoadSyntaxActiveMetric();
                    const radiusLabel = radiusLabelValue || (this.roadSyntaxMetricUsesRadius(metric)
                        ? (this.roadSyntaxRadiusLabel || 'global')
                        : 'global');
                    if (metric === 'connectivity') {
                        return 'degree_score';
                    }
                    if (metric === 'intelligibility') {
                        return 'intelligibility_score';
                    }
                    if (metric === 'choice') {
                        return radiusLabel === 'global' ? 'choice_global' : `choice_${radiusLabel}`;
                    }
                    if (metric === 'integration') {
                        return radiusLabel === 'global' ? 'integration_global' : `integration_${radiusLabel}`;
                    }
                    return radiusLabel === 'global' ? 'accessibility_global' : `accessibility_${radiusLabel}`;
                },
                resolveRoadSyntaxLayerKey(metricValue = null, options = {}) {
                    const metric = metricValue || this.resolveRoadSyntaxActiveMetric();
                    const skeletonOnly = options && Object.prototype.hasOwnProperty.call(options, 'skeletonOnly')
                        ? !!options.skeletonOnly
                        : !!this.roadSyntaxSkeletonOnly;
                    const radiusLabel = options && Object.prototype.hasOwnProperty.call(options, 'radiusLabel')
                        ? String(options.radiusLabel || 'global')
                        : (this.roadSyntaxMetricUsesRadius(metric) ? String(this.roadSyntaxRadiusLabel || 'global') : 'global');
                    const useSkeleton = (metric === 'choice' || metric === 'integration') ? skeletonOnly : false;
                    const normalizedRadius = this.roadSyntaxMetricUsesRadius(metric) ? radiusLabel : 'global';
                    return `${metric}|${normalizedRadius}|${useSkeleton ? 1 : 0}`;
                },
                parseRoadSyntaxLayerKey(layerKey) {
                    const parts = String(layerKey || '').split('|');
                    const metric = parts[0] || 'accessibility';
                    const radiusLabel = parts[1] || 'global';
                    const skeletonOnly = parts[2] === '1';
                    return { metric, radiusLabel, skeletonOnly };
                },
                roadSyntaxLayerKeysForPrebuild() {
                    const radiusLabel = String(this.roadSyntaxRadiusLabel || 'global');
                    return [
                        this.resolveRoadSyntaxLayerKey('accessibility', { radiusLabel, skeletonOnly: false }),
                        this.resolveRoadSyntaxLayerKey('connectivity', { radiusLabel: 'global', skeletonOnly: false }),
                        this.resolveRoadSyntaxLayerKey('choice', { radiusLabel, skeletonOnly: false }),
                        this.resolveRoadSyntaxLayerKey('choice', { radiusLabel, skeletonOnly: true }),
                        this.resolveRoadSyntaxLayerKey('integration', { radiusLabel, skeletonOnly: false }),
                        this.resolveRoadSyntaxLayerKey('integration', { radiusLabel, skeletonOnly: true }),
                        this.resolveRoadSyntaxLayerKey('intelligibility', { radiusLabel: 'global', skeletonOnly: false }),
                    ];
                },
                resolveRoadSyntaxRankField(activeMetric) {
                    if (activeMetric === 'choice') return 'rank_quantile_choice';
                    if (activeMetric === 'integration') return 'rank_quantile_integration';
                    if (activeMetric === 'accessibility') return 'rank_quantile_accessibility';
                    return '';
                },
                roadSyntaxScoreFromProps(props, metricField, fallbackField) {
                    const main = Number(props && props[metricField]);
                    const fallback = Number(props && props[fallbackField]);
                    if (Number.isFinite(main)) return this.clamp01(main);
                    if (Number.isFinite(fallback)) return this.clamp01(fallback);
                    return 0;
                },
                roadSyntaxQuantileBreakLabels(scores) {
                    const values = (Array.isArray(scores) ? scores : [])
                        .map((v) => Number(v))
                        .filter((v) => Number.isFinite(v))
                        .sort((a, b) => a - b);
                    if (!values.length) {
                        return ['P10 --', 'P30 --', 'P70 --', 'P90 --'];
                    }
                    const q = (ratio) => {
                        const t = Math.max(0, Math.min(1, ratio));
                        if (values.length === 1) return values[0];
                        const pos = t * (values.length - 1);
                        const lo = Math.floor(pos);
                        const hi = Math.min(values.length - 1, lo + 1);
                        const f = pos - lo;
                        return values[lo] + (values[hi] - values[lo]) * f;
                    };
                    return [
                        `P10 ${q(0.1).toFixed(2)}`,
                        `P30 ${q(0.3).toFixed(2)}`,
                        `P70 ${q(0.7).toFixed(2)}`,
                        `P90 ${q(0.9).toFixed(2)}`,
                    ];
                },
                buildRoadSyntaxLegendModel(activeMetric) {
                    const metric = activeMetric || this.resolveRoadSyntaxActiveMetric();
                    const metricField = this.resolveRoadSyntaxMetricField(metric);
                    const fallbackField = this.resolveRoadSyntaxFallbackField(metric);
                    const scores = (Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [])
                        .map((item) => this.roadSyntaxScoreFromProps((item && item.props) || {}, metricField, fallbackField));
                    if (metric === 'accessibility') {
                        return {
                            type: 'gradient',
                            title: '可达性（Viridis）',
                            gradient: 'linear-gradient(90deg, rgb(68,1,84) 0%, rgb(59,82,139) 25%, rgb(33,145,140) 50%, rgb(94,201,97) 75%, rgb(253,231,37) 100%)',
                            labels: this.roadSyntaxQuantileBreakLabels(scores),
                        };
                    }
                    if (metric === 'integration') {
                        return {
                            type: 'gradient',
                            title: this.roadSyntaxSkeletonOnly ? '整合度（Plasma，骨架Top20%）' : '整合度（Plasma）',
                            gradient: 'linear-gradient(90deg, rgb(13,8,135) 0%, rgb(84,3,160) 25%, rgb(182,54,121) 50%, rgb(251,136,97) 75%, rgb(240,249,33) 100%)',
                            labels: this.roadSyntaxQuantileBreakLabels(scores),
                        };
                    }
                    if (metric === 'choice') {
                        return {
                            type: 'gradient',
                            title: this.roadSyntaxSkeletonOnly ? '选择度（线宽主导，骨架Top20%）' : '选择度（线宽主导）',
                            gradient: 'linear-gradient(90deg, rgb(148,163,184) 0%, rgb(180,110,95) 55%, rgb(234,88,12) 100%)',
                            labels: this.roadSyntaxQuantileBreakLabels(scores),
                        };
                    }
                    if (metric === 'connectivity') {
                        return {
                            type: 'discrete',
                            title: '连接度（节点大小/深浅）',
                            items: [
                                { label: '低连接', color: '#cbd5e1' },
                                { label: '高连接', color: '#991b1b' },
                            ],
                        };
                    }
                    return {
                        type: 'discrete',
                        title: '可理解度（散点回归）',
                        items: [
                            { label: '样本点', color: '#2563eb' },
                            { label: '回归线', color: '#dc2626' },
                        ],
                    };
                },
                roadSyntaxFootnoteByMetric() {
                    const metric = this.resolveRoadSyntaxActiveMetric();
                    if (metric === 'connectivity') {
                        return '连接度用节点符号表达（大小与颜色深浅代表连接强度），线段仅作为底图参照。';
                    }
                    if (metric === 'choice') {
                        return '选择度以线宽为主，颜色为辅；可开启骨架 Top20% 观察主通行走廊。';
                    }
                    if (metric === 'integration') {
                        return '整合度采用连续热力表达网络中心性；骨架模式仅高亮前20%高值线段。';
                    }
                    if (metric === 'intelligibility') {
                        return '可理解度主表达为散点回归图：x=连接度，y=整合度，R²越高表示空间越容易被理解。';
                    }
                    return '可达性采用连续热力表达（冷色低、暖色高），用于观察整体可达效率。';
                },
                roadSyntaxRegressionView() {
                    const diagnostics = this.roadSyntaxDiagnostics || {};
                    const reg = diagnostics.regression || {};
                    const summary = this.roadSyntaxSummary || {};
                    const r = Number(reg.r);
                    const r2 = Number(reg.r2);
                    const n = Number(reg.n);
                    const fallbackR = Number(summary.avg_intelligibility);
                    const fallbackR2 = Number(summary.avg_intelligibility_r2);
                    return {
                        r: Number.isFinite(r) ? r.toFixed(4) : (Number.isFinite(fallbackR) ? fallbackR.toFixed(4) : '--'),
                        r2: Number.isFinite(r2) ? r2.toFixed(4) : (Number.isFinite(fallbackR2) ? fallbackR2.toFixed(4) : '--'),
                        n: Number.isFinite(n) ? String(Math.round(n)) : String((diagnostics.intelligibility_scatter || []).length || 0),
                        slope: Number.isFinite(Number(reg.slope)) ? Number(reg.slope) : 0,
                        intercept: Number.isFinite(Number(reg.intercept)) ? Number(reg.intercept) : 0,
                    };
                },
                buildRoadSyntaxStyleForMetric(props, metricField, fallbackField, activeMetric, skeletonOnlyOverride = null) {
                    const score = this.roadSyntaxScoreFromProps(props, metricField, fallbackField);
                    const metric = activeMetric || this.resolveRoadSyntaxActiveMetric();
                    const skeletonOnly = skeletonOnlyOverride === null ? !!this.roadSyntaxSkeletonOnly : !!skeletonOnlyOverride;
                    if (metric === 'accessibility') {
                        const color = this.blendPaletteColor(
                            [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 97], [253, 231, 37]],
                            score
                        );
                        return {
                            strokeColor: color,
                            strokeWeight: 2.2 + score * 1.2,
                            strokeOpacity: 0.55 + score * 0.35,
                            zIndex: 90,
                        };
                    }
                    if (metric === 'integration') {
                        const isSkeleton = !!(props && props.is_skeleton_integration_top20);
                        if (skeletonOnly && !isSkeleton) {
                            return {
                                strokeColor: '#a1a1aa',
                                strokeWeight: 1.5,
                                strokeOpacity: 0.15,
                                zIndex: 82,
                            };
                        }
                        const color = this.blendPaletteColor(
                            [[13, 8, 135], [84, 3, 160], [182, 54, 121], [251, 136, 97], [240, 249, 33]],
                            score
                        );
                        return {
                            strokeColor: color,
                            strokeWeight: 2.1 + score * 1.4,
                            strokeOpacity: 0.5 + score * 0.35,
                            zIndex: 91,
                        };
                    }
                    if (metric === 'choice') {
                        const isSkeleton = !!(props && props.is_skeleton_choice_top20);
                        if (skeletonOnly && !isSkeleton) {
                            return {
                                strokeColor: '#9ca3af',
                                strokeWeight: 1.5,
                                strokeOpacity: 0.15,
                                zIndex: 82,
                            };
                        }
                        const color = this.blendTwoColor([148, 163, 184], [234, 88, 12], score);
                        return {
                            strokeColor: color,
                            strokeWeight: 2 + score * 6,
                            strokeOpacity: 0.42 + score * 0.46,
                            zIndex: 92,
                        };
                    }
                    if (metric === 'connectivity') {
                        return {
                            strokeColor: '#94a3b8',
                            strokeWeight: 1.5,
                            strokeOpacity: 0.26,
                            zIndex: 80,
                        };
                    }
                    return {
                        strokeColor: '#9ca3af',
                        strokeWeight: 1.4,
                        strokeOpacity: 0.22,
                        zIndex: 79,
                    };
                },
                refreshRoadSyntaxOverlay() {
                    if (this.roadSyntaxMainTab === 'params') {
                        return;
                    }
                    const metric = this.resolveRoadSyntaxActiveMetric();
                    const targetReady = this.isRoadSyntaxMetricReady(metric, { skeletonOnly: !!this.roadSyntaxSkeletonOnly });
                    if (!targetReady) {
                        const counts = this.roadSyntaxLayerReadyCounts();
                        this.roadSyntaxSetStatus(`目标图层仍在预处理（${counts.ready}/${counts.total || 0}）`);
                        return;
                    }
                    this.renderRoadSyntaxByMetric(this.resolveRoadSyntaxActiveMetric());
                },
                renderRoadSyntaxByMetric(metricValue = null) {
                    const activeMetric = metricValue || this.resolveRoadSyntaxActiveMetric();
                    if (!Array.isArray(this.roadSyntaxRoadFeatures) || this.roadSyntaxRoadFeatures.length === 0) {
                        this.clearRoadSyntaxOverlays();
                        this.roadSyntaxLegendModel = null;
                        return;
                    }
                    if (this.roadSyntaxPoolInitRunning && !this.roadSyntaxPoolReady) {
                        this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载中', this.roadSyntaxPoolInitDone, this.roadSyntaxPoolInitTotal || 0));
                    }
                    if (!this.isRoadSyntaxMetricReady(activeMetric, { skeletonOnly: !!this.roadSyntaxSkeletonOnly })) {
                        const counts = this.roadSyntaxLayerReadyCounts();
                        this.roadSyntaxSetStatus(`指标“${this.roadSyntaxLabelByMetric(activeMetric)}”仍在预处理（${counts.ready}/${counts.total || 0}）`);
                        return;
                    }
                    this.renderRoadSyntaxOverlays({
                        type: 'FeatureCollection',
                        features: this.roadSyntaxRoadFeatures,
                    }, { forceRebuild: false });
                    if (activeMetric === 'connectivity') {
                        this.renderRoadSyntaxNodeMarkers();
                    } else {
                        this.cancelRoadSyntaxNodeBuild();
                        this.setRoadSyntaxNodeMarkersVisible(false);
                    }
                    if (activeMetric === 'intelligibility') {
                        this.$nextTick(() => this.renderRoadSyntaxScatterChart());
                    } else {
                        this.disposeRoadSyntaxScatterChart();
                    }
                    this.roadSyntaxLegendModel = this.buildRoadSyntaxLegendModel(activeMetric);
                },
                resolveRoadSyntaxFallbackField(activeMetric) {
                    let fallbackField = 'accessibility_score';
                    if (activeMetric === 'choice') {
                        fallbackField = 'choice_score';
                    } else if (activeMetric === 'integration') {
                        fallbackField = 'integration_score';
                    } else if (activeMetric === 'connectivity') {
                        fallbackField = 'degree_score';
                    } else if (activeMetric === 'intelligibility') {
                        fallbackField = 'intelligibility_score';
                    }
                    return fallbackField;
                },
                renderRoadSyntaxNodeMarkers(options = {}) {
                    if (!this.mapCore || !this.mapCore.map || !window.AMap) return;
                    const forceRebuild = !!(options && options.forceRebuild);
                    if (!this.shouldRenderRoadSyntaxConnectivityNodes()) {
                        this.cancelRoadSyntaxNodeBuild();
                        this.setRoadSyntaxNodeMarkersVisible(false);
                        return;
                    }
                    let nodes = Array.isArray(this.roadSyntaxNodes) ? this.roadSyntaxNodes : [];
                    if (!nodes.length) {
                        const fallbackMap = {};
                        (this.roadSyntaxPolylineItems || []).forEach((item) => {
                            const coords = Array.isArray(item && item.coords) ? item.coords : [];
                            const props = (item && item.props) || {};
                            const score = this.clamp01(Number(props.degree_score));
                            const endpoints = [coords[0], coords[coords.length - 1]];
                            endpoints.forEach((pt) => {
                                const loc = this.normalizeLngLat(pt, 'road_syntax.node_fallback.endpoint');
                                if (!loc) return;
                                const key = `${loc[0].toFixed(6)},${loc[1].toFixed(6)}`;
                                const prev = fallbackMap[key];
                                if (!prev || score > prev.score) {
                                    fallbackMap[key] = { loc, score };
                                }
                            });
                        });
                        nodes = Object.keys(fallbackMap).map((key) => ({
                            geometry: { coordinates: fallbackMap[key].loc },
                            properties: {
                                degree_score: fallbackMap[key].score,
                                degree: Math.round(fallbackMap[key].score * 10),
                                integration_global: 0,
                            },
                        }));
                    }
                    if (!nodes.length) {
                        this.clearRoadSyntaxNodeMarkers();
                        return;
                    }

                    const zoom = Number(this.mapCore.map.getZoom ? this.mapCore.map.getZoom() : NaN);
                    let sampledNodes = nodes;
                    if (Number.isFinite(zoom) && zoom < 16 && nodes.length > 2200) {
                        const stride = Math.max(1, Math.ceil(nodes.length / 1800));
                        sampledNodes = nodes.filter((_, idx) => idx % stride === 0);
                    }

                    const firstCoord = this.normalizeLngLat((((sampledNodes[0] || {}).geometry || {}).coordinates || []), 'road_syntax.node_fingerprint.first') || [0, 0];
                    const lastCoord = this.normalizeLngLat((((sampledNodes[sampledNodes.length - 1] || {}).geometry || {}).coordinates || []), 'road_syntax.node_fingerprint.last') || [0, 0];
                    const sourceFingerprint = `${sampledNodes.length}|${firstCoord[0].toFixed(6)},${firstCoord[1].toFixed(6)}|${lastCoord[0].toFixed(6)},${lastCoord[1].toFixed(6)}`;
                    if (
                        !forceRebuild &&
                        sourceFingerprint === this.roadSyntaxNodeSourceFingerprint &&
                        Array.isArray(this.roadSyntaxNodeMarkers) &&
                        this.roadSyntaxNodeMarkers.length
                    ) {
                        this.setRoadSyntaxNodeMarkersVisible(true);
                        return;
                    }

                    this.clearRoadSyntaxNodeMarkers();
                    const buildToken = this.roadSyntaxNodeBuildToken + 1;
                    this.roadSyntaxNodeBuildToken = buildToken;
                    this.roadSyntaxNodeBuildRunning = true;
                    const markers = [];
                    let index = 0;

                    const step = () => {
                        if (buildToken !== this.roadSyntaxNodeBuildToken) {
                            markers.forEach((marker) => {
                                if (marker && typeof marker.setMap === 'function') marker.setMap(null);
                            });
                            return;
                        }
                        if (!this.shouldRenderRoadSyntaxConnectivityNodes()) {
                            markers.forEach((marker) => {
                                if (marker && typeof marker.setMap === 'function') marker.setMap(null);
                            });
                            this.roadSyntaxNodeBuildRunning = false;
                            return;
                        }
                        const nowFn = (window.performance && typeof window.performance.now === 'function')
                            ? () => window.performance.now()
                            : () => Date.now();
                        const frameStart = nowFn();
                        const budgetMs = this.roadSyntaxResolveFrameBudget('node');
                        while (index < sampledNodes.length) {
                            const feature = sampledNodes[index] || {};
                            index += 1;
                            const loc = this.normalizeLngLat((((feature || {}).geometry || {}).coordinates || []), 'road_syntax.node_marker.center');
                            if (!loc) continue;
                            const props = (feature && feature.properties) || {};
                            const score = this.clamp01(Number(props.degree_score));
                            const marker = new AMap.CircleMarker({
                                center: loc,
                                radius: 3 + score * 7,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                                fillColor: this.blendTwoColor([203, 213, 225], [153, 27, 27], score),
                                fillOpacity: 0.88,
                                zIndex: 115,
                                bubble: true,
                                clickable: false,
                                cursor: 'default',
                            });
                            marker.setMap(this.mapCore.map);
                            markers.push(marker);
                            if ((nowFn() - frameStart) >= budgetMs) break;
                        }
                        this.roadSyntaxNodeMarkers = markers;
                        if (index < sampledNodes.length) {
                            window.requestAnimationFrame(step);
                            return;
                        }
                        this.roadSyntaxNodeBuildRunning = false;
                        this.roadSyntaxNodeSourceFingerprint = sourceFingerprint;
                        this.setRoadSyntaxNodeMarkersVisible(true);
                    };
                    window.requestAnimationFrame(step);
                },
                renderRoadSyntaxScatterChart() {
                    if (this.roadSyntaxMainTab !== 'intelligibility') {
                        this.disposeRoadSyntaxScatterChart();
                        return;
                    }
                    if (!window.echarts) return;
                    const el = document.getElementById('roadSyntaxScatterChart');
                    if (!el || el.clientWidth === 0) return;
                    const diagnostics = this.roadSyntaxDiagnostics || {};
                    let points = Array.isArray(diagnostics.intelligibility_scatter)
                        ? diagnostics.intelligibility_scatter.map((p) => [Number(p.x), Number(p.y)])
                        : [];
                    points = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
                    if (!points.length) {
                        const nodes = Array.isArray(this.roadSyntaxNodes) ? this.roadSyntaxNodes : [];
                        points = nodes.map((f) => {
                            const props = (f && f.properties) || {};
                            return [Number(props.degree), Number(props.integration_global)];
                        }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
                    }
                    if (!points.length) {
                        this.disposeRoadSyntaxScatterChart();
                        return;
                    }
                    let chart = this.roadSyntaxScatterChart;
                    if (!chart || chart.isDisposed()) {
                        chart = echarts.getInstanceByDom(el) || echarts.init(el);
                        this.roadSyntaxScatterChart = chart;
                    }
                    const rv = this.roadSyntaxRegressionView();
                    const xMin = Math.min(...points.map((p) => p[0]));
                    const xMax = Math.max(...points.map((p) => p[0]));
                    const lineData = Number.isFinite(rv.slope) && Number.isFinite(rv.intercept)
                        ? [
                            [xMin, rv.slope * xMin + rv.intercept],
                            [xMax, rv.slope * xMax + rv.intercept],
                        ]
                        : [];
                    chart.setOption({
                        animation: false,
                        grid: { left: 42, right: 16, top: 20, bottom: 34 },
                        xAxis: { type: 'value', name: '连接度', nameLocation: 'middle', nameGap: 26, splitLine: { lineStyle: { color: '#eef2f7' } } },
                        yAxis: { type: 'value', name: '整合度', nameGap: 14, splitLine: { lineStyle: { color: '#eef2f7' } } },
                        series: [
                            {
                                type: 'scatter',
                                data: points,
                                symbolSize: 5,
                                itemStyle: { color: '#2563eb', opacity: 0.7 },
                                emphasis: { scale: false },
                            },
                            {
                                type: 'line',
                                data: lineData,
                                showSymbol: false,
                                lineStyle: { width: 2, color: '#dc2626', opacity: lineData.length ? 0.95 : 0 },
                            },
                        ],
                    }, true);
                    chart.resize();
                },
                buildRoadSyntaxRenderItems(features) {
                    const out = [];
                    let invalidCount = 0;
                    const invalidSamples = [];
                    (Array.isArray(features) ? features : []).forEach((feature, idx) => {
                        const coords = this.normalizePath((((feature || {}).geometry || {}).coordinates || []), 2, 'road_syntax.render_items.path');
                        if (!coords.length) {
                            invalidCount += 1;
                            if (invalidSamples.length < 5) {
                                const props = ((feature || {}).properties || {});
                                invalidSamples.push({
                                    idx: idx,
                                    id: props.edge_id || props.id || '',
                                    name: props.name || ''
                                });
                            }
                            return;
                        }
                        out.push({
                            coords: coords,
                            boundsRect: this.buildRoadSyntaxBoundsRect(coords),
                            props: ((feature || {}).properties || {}),
                        });
                    });
                    if (invalidCount > 0) {
                        console.warn('[road-syntax] skipped invalid road geometries', {
                            invalid_count: invalidCount,
                            total_features: Array.isArray(features) ? features.length : 0,
                            samples: invalidSamples
                        });
                    }
                    return out;
                },
                buildRoadSyntaxRenderFingerprint(items) {
                    const list = Array.isArray(items) ? items : [];
                    if (!list.length) return '0';
                    const first = list[0] || {};
                    const last = list[list.length - 1] || {};
                    const firstPt = this.normalizeLngLat((first.coords || [])[0], 'road_syntax.render_fingerprint.first') || [0, 0];
                    const lastCoords = last.coords || [];
                    const lastPt = this.normalizeLngLat(lastCoords[lastCoords.length - 1], 'road_syntax.render_fingerprint.last') || [0, 0];
                    return `${list.length}|${firstPt[0].toFixed(6)},${firstPt[1].toFixed(6)}|${lastPt[0].toFixed(6)},${lastPt[1].toFixed(6)}`;
                },
                rebuildRoadSyntaxBasePolylines() {
                    const map = this.roadSyntaxMap();
                    if (!map || !window.AMap) return [];
                    const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                    const lines = [];
                    items.forEach((item) => {
                        const line = new AMap.Polyline({
                            path: (item && item.coords) || [],
                            bubble: true,
                            clickable: false,
                            cursor: 'default',
                        });
                        line.setMap(null);
                        lines.push(line);
                    });
                    this.roadSyntaxPolylines = lines;
                    this.roadSyntaxVisibleLineSet = {};
                    this.roadSyntaxResetVisibleIndexCache();
                    this.roadSyntaxResetLodScoreCache();
                    this.roadSyntaxResetSpatialIndex();
                    return lines;
                },
                isRoadSyntaxLayerReady(layerKey) {
                    const state = this.roadSyntaxLayerBuildState || {};
                    const styleCache = this.roadSyntaxLayerStyleCache || {};
                    return !!styleCache[layerKey] && state[layerKey] === 'ready';
                },
                enqueueRoadSyntaxLayerBuild(layerKey, options = {}) {
                    if (!this.roadSyntaxMap() || !window.AMap) return;
                    if (!Array.isArray(this.roadSyntaxPolylineItems) || !this.roadSyntaxPolylineItems.length) return;
                    const priority = !!(options && options.priority);
                    const switchOnReady = !!(options && options.switchOnReady);
                    const state = Object.assign({}, this.roadSyntaxLayerBuildState || {});
                    const queue = Array.isArray(this.roadSyntaxLayerBuildQueue) ? this.roadSyntaxLayerBuildQueue.slice() : [];
                    const cur = state[layerKey];

                    if (cur === 'ready') {
                        if (switchOnReady) {
                            this.roadSyntaxPendingLayerKey = layerKey;
                            this.switchRoadSyntaxLayerByKey(layerKey);
                        }
                        return;
                    }
                    if (cur === 'building' || cur === 'queued') {
                        if (switchOnReady) {
                            this.roadSyntaxPendingLayerKey = layerKey;
                        }
                        return;
                    }

                    state[layerKey] = 'queued';
                    if (priority) {
                        queue.unshift(layerKey);
                    } else {
                        queue.push(layerKey);
                    }
                    if (switchOnReady) {
                        this.roadSyntaxPendingLayerKey = layerKey;
                    }
                    this.roadSyntaxLayerBuildState = state;
                    this.roadSyntaxLayerBuildQueue = queue;
                    this.scheduleRoadSyntaxLayerBuilder();
                },
                scheduleRoadSyntaxLayerBuilder() {
                    if (this.roadSyntaxLayerBuildRunning) return;
                    const queue = Array.isArray(this.roadSyntaxLayerBuildQueue) ? this.roadSyntaxLayerBuildQueue : [];
                    if (!queue.length) return;
                    const layerKey = queue.shift();
                    this.roadSyntaxLayerBuildQueue = queue;
                    const state = Object.assign({}, this.roadSyntaxLayerBuildState || {});
                    state[layerKey] = 'building';
                    this.roadSyntaxLayerBuildState = state;
                    this.roadSyntaxLayerBuildRunning = true;
                    const buildToken = this.roadSyntaxLayerBuildToken + 1;
                    this.roadSyntaxLayerBuildToken = buildToken;

                    const parsed = this.parseRoadSyntaxLayerKey(layerKey);
                    const metric = parsed.metric;
                    const metricField = this.resolveRoadSyntaxMetricField(metric, parsed.radiusLabel);
                    const fallbackField = this.resolveRoadSyntaxFallbackField(metric);
                    const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                    const styles = [];

                    let index = 0;
                    const step = () => {
                        if (buildToken !== this.roadSyntaxLayerBuildToken) return;
                        if (this.roadSyntaxIsInteractingInMetricView()) {
                            window.setTimeout(() => {
                                if (buildToken !== this.roadSyntaxLayerBuildToken) return;
                                window.requestAnimationFrame(step);
                            }, 60);
                            return;
                        }
                        const nowFn = (window.performance && typeof window.performance.now === 'function')
                            ? () => window.performance.now()
                            : () => Date.now();
                        const frameStart = nowFn();
                        const budgetMs = this.roadSyntaxResolveFrameBudget('layer');
                        while (index < items.length) {
                            const item = items[index] || {};
                            index += 1;
                            const style = this.buildRoadSyntaxStyleForMetric(
                                (item && item.props) || {},
                                metricField,
                                fallbackField,
                                metric,
                                parsed.skeletonOnly
                            );
                            styles.push(style);
                            if ((nowFn() - frameStart) >= budgetMs) {
                                break;
                            }
                        }
                        if (index < items.length) {
                            window.requestAnimationFrame(step);
                            return;
                        }
                        const styleCache = Object.assign({}, this.roadSyntaxLayerStyleCache || {});
                        styleCache[layerKey] = styles;
                        this.roadSyntaxLayerStyleCache = styleCache;
                        const doneState = Object.assign({}, this.roadSyntaxLayerBuildState || {});
                        doneState[layerKey] = 'ready';
                        this.roadSyntaxLayerBuildState = doneState;
                        this.roadSyntaxLayerBuildRunning = false;
                        const readyMap = this.refreshRoadSyntaxLayerReadyMap();
                        const readyCount = Object.values(readyMap).filter((v) => !!v).length;
                        const totalCount = Object.keys(readyMap).length;
                        if (totalCount > 0 && readyCount >= totalCount) {
                            const hadDegraded = !!this.roadSyntaxPoolDegraded;
                            this.roadSyntaxPoolReady = true;
                            this.roadSyntaxPoolDegraded = false;
                            if (this.roadSyntaxPoolInitRunning) {
                                this.roadSyntaxPoolInitRunning = false;
                            }
                            if (hadDegraded) {
                                this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层补建完成', readyCount, totalCount));
                            }
                        } else if (this.roadSyntaxPoolInitRunning) {
                            this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载中', readyCount, totalCount));
                        }
                        if (this.roadSyntaxPendingLayerKey === layerKey) {
                            this.switchRoadSyntaxLayerByKey(layerKey, { force: true });
                        }
                        this.scheduleRoadSyntaxLayerBuilder();
                    };
                    window.requestAnimationFrame(step);
                },
                switchRoadSyntaxLayerByKey(layerKey, options = {}) {
                    const map = this.roadSyntaxMap();
                    if (!map) return;
                    const force = !!(options && options.force);
                    const trackPerf = !options || options.trackPerf !== false;
                    if (!force) {
                        this.roadSyntaxPrewarmToken += 1;
                        if (this.roadSyntaxSwitchInProgress) {
                            this.roadSyntaxSwitchQueuedLayerKey = layerKey;
                            return;
                        }
                        const nowAt = this.roadSyntaxNow();
                        const cooldownMs = Math.max(0, Number(this.roadSyntaxSwitchCooldownMs || 0));
                        const elapsed = nowAt - Number(this.roadSyntaxSwitchLastAt || 0);
                        if (elapsed < cooldownMs) {
                            this.roadSyntaxSwitchQueuedLayerKey = layerKey;
                            if (!this.roadSyntaxSwitchThrottleTimer) {
                                const waitMs = Math.max(0, Math.ceil(cooldownMs - elapsed));
                                this.roadSyntaxSwitchThrottleTimer = window.setTimeout(() => {
                                    this.roadSyntaxSwitchThrottleTimer = null;
                                    const queued = String(this.roadSyntaxSwitchQueuedLayerKey || '');
                                    this.roadSyntaxSwitchQueuedLayerKey = '';
                                    if (queued) this.switchRoadSyntaxLayerByKey(queued);
                                }, waitMs);
                            }
                            return;
                        }
                    }
                    if (!this.isRoadSyntaxLayerReady(layerKey)) {
                        this.enqueueRoadSyntaxLayerBuild(layerKey, { priority: true, switchOnReady: false });
                        const counts = this.roadSyntaxLayerReadyCounts();
                        this.roadSyntaxSetStatus(`图层仍在预处理，暂不可切换（${counts.ready}/${counts.total || 0}）`);
                        return;
                    }
                    if (this.roadSyntaxActiveLayerKey === layerKey && !force && !this.roadSyntaxDisplaySuspended) {
                        if (this.roadSyntaxPendingLayerKey === layerKey) {
                            this.roadSyntaxPendingLayerKey = '';
                        }
                        return;
                    }
                    const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    if (!lines.length) {
                        this.rebuildRoadSyntaxBasePolylines();
                    }
                    const showLines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                    const styleCache = this.roadSyntaxLayerStyleCache || {};
                    const styles = Array.isArray(styleCache[layerKey]) ? styleCache[layerKey] : [];
                    if (!styles.length || styles.length !== showLines.length) {
                        this.enqueueRoadSyntaxLayerBuild(layerKey, { priority: true, switchOnReady: true });
                        const counts = this.roadSyntaxLayerReadyCounts();
                        this.roadSyntaxSetStatus(`图层仍在预处理，暂不可切换（${counts.ready}/${counts.total || 0}）`);
                        return;
                    }
                    const switchToken = this.roadSyntaxLayerSwitchToken + 1;
                    this.roadSyntaxLayerSwitchToken = switchToken;
                    this.roadSyntaxStyleApplyToken += 1;
                    const styleApplyToken = this.roadSyntaxStyleApplyToken;
                    this.roadSyntaxSwitchInProgress = true;
                    const startAt = this.roadSyntaxNow();
                    const finalize = (pathLabel = '') => {
                        if (switchToken !== this.roadSyntaxLayerSwitchToken) {
                            this.roadSyntaxSwitchInProgress = false;
                            return;
                        }
                        this.roadSyntaxPolylines = showLines;
                        this.roadSyntaxActiveLayerKey = layerKey;
                        this.roadSyntaxLastStyleKey = layerKey;
                        this.roadSyntaxDisplaySuspended = false;
                        if (this.roadSyntaxPendingLayerKey === layerKey) {
                            this.roadSyntaxPendingLayerKey = '';
                        }
                        if (trackPerf) {
                            this.recordRoadSyntaxSwitchDuration(startAt, layerKey, 0, showLines.length, pathLabel);
                        }
                        if (
                            this.roadSyntaxPoolReady
                            && this.roadSyntaxSummary
                            && String(this.roadSyntaxStatus || '').includes('预处理')
                        ) {
                            this.roadSyntaxSetStatus(this.buildRoadSyntaxCompletionStatus(true));
                        }
                        this.roadSyntaxSwitchInProgress = false;
                        this.roadSyntaxSwitchLastAt = this.roadSyntaxNow();
                        const queued = String(this.roadSyntaxSwitchQueuedLayerKey || '');
                        if (queued && queued !== layerKey) {
                            this.roadSyntaxSwitchQueuedLayerKey = '';
                            window.requestAnimationFrame(() => this.switchRoadSyntaxLayerByKey(queued));
                        }
                    };
                    const viewport = this.roadSyntaxApplyViewportFilter({
                        layerKey: layerKey,
                        applyStyle: false,
                    });
                    const visibleCount = Number(viewport && viewport.visible) || 0;
                    const visibleIndexes = Object.keys(this.roadSyntaxVisibleLineSet || {})
                        .map((v) => Number(v))
                        .filter((v) => Number.isFinite(v));
                    const totalVisible = visibleIndexes.length;
                    const eagerCount = (this.roadSyntaxViewportLazyEnabled && totalVisible > 260)
                        ? Math.min(180, totalVisible)
                        : totalVisible;
                    for (let i = 0; i < eagerCount; i += 1) {
                        const lineIdx = visibleIndexes[i];
                        const line = showLines[lineIdx];
                        const style = styles[lineIdx] || null;
                        if (line && style && typeof line.setOptions === 'function') {
                            try { line.setOptions(style); } catch (_) { }
                        }
                    }
                    finalize(this.roadSyntaxViewportLazyEnabled ? (eagerCount < totalVisible ? 'single_viewport_fast' : 'single_viewport') : 'single_sync');
                    if (eagerCount < totalVisible) {
                        let idx = eagerCount;
                        const step = () => {
                            if (styleApplyToken !== this.roadSyntaxStyleApplyToken) return;
                            const nowFn = (window.performance && typeof window.performance.now === 'function')
                                ? () => window.performance.now()
                                : () => Date.now();
                            const frameStart = nowFn();
                            const budgetMs = this.roadSyntaxResolveFrameBudget('line_switch', totalVisible);
                            while (idx < totalVisible) {
                                const lineIdx = visibleIndexes[idx];
                                idx += 1;
                                const line = showLines[lineIdx];
                                const style = styles[lineIdx] || null;
                                if (line && style && typeof line.setOptions === 'function') {
                                    try { line.setOptions(style); } catch (_) { }
                                }
                                if ((nowFn() - frameStart) >= budgetMs) break;
                            }
                            if (idx < totalVisible) {
                                window.requestAnimationFrame(step);
                            }
                        };
                        window.requestAnimationFrame(step);
                    }
                    if (visibleCount <= 0) {
                        this.roadSyntaxSetLinesVisible(showLines, true, map, { preferBatch: true });
                    }
                    if (this.roadSyntaxMapInteracting && this.roadSyntaxCurrentStride > 1) {
                        this.roadSyntaxApplyInteractionStride(this.roadSyntaxCurrentStride);
                    }
                },
                warmRoadSyntaxLayerPool(activeLayerKey = '') {
                    const state = this.roadSyntaxLayerBuildState || {};
                    const keys = this.roadSyntaxLayerKeysForPrebuild().filter((key) => {
                        if (key === activeLayerKey) return false;
                        const s = state[key];
                        return s !== 'ready' && s !== 'building' && s !== 'queued';
                    });
                    keys.forEach((key) => this.enqueueRoadSyntaxLayerBuild(key, { priority: false, switchOnReady: false }));
                },
                waitRoadSyntaxLayerReady(layerKey, timeoutMs = ROAD_SYNTAX_CONST.PREBUILD_DEADLINE_MS) {
                    return new Promise((resolve) => {
                        const start = Date.now();
                        const tick = () => {
                            if (this.isRoadSyntaxLayerReady(layerKey)) {
                                resolve(true);
                                return;
                            }
                            if ((Date.now() - start) > timeoutMs) {
                                resolve(false);
                                return;
                            }
                            window.setTimeout(tick, 25);
                        };
                        tick();
                    });
                },
                prewarmRoadSyntaxLayerVisibility(requestToken, activeLayerKey = '') {
                    if (requestToken !== this.roadSyntaxRequestToken) return Promise.resolve(false);
                    return Promise.resolve(true);
                },
                prewarmRoadSyntaxSwitchPath(requestToken, activeLayerKey = '') {
                    if (requestToken !== this.roadSyntaxRequestToken) return Promise.resolve(false);
                    if (activeLayerKey) {
                        this.switchRoadSyntaxLayerByKey(activeLayerKey, { force: true, trackPerf: false });
                    }
                    return Promise.resolve(true);
                },
                async initializeRoadSyntaxPoolFully(requestToken, activeLayerKey = '') {
                    const keysRaw = this.roadSyntaxLayerKeysForPrebuild();
                    const keys = activeLayerKey
                        ? [activeLayerKey].concat(keysRaw.filter((key) => key !== activeLayerKey))
                        : keysRaw.slice();
                    if (!keys.length) {
                        this.roadSyntaxPoolReady = true;
                        this.roadSyntaxPoolDegraded = false;
                        return true;
                    }
                    const totalBudgetMs = Number(this.roadSyntaxPrebuildDeadlineMs || ROAD_SYNTAX_CONST.PREBUILD_DEADLINE_MS);
                    const startedAt = Date.now();
                    this.roadSyntaxPoolInitRunning = true;
                    this.roadSyntaxPoolReady = false;
                    this.roadSyntaxPoolDegraded = false;
                    this.roadSyntaxPoolInitTotal = keys.length;
                    this.roadSyntaxPoolInitDone = 0;
                    this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载中', 0, keys.length));
                    this.refreshRoadSyntaxLayerReadyMap();
                    keys.forEach((key, idx) => this.enqueueRoadSyntaxLayerBuild(key, {
                        priority: idx === 0,
                        switchOnReady: false,
                    }));

                    let partial = false;
                    for (let i = 0; i < keys.length; i += 1) {
                        if (requestToken !== this.roadSyntaxRequestToken) {
                            this.roadSyntaxPoolInitRunning = false;
                            return false;
                        }
                        const elapsed = Date.now() - startedAt;
                        const remaining = totalBudgetMs - elapsed;
                        if (remaining <= 0) {
                            partial = true;
                            break;
                        }
                        const ok = await this.waitRoadSyntaxLayerReady(keys[i], remaining);
                        if (!ok) {
                            partial = true;
                            break;
                        }
                        this.roadSyntaxPoolInitDone = i + 1;
                        this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载中', this.roadSyntaxPoolInitDone, this.roadSyntaxPoolInitTotal));
                    }
                    this.roadSyntaxPoolInitRunning = false;
                    const readyMap = this.refreshRoadSyntaxLayerReadyMap();
                    const readyCount = Object.values(readyMap).filter((v) => !!v).length;
                    const allReady = readyCount >= keys.length;
                    this.roadSyntaxPoolReady = allReady;
                    this.roadSyntaxPoolDegraded = !allReady;
                    if (allReady) {
                        this.roadSyntaxSetStatus(this.roadSyntaxFormatReadyStatus('图层预加载完成', readyCount, keys.length));
                        const firstPrewarmToken = this.roadSyntaxPrewarmToken + 1;
                        this.roadSyntaxPrewarmToken = firstPrewarmToken;
                        window.setTimeout(() => {
                            if (firstPrewarmToken !== this.roadSyntaxPrewarmToken) return;
                            if (requestToken !== this.roadSyntaxRequestToken) return;
                            if (this.roadSyntaxSwitchInProgress || this.roadSyntaxSwitchQueuedLayerKey) return;
                            this.prewarmRoadSyntaxFirstSwitch(requestToken, activeLayerKey || keys[0] || '').catch(() => { });
                        }, 1200);
                        if (this.roadSyntaxEnableHeavyPrewarm) {
                            const prewarmToken = this.roadSyntaxPrewarmToken + 1;
                            this.roadSyntaxPrewarmToken = prewarmToken;
                            window.setTimeout(async () => {
                                if (prewarmToken !== this.roadSyntaxPrewarmToken) return;
                                if (requestToken !== this.roadSyntaxRequestToken) return;
                                try {
                                    await this.prewarmRoadSyntaxLayerVisibility(requestToken, activeLayerKey || keys[0] || '');
                                    await this.prewarmRoadSyntaxSwitchPath(requestToken, activeLayerKey || keys[0] || '');
                                } catch (_) { }
                            }, 0);
                        }
                    }
                    if (!allReady && partial) {
                        this.roadSyntaxSetStatus(`图层预加载超时，进入降级模式：${readyCount}/${keys.length}`);
                    }
                    return allReady;
                },
                renderRoadSyntaxOverlays(roadsFeatureCollection, options = {}) {
                    if (!this.roadSyntaxMap() || !window.AMap) return;
                    const forceRebuild = Boolean(options && options.forceRebuild);
                    const displayActive = !(options && options.displayActive === false);
                    const features = ((roadsFeatureCollection || {}).features || []);
                    this.roadSyntaxRoadFeatures = Array.isArray(features) ? features : [];
                    if (!this.roadSyntaxRoadFeatures.length) {
                        this.clearRoadSyntaxOverlays();
                        return;
                    }
                    const renderItems = this.buildRoadSyntaxRenderItems(this.roadSyntaxRoadFeatures);
                    if (!renderItems.length) {
                        this.clearRoadSyntaxOverlays();
                        return;
                    }
                    const fingerprint = this.buildRoadSyntaxRenderFingerprint(renderItems);
                    const shouldRebuildPool = forceRebuild
                        || !this.roadSyntaxSourceFingerprint
                        || this.roadSyntaxSourceFingerprint !== fingerprint
                        || !Array.isArray(this.roadSyntaxPolylines)
                        || this.roadSyntaxPolylines.length !== renderItems.length;
                    if (shouldRebuildPool) {
                        this.roadSyntaxPoolWarmToken += 1;
                        this.roadSyntaxLayerBuildToken += 1;
                        this.roadSyntaxLayerSwitchToken += 1;
                        this.clearRoadSyntaxLayerPool();
                        this.roadSyntaxPolylineItems = renderItems;
                        this.roadSyntaxSourceFingerprint = fingerprint;
                        this.roadSyntaxPoolRadiusLabel = String(this.roadSyntaxRadiusLabel || 'global');
                        this.roadSyntaxPoolReady = false;
                        this.roadSyntaxPoolDegraded = false;
                        this.rebuildRoadSyntaxBasePolylines();
                    }
                    this.roadSyntaxResetVisibleIndexCache();
                    this.roadSyntaxResetLodScoreCache();
                    const activeMetric = this.resolveRoadSyntaxActiveMetric();
                    const activeLayerKey = this.resolveRoadSyntaxLayerKey(activeMetric);
                    if (displayActive) {
                        if (this.isRoadSyntaxLayerReady(activeLayerKey)) {
                            const forceSwitch = this.roadSyntaxDisplaySuspended
                                || !Array.isArray(this.roadSyntaxPolylines)
                                || this.roadSyntaxPolylines.length === 0;
                            this.switchRoadSyntaxLayerByKey(activeLayerKey, { force: forceSwitch });
                        } else {
                            this.enqueueRoadSyntaxLayerBuild(activeLayerKey, { priority: true, switchOnReady: true });
                            const counts = this.roadSyntaxLayerReadyCounts();
                            this.roadSyntaxSetStatus(`图层预处理中：${counts.ready}/${counts.total || 0}`);
                        }
                        this.roadSyntaxLogOverlayHealth('render-road-syntax');
                    }
                    this.warmRoadSyntaxLayerPool(activeLayerKey);
                    this.refreshRoadSyntaxLayerReadyMap();
                    this.roadSyntaxPolylineItems = renderItems;
                },
                buildRoadSyntaxRequestPayload(polygon, edgeCap) {
                    return {
                        polygon: polygon,
                        coord_type: 'gcj02',
                        mode: this.roadSyntaxMode || this.transportMode || 'walking',
                        include_geojson: true,
                        max_edge_features: edgeCap,
                        merge_geojson_edges: true,
                        merge_bucket_step: 0.025,
                        radii_m: [800, 2000],
                        metric: this.resolveRoadSyntaxRequestMetric(),
                    };
                },
                applyRoadSyntaxResponseData(data, preferredMetricTab = 'accessibility') {
                    this.roadSyntaxRoadFeatures = Array.isArray((data && data.roads && data.roads.features) || [])
                        ? data.roads.features
                        : [];
                    this.roadSyntaxNodes = Array.isArray((data && data.nodes && data.nodes.features) || [])
                        ? data.nodes.features
                        : [];
                    this.roadSyntaxDiagnostics = (data && data.diagnostics) ? data.diagnostics : null;
                    this.roadSyntaxSummary = data && data.summary ? data.summary : null;
                    this.roadSyntaxSkeletonOnly = false;
                    if (!this.roadSyntaxSummary) return;
                    const validMetrics = this.roadSyntaxMetricTabs().map((item) => item.value);
                    const targetMetric = validMetrics.includes(preferredMetricTab)
                        ? preferredMetricTab
                        : 'accessibility';
                    this.roadSyntaxMetric = targetMetric;
                    this.roadSyntaxLastMetricTab = targetMetric;
                    const radiusOptions = this.roadSyntaxRadiusOptions();
                    const candidateRadius = String(this.roadSyntaxSummary.default_radius_label || 'global');
                    const hasCandidate = radiusOptions.some((opt) => opt.value === candidateRadius);
                    if (this.roadSyntaxMetricUsesRadius(targetMetric)) {
                        this.roadSyntaxRadiusLabel = hasCandidate ? candidateRadius : 'global';
                    } else {
                        this.roadSyntaxRadiusLabel = 'global';
                    }
                },
                buildRoadSyntaxCompletionStatus(poolReady) {
                    if (!this.roadSyntaxSummary) return '完成：未返回有效汇总数据';
                    const engine = this.roadSyntaxSummary.analysis_engine || 'depthmapxcli';
                    const base = `完成：${this.roadSyntaxSummary.node_count || 0} 节点，${this.roadSyntaxSummary.edge_count || 0} 边段（${engine}`;
                    if (poolReady) return `${base}，已预加载图层）`;
                    if (this.roadSyntaxPoolDegraded) {
                        return `${base}，预加载超时降级 ${this.roadSyntaxPoolInitDone}/${this.roadSyntaxPoolInitTotal}）`;
                    }
                    return `${base}，图层预加载未完成）`;
                },
                async computeRoadSyntax() {
                    if (!this.lastIsochroneGeoJSON || this.isComputingRoadSyntax) return;
                    if (this.roadSyntaxMainTab !== 'params') {
                        this.setRoadSyntaxMainTab('params', { refresh: false, syncMetric: false });
                    }
                    this.isComputingRoadSyntax = true;
                    this.roadSyntaxStatusCopyHint = '';
                    this.roadSyntaxSetStatus('正在请求路网并计算空间句法指标...');
                    const requestToken = this.roadSyntaxRequestToken + 1;
                    this.roadSyntaxRequestToken = requestToken;
                    const preferredMetricTab = this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || 'accessibility';

                    try {
                        const polygon = this.getIsochronePolygonPoints();
                        if (!polygon.length) {
                            throw new Error('等时圈范围无效');
                        }
                        this.invalidateRoadSyntaxCache('recompute-road-syntax', { resetData: false, resetPerf: true });
                        this.roadSyntaxSummary = null;
                        this.roadSyntaxRoadFeatures = [];
                        this.roadSyntaxNodes = [];
                        this.roadSyntaxDiagnostics = null;
                        this.roadSyntaxLegendModel = null;
                        const edgeCap = this.resolveRoadSyntaxEdgeCap();
                        const payload = this.buildRoadSyntaxRequestPayload(polygon, edgeCap);

                        const res = await fetch('/api/v1/analysis/road-syntax', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                            let detail = '';
                            try {
                                detail = await res.text();
                            } catch (_) { }
                            throw new Error(detail || '路网分析失败');
                        }
                        const data = await res.json();
                        if (requestToken !== this.roadSyntaxRequestToken) {
                            return;
                        }
                        this.applyRoadSyntaxResponseData(data, preferredMetricTab);
                        this.renderRoadSyntaxOverlays((data && data.roads) || null, {
                            forceRebuild: true,
                            displayActive: this.activeStep3Panel === 'syntax',
                        });

                        let poolReady = false;
                        if (this.roadSyntaxSummary && Array.isArray(this.roadSyntaxRoadFeatures) && this.roadSyntaxRoadFeatures.length) {
                            const activeLayerKey = this.resolveRoadSyntaxLayerKey(this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || 'accessibility');
                            poolReady = await this.initializeRoadSyntaxPoolFully(requestToken, activeLayerKey);
                        }
                        if (this.roadSyntaxSummary) {
                            this.setRoadSyntaxMainTab(this.roadSyntaxLastMetricTab || 'accessibility', {
                                refresh: false,
                                syncMetric: true,
                            });
                            if (this.activeStep3Panel === 'syntax') {
                                this.renderRoadSyntaxByMetric(this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || 'accessibility');
                            }
                        }
                        this.roadSyntaxSetStatus(this.buildRoadSyntaxCompletionStatus(poolReady));
                    } catch (e) {
                        if (requestToken !== this.roadSyntaxRequestToken) {
                            return;
                        }
                        console.error(e);
                        this.roadSyntaxSetStatus('失败: ' + (e && e.message ? e.message : String(e)));
                    } finally {
                        if (requestToken === this.roadSyntaxRequestToken) {
                            this.isComputingRoadSyntax = false;
                        }
                    }
                },
                clearAoiMarkers() {
                    if (!Array.isArray(this.aoiMarkers)) {
                        this.aoiMarkers = [];
                        return;
                    }
                    this.aoiMarkers.forEach((marker) => {
                        if (marker && typeof marker.setMap === 'function') {
                            marker.setMap(null);
                        }
                    });
                    this.aoiMarkers = [];
                },
                renderAois(aois) {
                    this.clearAoiMarkers();
                    if (!this.mapCore || !this.mapCore.map || !window.AMap) return;
                    const list = Array.isArray(aois) ? aois : [];
                    const markers = [];
                    let invalidCount = 0;
                    const invalidSamples = [];
                    list.forEach((aoi) => {
                        const loc = this.normalizeLngLat(aoi && aoi.location, 'aoi.render.location');
                        if (!loc) {
                            invalidCount += 1;
                            if (invalidSamples.length < 5) {
                                invalidSamples.push({
                                    id: (aoi && aoi.id) || '',
                                    name: (aoi && aoi.name) || '',
                                    location: this.roadSyntaxSummarizeCoordInput(aoi && aoi.location)
                                });
                            }
                            return;
                        }
                        const marker = new AMap.CircleMarker({
                            center: loc,
                            radius: 5,
                            strokeColor: '#ffffff',
                            strokeWeight: 1,
                            fillColor: '#16a34a',
                            fillOpacity: 0.9,
                            zIndex: 110,
                            bubble: true,
                            cursor: 'pointer',
                        });
                        marker.on('click', () => {
                            const name = (aoi && aoi.name) ? String(aoi.name) : String((aoi && aoi.id) || 'AOI');
                            const area = Number(aoi && aoi.area);
                            const areaText = Number.isFinite(area) ? `${(area / 1000000).toFixed(3)} km²` : '-';
                            const insideHits = Number(aoi && aoi.inside_hits);
                            const minDist = aoi && aoi.min_distance;
                            const info = [
                                `<div style="padding:6px 8px;">`,
                                `<div style="font-weight:600;">${name}</div>`,
                                `<div style="font-size:12px;color:#666;">ID: ${(aoi && aoi.id) || '-'}</div>`,
                                `<div style="font-size:12px;color:#666;">面积: ${areaText}</div>`,
                                `<div style="font-size:12px;color:#666;">inside_hits: ${Number.isFinite(insideHits) ? insideHits : 0} ｜ min_distance: ${minDist ?? '-'}</div>`,
                                `</div>`,
                            ];
                            new AMap.InfoWindow({
                                content: info.join(""),
                                offset: new AMap.Pixel(0, -6)
                            }).open(this.mapCore.map, loc);
                        });
                        marker.setMap(this.mapCore.map);
                        markers.push(marker);
                    });
                    if (invalidCount > 0) {
                        console.warn('[aoi-render] skipped invalid coordinates', {
                            invalid_count: invalidCount,
                            total_candidates: list.length,
                            samples: invalidSamples
                        });
                    }
                    this.aoiMarkers = markers;
                },
                async fetchAois() {
                    if (!this.lastIsochroneGeoJSON) return;
                    this.isFetchingAois = true;
                    this.fetchProgress = 0;
                    this.aoiStatus = '准备抓取...';
                    this.poiStatus = '';
                    this.resetFetchSubtypeProgress();

                    if (this.markerManager) {
                        if (this.markerManager.markers) {
                            this.markerManager.markers.forEach((m) => m.setMap(null));
                        }
                        if (this.markerManager.destroyClusterers) {
                            this.markerManager.destroyClusterers();
                        }
                        this.markerManager = null;
                    }
                    if (this.poiMarkers) {
                        this.poiMarkers.forEach((m) => m.setMap(null));
                        this.poiMarkers = [];
                    }
                    const filterContainer = document.getElementById('filtersContainer');
                    if (filterContainer) filterContainer.innerHTML = '';

                    this.clearAoiMarkers();
                    this.allPoisDetails = [];
                    this.allAoisDetails = [];
                    this.aoiSamplePoints = 0;
                    this.aoiTotalCalls = 0;
                    this.resetRoadSyntaxState();

                    try {
                        const polygon = this.getIsochronePolygonPoints();
                        if (!polygon.length) {
                            throw new Error('等时圈范围无效');
                        }

                        this.abortController = new AbortController();
                        this.fetchProgress = 30;

                        const payload = {
                            polygon: polygon,
                            h3_resolution: this.aoiH3Resolution,
                            max_points: this.aoiMaxPoints,
                            regeo_radius: this.aoiRegeoRadius,
                            spacing_m: 250,
                        };

                        const res = await fetch('/api/v1/analysis/aois', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: this.abortController.signal,
                        });
                        if (!res.ok) {
                            let detail = '';
                            try {
                                detail = await res.text();
                            } catch (_) { }
                            throw new Error(detail || 'AOI 抓取失败');
                        }
                        this.fetchProgress = 85;
                        const data = await res.json();
                        const aois = Array.isArray(data && data.aois) ? data.aois : [];
                        this.allAoisDetails = aois;
                        this.aoiSamplePoints = Number(data && data.sample_points) || 0;
                        this.aoiTotalCalls = Number(data && data.total_calls) || 0;

                        this.renderAois(aois);
                        this.fetchProgress = 100;
                        this.aoiStatus = `完成！共 ${aois.length} 个 AOI（采样点 ${this.aoiSamplePoints}，请求 ${this.aoiTotalCalls}）`;
                        setTimeout(() => {
                            this.step = 3;
                            this.activeStep3Panel = 'aoi';
                        }, 120);
                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            console.error(e);
                            this.aoiStatus = '失败: ' + e.message;
                        } else {
                            this.aoiStatus = '任务已取消';
                        }
                    } finally {
                        this.isFetchingAois = false;
                        this.abortController = null;
                    }
                },
                // Updated Render Logic
                renderPois(pois) {
                    if (this.poiMarkers) this.poiMarkers.forEach(m => m.setMap(null));
                    this.poiMarkers = [];

                    // Filter client-side based on current checkboxes (in case user toggles after fetch)
                    // Note: For now, we render what we fetched.
                    // Future enhancement: dynamic toggle without re-fetch.

                    let invalidCount = 0;
                    const invalidSamples = [];
                    const markers = (Array.isArray(pois) ? pois : []).map((p, idx) => {
                        const loc = this.normalizeLngLat(p && p.location, 'poi.render.location');
                        if (!loc) {
                            invalidCount += 1;
                            if (invalidSamples.length < 5) {
                                invalidSamples.push({
                                    idx: idx,
                                    id: (p && p.id) || '',
                                    name: (p && p.name) || '',
                                    location: this.roadSyntaxSummarizeCoordInput(p && p.location)
                                });
                            }
                            return null;
                        }
                        // Find category color
                        let color = '#999';
                        const cat = this.resolvePoiCategory(p && p.type);
                        if (cat) color = cat.color;

                        // Create CircleMarker
                        const marker = new AMap.CircleMarker({
                            center: loc,
                            radius: 4, // px
                            strokeColor: 'white',
                            strokeWeight: 1,
                            fillColor: color,
                            fillOpacity: 0.9,
                            zIndex: 100,
                            bubble: true,
                            cursor: 'pointer',
                        });

                        // Info Window
                        marker.on('click', () => {
                            const typeText = (p.type || '').toString();
                            const nameText = p.name || '';
                            const isTraffic = typeText.startsWith('15') || typeText.startsWith('type-15');
                            const isParking = typeText.includes('1509') || /停车/.test(nameText);
                            const addressText = p.address || '';
                            let lines = Array.isArray(p.lines) ? p.lines.slice() : [];
                            if (isTraffic && !isParking && addressText) {
                                if (lines.length === 0) {
                                    lines = [addressText];
                                } else if (!lines.includes(addressText)) {
                                    lines.push(addressText);
                                }
                            }
                            const showAddress = !isTraffic || isParking;
                            const showLines = isTraffic && !isParking;
                            const info = [];
                            info.push(`<div style="padding:5px;"><b>${p.name}</b>`);
                            info.push(`<div style="font-size:12px;color:#666;">${p.type || '未知类型'}</div>`);
                            if (showAddress && addressText) {
                                info.push(`<div style="font-size:12px;color:#666;"><span style="color:#666;">地址：</span>${addressText}</div>`);
                            }
                            if (showLines && lines.length) {
                                info.push(`<div style="font-size:12px;color:#666;"><span style="color:#666;">途经线路：</span>${lines.join('，')}</div>`);
                            }
                            info.push(`</div>`);

                            new AMap.InfoWindow({
                                content: info.join(""),
                                offset: new AMap.Pixel(0, -5)
                            }).open(this.mapCore.map, loc);
                        });

                        marker.setMap(this.mapCore.map);
                        return marker;
                    }).filter((m) => !!m);
                    if (invalidCount > 0) {
                        console.warn('[poi-render] skipped invalid coordinates', {
                            invalid_count: invalidCount,
                            total_candidates: Array.isArray(pois) ? pois.length : 0,
                            samples: invalidSamples
                        });
                    }
                    this.poiMarkers = markers;
                },
                // Toggle visibility client-side
                toggleCategory() {
                    if (this.allPoisDetails.length > 0) {
                        // Filter logic
                        const activeIds = new Set(this.poiCategories.filter(c => c.checked).map(c => c.id));
                        const filtered = this.allPoisDetails.filter(p => {
                            const cid = this.resolvePoiCategoryId(p && p.type);
                            return !!cid && activeIds.has(cid);
                        });
                        this.renderPois(filtered);
                    }
                },
                renderResult(geojson) {
                    if (!geojson || !geojson.geometry) {
                        this.errorMessage = "未获取到有效数据";
                        return;
                    }
                    const coords = geojson.geometry.coordinates;
                    const type = geojson.geometry.type;
                    let paths = [];
                    if (type === 'Polygon') {
                        paths.push(coords[0]);
                    } else if (type === 'MultiPolygon') {
                        coords.forEach(poly => paths.push(poly[0]));
                    }
                    this.mapCore.setCustomPolygons(paths);
                },
                async loadHistoryList(options = {}) {
                    const force = !!(options && options.force);
                    const background = !!(options && options.background);
                    const keepExisting = options && Object.prototype.hasOwnProperty.call(options, 'keepExisting')
                        ? !!options.keepExisting
                        : (this.historyHasLoadedOnce && this.historyList.length > 0);
                    if (!force && this.historyHasLoadedOnce) {
                        return;
                    }
                    if (this.historyLoading && !force) {
                        return;
                    }
                    this.cancelHistoryLoading();
                    const sessionId = this.historyRenderSessionId;
                    this.historyLoading = true;
                    if (!keepExisting && !background) {
                        this.historyListRaw = [];
                        this.historyList = [];
                        this.historyLoadedCount = 0;
                    }
                    this.historyFetchAbortController = new AbortController();

                    try {
                        console.log("Loading history list...");
                        const res = await fetch('/api/v1/analysis/history', {
                            signal: this.historyFetchAbortController.signal
                        });
                        if (!res.ok) {
                            throw new Error(`历史记录请求失败(${res.status})`);
                        }
                        const data = await res.json();
                        console.log("History list loaded:", data);
                        if (sessionId !== this.historyRenderSessionId) return;
                        const normalized = Array.isArray(data)
                            ? data.map((item) => this.normalizeHistoryRecord(item))
                            : [];
                        this.historyListRaw = normalized;
                        this.historyList = normalized.slice();
                        this.historyLoadedCount = normalized.length;
                        this.historyLoading = false;
                        this.historyRenderRafId = null;
                        this.historyHasLoadedOnce = true;
                    } catch (e) {
                        if (e && e.name === 'AbortError') return;
                        console.error("History Load Error:", e);
                        if (sessionId !== this.historyRenderSessionId) return;
                        this.historyLoading = false;
                        if (!keepExisting && !background) {
                            this.historyListRaw = [];
                            this.historyList = [];
                            this.historyLoadedCount = 0;
                        }
                    } finally {
                        if (sessionId === this.historyRenderSessionId) {
                            this.historyFetchAbortController = null;
                        }
                    }
                },
                toggleSelectionMode(active) {
                    this.isSelectionMode = active;
                    this.selectedHistoryIds = [];
                },
                handleHistoryItemClick(item) {
                    if (this.isSelectionMode) {
                        const idx = this.selectedHistoryIds.indexOf(item.id);
                        if (idx > -1) {
                            this.selectedHistoryIds.splice(idx, 1);
                        } else {
                            this.selectedHistoryIds.push(item.id);
                        }
                    } else {
                        this.loadHistoryDetail(item.id);
                    }
                },
                async deleteSelectedHistory() {
                    const count = this.selectedHistoryIds.length;
                    if (count === 0) return;

                    if (!confirm(`确定要删除选中的 ${count} 条记录吗？`)) return;

                    try {
                        // Parallel delete (simple implementation)
                        // Ideally backend should support bulk delete
                        const deletePromises = this.selectedHistoryIds.map(id =>
                            fetch(`/api/v1/analysis/history/${id}`, { method: 'DELETE' })
                        );

                        await Promise.all(deletePromises);

                        const removedIds = new Set(this.selectedHistoryIds);
                        this.historyList = this.historyList.filter(item => !removedIds.has(item.id));
                        this.historyListRaw = this.historyListRaw.filter(item => !removedIds.has(item.id));
                        this.historyLoadedCount = this.historyList.length;
                        this.selectedHistoryIds = [];
                        this.isSelectionMode = false;

                    } catch (e) {
                        console.error("Batch delete failed", e);
                        alert("批量删除失败");
                    }
                },
                async deleteHistory(id) {
                    if (!confirm('确定要删除这条记录吗？')) return;
                    try {
                        await fetch(`/api/v1/analysis/history/${id}`, { method: 'DELETE' });
                        this.historyList = this.historyList.filter(item => item.id !== id);
                        this.historyListRaw = this.historyListRaw.filter(item => item.id !== id);
                        this.historyLoadedCount = this.historyList.length;
                    } catch (e) { console.error(e); }
                },
                async loadHistoryDetail(id) {
                    try {
                        this.cancelHistoryLoading();
                        if (!this.mapCore || !this.mapCore.map) {
                            this.errorMessage = '地图尚未初始化，请稍后重试';
                            return;
                        }

                        const res = await fetch(`/api/v1/analysis/history/${id}`);
                        const data = await res.json();
                        if (!data) return;

                        // Cleanup previous state
                        this.clearH3Grid();
                        if (this.marker) this.marker.setMap(null);
                        this.marker = null;
                        this.mapCore.clearCustomPolygons();
                        if (this.markerManager) {
                            // Ensure old markers are removed from map
                            if (this.markerManager.markers) {
                                this.markerManager.markers.forEach(m => m.setMap(null));
                            }
                            // Destroy clusterers if method exists
                            if (this.markerManager.destroyClusterers) {
                                this.markerManager.destroyClusterers();
                            }
                            // Clear internal references
                            this.markerManager.markers = [];
                            this.markerManager.points = [];
                            this.markerManager = null;
                        }
                        // Clear simplified poiMarkers array if used
                        if (this.poiMarkers) {
                            this.poiMarkers.forEach(m => m.setMap(null));
                            this.poiMarkers = [];
                        }
                        this.clearAoiMarkers();
                        this.allAoisDetails = [];
                        this.aoiSamplePoints = 0;
                        this.aoiTotalCalls = 0;
                        this.aoiStatus = '';
                        this.resetRoadSyntaxState();

                        // Clear FilterPanel content to ensure clean rebuild
                        const filterContainer = document.getElementById('filtersContainer');
                        if (filterContainer) filterContainer.innerHTML = '';

                        if (data.params && data.params.center) {
                            this.selectedPoint = { lng: data.params.center[0], lat: data.params.center[1] };
                            this.mapCore.map.setCenter(data.params.center);
                            this.mapCore.center = { lng: data.params.center[0], lat: data.params.center[1] }; // Sync MapCore center
                            this.mapCore.setRadius(0); // Reset radius to avoid ghost circle at old location
                            // Restore time horizon if available
                            if (data.params.time_min) this.timeHorizon = data.params.time_min;
                        }

                        if (data.polygon) {
                            this.mapCore.setCustomPolygons([data.polygon]);
                            this.lastIsochroneGeoJSON = { geometry: { type: 'Polygon', coordinates: [data.polygon] } };
                        }

                        // Switch to Results Step before building panels
                        this.step = 3;
                        this.sidebarView = 'wizard'; // Return to wizard
                        this.captureTarget = 'poi';
                        this.activeStep3Panel = 'poi';
                        this.poiStatus = '正在加载历史点位...';
                        await this.$nextTick();
                        await new Promise((resolve) => window.requestAnimationFrame(resolve));

                        if (data.pois) {
                            this.allPoisDetails = data.pois;
                            // Integration with Legacy Filter Panel
                            if (this.updateLegacySystem) {
                                this.updateLegacySystem(data.pois);
                            } else {
                                this.renderPois(data.pois);
                            }
                            this.poiStatus = `已加载历史: ${data.pois.length} 条`;
                        }
                        setTimeout(() => this.resizePoiChart(), 0);

                    } catch (e) {
                        console.error(e);
                        alert("加载失败");
                    }
                },
                formatHistoryTitle(desc) {
                    if (!desc) return '无标题分析';
                    // Remove "15min Analysis - " prefix if present to avoid redundancy with tags
                    return desc.replace(/^\d+min Analysis - /, '');
                },
                resetAnalysis() {
                    this.destroyPlaceSearch();
                    this.step = 1;
                    this.sidebarView = 'wizard';
                    this.selectedPoint = null;
                    this.errorMessage = '';
                    if (this.marker) {
                        this.marker.setMap(null);
                        this.marker = null;
                    }
                    this.clearAnalysisLayers();
                    if (this.mapCore && this.mapCore.map) {
                        this.mapCore.map.setFitView();
                    }
                },
                async triggerSearch() {
                    const input = document.getElementById('keyword');
                    const keyword = input && input.value ? String(input.value).trim() : '';
                    if (!keyword) return;
                    this.errorMessage = '';

                    if (this.step !== 1) {
                        this.errorMessage = '搜索仅在 Step1 可用';
                        return;
                    }
                    const ready = await this.ensurePlaceSearchReady();
                    if (!ready || !ready.ok) {
                        this.errorMessage = '搜索服务加载失败，请稍后重试';
                        return;
                    }
                    if (!this.placeSearch || typeof this.placeSearch.search !== 'function') {
                        this.errorMessage = '搜索服务未就绪，请稍后重试';
                        return;
                    }

                    const focusPoi = (poi) => {
                        if (!poi || !poi.location) return false;
                        if (this.mapCore && this.mapCore.map) {
                            this.mapCore.map.setZoomAndCenter(15, poi.location);
                        }
                        this.setSelectedPoint(poi.location);
                        return true;
                    };

                    const result = await this.runPlaceSearch(keyword);
                    if (result.pois.length > 0 && focusPoi(result.pois[0])) {
                        return;
                    }

                    if (result.serviceError) {
                        if (result.errorInfo && result.errorInfo.indexOf('OVER_LIMIT') >= 0) {
                            this.errorMessage = '高德搜索当日额度已用完（OVER_LIMIT），请更换 JS Key 或次日重试';
                        } else {
                            this.errorMessage = "搜索服务异常，请稍后重试";
                        }
                        return;
                    }
                    this.errorMessage = `未找到“${keyword}”相关地点，请尝试更具体关键词`;
                },
                saveAndRestart() {
                    this.destroyPlaceSearch();
                    this.step = 1;
                    this.selectedPoint = null;
                    this.errorMessage = '';
                    this.poiStatus = '';
                    this.h3ExportMenuOpen = false;
                    this.h3ExportTasksOpen = false;
                    if (this.h3ToastTimer) {
                        clearTimeout(this.h3ToastTimer);
                        this.h3ToastTimer = null;
                    }
                    this.h3Toast = { message: '', type: 'info' };
                    if (this.marker) this.marker.setMap(null);
                    this.marker = null;
                    this.clearH3Grid();
                    if (this.mapCore && this.mapCore.clearCustomPolygons) {
                        this.mapCore.clearCustomPolygons();
                    }
                    if (this.markerManager) {
                        this.markerManager.markers.forEach(m => m.setMap(null));
                        this.markerManager.destroyClusterers();
                    }
                    this.disposePoiChart();
                },
                initPoiChart() {
                    const el = document.getElementById('poiChart');
                    if (!el || !window.echarts || el.clientWidth === 0) return null;

                    let chart = echarts.getInstanceByDom(el);
                    if (!chart) {
                        chart = echarts.init(el);
                        if (!this.poiChartResizeHandler) {
                            this.poiChartResizeHandler = () => this.resizePoiChart();
                            window.addEventListener('resize', this.poiChartResizeHandler);
                        }
                    }
                    this.poiChart = chart;
                    return chart;
                },
                resizePoiChart() {
                    if (this.poiChart) this.poiChart.resize();
                },
                disposePoiChart() {
                    if (this.poiChart) {
                        this.poiChart.dispose();
                        this.poiChart = null;
                    }
                    if (this.poiChartResizeHandler) {
                        window.removeEventListener('resize', this.poiChartResizeHandler);
                        this.poiChartResizeHandler = null;
                    }
                },
                disposeH3Charts() {
                    if (this.h3CategoryChart) {
                        this.h3CategoryChart.dispose();
                        this.h3CategoryChart = null;
                    }
                    if (this.h3DensityChart) {
                        this.h3DensityChart.dispose();
                        this.h3DensityChart = null;
                    }
                    if (this.h3LqChart) {
                        this.h3LqChart.dispose();
                        this.h3LqChart = null;
                    }
                    if (this.h3GapChart) {
                        this.h3GapChart.dispose();
                        this.h3GapChart = null;
                    }
                    if (this.h3StructureChart) {
                        this.h3StructureChart.dispose();
                        this.h3StructureChart = null;
                    }
                    if (this.h3ChartsResizeHandler) {
                        window.removeEventListener('resize', this.h3ChartsResizeHandler);
                        this.h3ChartsResizeHandler = null;
                    }
                },
                _resolveCategoryColors(labels) {
                    const colorByName = {};
                    (this.poiCategories || []).forEach((item) => {
                        colorByName[item.name] = item.color || '#888';
                    });
                    return (labels || []).map(label => colorByName[label] || '#5b8ff9');
                },
                _buildHistogram(values, metricKey, binCount = 8) {
                    const valid = (values || [])
                        .map(v => this._toNumber(v, NaN))
                        .filter(v => Number.isFinite(v));
                    if (!valid.length) {
                        return { bins: [], counts: [] };
                    }
                    const minV = Math.min(...valid);
                    const maxV = Math.max(...valid);
                    if (Math.abs(maxV - minV) < 1e-12) {
                        const label = `${this._formatLegendValue(minV, metricKey)} ~ ${this._formatLegendValue(maxV, metricKey)}`;
                        return { bins: [label], counts: [valid.length] };
                    }

                    const bins = [];
                    const counts = new Array(binCount).fill(0);
                    const span = maxV - minV;
                    const step = span / binCount;
                    for (let i = 0; i < binCount; i += 1) {
                        const start = minV + step * i;
                        const end = i === binCount - 1 ? maxV : (minV + step * (i + 1));
                        bins.push(`${this._formatLegendValue(start, metricKey)} ~ ${this._formatLegendValue(end, metricKey)}`);
                    }
                    for (const v of valid) {
                        let idx = Math.floor((v - minV) / step);
                        if (!Number.isFinite(idx)) idx = 0;
                        if (idx < 0) idx = 0;
                        if (idx >= binCount) idx = binCount - 1;
                        counts[idx] += 1;
                    }
                    return { bins, counts };
                },
                _resolveMetricHistogram(metricKey) {
                    const source = this.h3AnalysisGridFeatures || [];
                    const values = source.map((feature) => {
                        const props = (feature && feature.properties) || {};
                        const datum = this._getH3MetricValue(props, metricKey);
                        return datum.noData ? null : datum.value;
                    }).filter(v => Number.isFinite(v));

                    if (metricKey === 'entropy') {
                        const hist = this._buildHistogram(values, 'entropy', 10);
                        return {
                            title: '局部熵分布（0~1）',
                            xAxisName: '熵区间',
                            bins: hist.bins,
                            counts: hist.counts,
                            color: '#4cae63',
                            subtext: '仅统计样本数足够的网格',
                        };
                    }
                    if (metricKey === 'neighbor_delta') {
                        const hist = this._buildHistogram(values, 'neighbor_delta', 8);
                        return {
                            title: '邻域差值分布（POI/km²）',
                            xAxisName: '差值区间（本格-邻域）',
                            bins: hist.bins,
                            counts: hist.counts,
                            color: '#3f7fd8',
                            subtext: '正值表示高于邻域，负值表示低于邻域',
                        };
                    }

                    const densityData = this.h3AnalysisCharts && this.h3AnalysisCharts.density_histogram
                        ? this.h3AnalysisCharts.density_histogram
                        : null;
                    if (densityData && Array.isArray(densityData.bins) && Array.isArray(densityData.counts)) {
                        return {
                            title: '密度分布（POI/km²）',
                            xAxisName: '密度区间 (POI/km²)',
                            bins: densityData.bins,
                            counts: densityData.counts.map(v => this._toNumber(v, 0)),
                            color: '#4c8bf5',
                            subtext: '',
                        };
                    }

                    const hist = this._buildHistogram(values, 'density', 8);
                    return {
                        title: '密度分布（POI/km²）',
                        xAxisName: '密度区间 (POI/km²)',
                        bins: hist.bins,
                        counts: hist.counts,
                        color: '#4c8bf5',
                        subtext: '',
                    };
                },
                updateH3Charts() {
                    if (!window.echarts || !this.h3AnalysisCharts) return;
                    const categoryEl = document.getElementById('h3CategoryChart');
                    const densityEl = document.getElementById('h3DensityChart');
                    if (!categoryEl || !densityEl) return;
                    if (categoryEl.clientWidth === 0 || densityEl.clientWidth === 0) return;

                    if (!this.h3ChartsResizeHandler) {
                        this.h3ChartsResizeHandler = () => {
                            if (this.h3CategoryChart) this.h3CategoryChart.resize();
                            if (this.h3DensityChart) this.h3DensityChart.resize();
                            if (this.h3LqChart) this.h3LqChart.resize();
                            if (this.h3GapChart) this.h3GapChart.resize();
                            if (this.h3StructureChart) this.h3StructureChart.resize();
                        };
                        window.addEventListener('resize', this.h3ChartsResizeHandler);
                    }

                    let categoryChart = echarts.getInstanceByDom(categoryEl);
                    if (!categoryChart) categoryChart = echarts.init(categoryEl);
                    this.h3CategoryChart = categoryChart;

                    let densityChart = echarts.getInstanceByDom(densityEl);
                    if (!densityChart) densityChart = echarts.init(densityEl);
                    this.h3DensityChart = densityChart;

                    const categoryData = this.h3AnalysisCharts.category_distribution || {};
                    const categoryLabels = categoryData.labels || [];
                    const categoryValues = (categoryData.values || []).map(v => this._toNumber(v, 0));
                    const categoryColors = this._resolveCategoryColors(categoryLabels);
                    categoryChart.setOption(
                        {
                            animationDuration: 240,
                            grid: { left: 48, right: 12, top: 22, bottom: 20, containLabel: true },
                            xAxis: {
                                type: 'value',
                                axisLine: { show: false },
                                axisTick: { show: false },
                                splitLine: { lineStyle: { color: '#eceff3' } },
                                minInterval: 1,
                            },
                            yAxis: {
                                type: 'category',
                                inverse: true,
                                data: categoryLabels,
                                axisLine: { show: false },
                                axisTick: { show: false },
                            },
                            series: [{
                                type: 'bar',
                                data: categoryValues,
                                barWidth: 12,
                                itemStyle: { color: (params) => categoryColors[params.dataIndex] || '#5b8ff9' },
                                label: {
                                    show: true,
                                    position: 'right',
                                    formatter: '{c}',
                                    color: '#555',
                                    fontSize: 11
                                }
                            }]
                        },
                        true
                    );

                    const metricHist = this._resolveMetricHistogram(this.h3MetricView || 'density');
                    const bins = metricHist.bins || [];
                    const counts = (metricHist.counts || []).map(v => this._toNumber(v, 0));
                    const densitySubtext = metricHist.subtext || '';
                    densityChart.setOption(
                        {
                            title: {
                                text: metricHist.title || '指标分布',
                                subtext: densitySubtext,
                                left: 'center',
                                top: 0,
                                textStyle: { fontSize: 12, fontWeight: 600, color: '#374151' },
                                subtextStyle: { fontSize: 10, color: '#6b7280' }
                            },
                            animationDuration: 240,
                            grid: { left: 44, right: 16, top: densitySubtext ? 52 : 36, bottom: 40, containLabel: true },
                            xAxis: {
                                type: 'category',
                                data: bins,
                                name: metricHist.xAxisName || '区间',
                                nameLocation: 'middle',
                                nameGap: 28,
                                nameTextStyle: { color: '#6b7280', fontSize: 10 },
                                axisLabel: {
                                    color: '#6b7280',
                                    fontSize: 10,
                                    interval: 0,
                                    rotate: bins.length > 6 ? 35 : 0,
                                },
                                axisLine: { lineStyle: { color: '#d7dce3' } }
                            },
                            yAxis: {
                                type: 'value',
                                minInterval: 1,
                                name: '网格数',
                                nameLocation: 'middle',
                                nameGap: 34,
                                nameTextStyle: { color: '#6b7280', fontSize: 10 },
                                axisLine: { show: false },
                                axisTick: { show: false },
                                splitLine: { lineStyle: { color: '#eceff3' } }
                            },
                            series: [{
                                type: 'bar',
                                data: counts,
                                barMaxWidth: 20,
                                itemStyle: { color: metricHist.color || '#4c8bf5' }
                            }]
                        },
                        true
                    );
                },
                computePoiStats(points) {
                    const labels = this.poiCategories.map(c => c.name);
                    const colors = this.poiCategories.map(c => c.color || '#888');
                    const values = this.poiCategories.map(() => 0);
                    const indexMap = {};
                    this.poiCategories.forEach((c, idx) => {
                        indexMap[c.id] = idx;
                    });
                    (points || []).forEach(p => {
                        const cid = this.resolvePoiCategoryId(p && p.type);
                        if (!cid) return;
                        const idx = indexMap[cid];
                        if (Number.isInteger(idx) && idx >= 0) values[idx] += 1;
                    });
                    return { labels, colors, values };
                },
                updatePoiCharts() {
                    if (!this.markerManager || !this.markerManager.getVisiblePoints) return;

                    const el = document.getElementById('poiChart');
                    if (!el || !window.echarts) return;

                    // If chart already exists and is visible, update immediately for smooth animation (restores transition)
                    const existingChart = echarts.getInstanceByDom(el);
                    if (existingChart && el.clientWidth > 0) {
                        this.poiChart = existingChart;
                        const points = this.markerManager.getVisiblePoints();
                        const stats = this.computePoiStats(points);
                        const safeValues = stats.values.map(v => (Number.isFinite(v) ? v : 0));

                        const option = {
                            yAxis: {
                                type: 'category',
                                inverse: true,
                                data: stats.labels
                            },
                            series: [{
                                data: safeValues,
                                itemStyle: {
                                    color: (params) => stats.colors[params.dataIndex] || '#888'
                                }
                            }]
                        };
                        existingChart.setOption(option, false); // Merge for animation
                        return;
                    }

                    // Otherwise, delay slightly for initial rendering (Step 3 panels use v-show)
                    setTimeout(() => {
                        const chart = this.initPoiChart();
                        if (!chart) return;

                        const points = this.markerManager.getVisiblePoints();
                        const stats = this.computePoiStats(points);
                        const safeValues = stats.values.map(v => (Number.isFinite(v) ? v : 0));

                        const option = {
                            grid: { left: 50, right: 20, top: 10, bottom: 10, containLabel: true },
                            xAxis: {
                                type: 'value',
                                axisLine: { show: false }, axisTick: { show: false },
                                splitLine: { lineStyle: { color: '#eee' } }
                            },
                            yAxis: {
                                type: 'category',
                                inverse: true,
                                data: stats.labels,
                                axisLine: { show: false }, axisTick: { show: false }
                            },
                            series: [{
                                type: 'bar',
                                data: safeValues,
                                barWidth: 12,
                                itemStyle: {
                                    color: (params) => stats.colors[params.dataIndex] || '#888'
                                }
                            }]
                        };
                        try {
                            chart.setOption(option, true);
                            chart.resize();
                        } catch (err) {
                            console.error("ECharts setOption error:", err);
                        }
                    }, 100);
                },
                updateLegacySystem(pois) {
                    if (this.markerManager) {
                        if (this.markerManager.markers) {
                            this.markerManager.markers.forEach(m => m.setMap(null));
                        }
                        if (this.markerManager.destroyClusterers) {
                            this.markerManager.destroyClusterers();
                        }
                    }
                    this.markerManager = null;
                    this.filterPanel = null;
                    const filtersContainer = document.getElementById('filtersContainer');
                    if (filtersContainer) filtersContainer.innerHTML = '';

                    if (this.poiMarkers) {
                        this.poiMarkers.forEach(m => m.setMap(null));
                        this.poiMarkers = [];
                    }

                    const defaultTypeId = (() => {
                        for (const group of (this.typeMapGroups || [])) {
                            const firstItem = (group.items || [])[0];
                            if (firstItem && firstItem.id) return firstItem.id;
                        }
                        return (this.poiCategories[0] && this.poiCategories[0].id) ? this.poiCategories[0].id : 'default';
                    })();
                    let invalidPointCount = 0;
                    const invalidPointSamples = [];
                    const points = (Array.isArray(pois) ? pois : []).map((p, idx) => {
                        const loc = this.normalizeLngLat(p && p.location, 'legacy.poi.location');
                        if (!loc) {
                            invalidPointCount += 1;
                            if (invalidPointSamples.length < 5) {
                                invalidPointSamples.push({
                                    idx: idx,
                                    id: (p && p.id) || '',
                                    name: (p && p.name) || '',
                                    location: this.roadSyntaxSummarizeCoordInput(p && p.location)
                                });
                            }
                            return null;
                        }
                        const lng = Number(loc[0]);
                        const lat = Number(loc[1]);
                        const matchedType = this.resolvePoiTypeId(p && p.type) || defaultTypeId;
                        return {
                            lng: lng,
                            lat: lat,
                            name: p && p.name ? p.name : '',
                            type: matchedType,
                            address: p && p.address ? p.address : '',
                            lines: p && Array.isArray(p.lines) ? p.lines : [],
                            _pid: (p && p.id) || ('p-' + idx)
                        };
                    }).filter((p) => !!p);
                    if (invalidPointCount > 0) {
                        console.warn('[legacy-poi] skipped invalid coordinates', {
                            invalid_count: invalidPointCount,
                            total_candidates: Array.isArray(pois) ? pois.length : 0,
                            samples: invalidPointSamples
                        });
                    }

                    const mapTypeConfig = {
                        groups: (this.typeMapGroups || []).map((group, index) => ({
                            id: String(group.id || `group-${index + 1}`),
                            title: String(group.title || group.id || `分类${index + 1}`),
                            toggleId: String(group.toggleId || `toggle-group-${index + 1}`),
                            filtersId: String(group.filtersId || `filters-group-${index + 1}`),
                            items: (group.items || []).map((item) => ({
                                id: String(item.id || ''),
                                label: String(item.label || item.id || ''),
                                color: item.color || '#888',
                                defaultChecked: this.poiSubSelectionState[item.id] !== false
                            })).filter(item => item.id)
                        })).filter(group => group.id && group.items.length > 0)
                    };
                    if (!mapTypeConfig.groups.length) {
                        mapTypeConfig.groups = [{
                            id: 'poi_group',
                            title: 'POI 分类',
                            toggleId: 'toggle_poi_group',
                            filtersId: 'filters-poi-group',
                            items: this.poiCategories.map((cat) => ({
                                id: String(cat.id || ''),
                                label: String(cat.name || cat.id || ''),
                                color: cat.color || '#888',
                                defaultChecked: cat.checked !== false
                            })).filter(item => item.id)
                        }];
                    }

                    const centerObj = this.selectedPoint ? {
                        lng: this.selectedPoint.lng,
                        lat: this.selectedPoint.lat,
                        name: '中心点',
                        type: 'center'
                    } : null;

                    this.markerManager = new MarkerManager(this.mapCore, {
                        mapData: { points: points, center: centerObj },
                        mapTypeConfig: mapTypeConfig
                    });
                    this.markerManager.init();
                    this.markerManager.renderMarkers();

                    // Filter Panel
                    this.filterPanel = new FilterPanel(this.markerManager, {
                        mapData: { points: points },
                        mapTypeConfig: mapTypeConfig,
                        flatMode: false
                    });
                    this.filterPanel.init();
                    this.markerManager.applyFilters();
                    this.applySimplifyPointVisibility();
                    this.filterPanel.onFiltersChange = () => this.updatePoiCharts();
                    this.updatePoiCharts();
                }
            }
        }).mount('#app');
    