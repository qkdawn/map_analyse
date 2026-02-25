(function (global) {
    'use strict';

    function createRoadSyntaxUiMethods(ROAD_SYNTAX_CONST) {
        const fallbackBudget = Object.freeze({
            interacting: 0.8,
            init: 6.0,
            steady: 4.0,
            lineFallbackSmall: 12.0,
            lineFallbackLarge: 8.0,
            node: 6.5,
        });
        const fallbackConst = Object.freeze({
            BUILD_BUDGET_MS: fallbackBudget,
        });
        const syntaxConst = ROAD_SYNTAX_CONST || fallbackConst;

        return {
            roadSyntaxResolveMapZoom(defaultZoom = 16) {
                const map = this.roadSyntaxMap();
                if (!map || typeof map.getZoom !== 'function') {
                    return Number(defaultZoom) || 16;
                }
                try {
                    const zoom = Number(map.getZoom());
                    return Number.isFinite(zoom) ? zoom : (Number(defaultZoom) || 16);
                } catch (_) {
                    return Number(defaultZoom) || 16;
                }
            },
            roadSyntaxShouldUseLegacyViewportRefresh() {
                if (!this.roadSyntaxUseArcgisWebgl) return true;
                if (this.roadSyntaxWebglActive) return false;
                if (typeof this.roadSyntaxCanUseArcgisWebglPayload === 'function') {
                    return !this.roadSyntaxCanUseArcgisWebglPayload(this.roadSyntaxWebglPayload);
                }
                return true;
            },
            roadSyntaxResolveBackboneRankScore(item) {
                const props = (item && item.props) || {};
                const scoreFields = [
                    'rank_quantile_accessibility',
                    'rank_quantile_integration',
                    'rank_quantile_choice',
                    'accessibility_score',
                    'integration_score',
                    'choice_score',
                    'control_score',
                    'depth_score',
                ];
                for (let i = 0; i < scoreFields.length; i += 1) {
                    const val = Number(props[scoreFields[i]]);
                    if (Number.isFinite(val)) {
                        if (scoreFields[i].indexOf('rank_quantile_') === 0) {
                            return Math.max(0, Math.min(1, val));
                        }
                        return Math.max(0, Math.min(1, val));
                    }
                }
                return 0.0;
            },
            roadSyntaxResolveBackboneScoreList() {
                const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                const cacheKey = `${String(this.roadSyntaxSourceFingerprint || '')}|backbone`;
                if (
                    this.roadSyntaxLodScoreCacheKey === cacheKey
                    && Array.isArray(this.roadSyntaxLodScoreList)
                    && this.roadSyntaxLodScoreList.length === items.length
                ) {
                    return this.roadSyntaxLodScoreList;
                }
                const scores = items.map((item) => this.roadSyntaxResolveBackboneRankScore(item));
                this.roadSyntaxLodScoreCacheKey = cacheKey;
                this.roadSyntaxLodScoreList = scores;
                return scores;
            },
            roadSyntaxSelectBackboneIndexes(indexes, cap) {
                const list = Array.isArray(indexes) ? indexes : [];
                const limit = Math.max(1, Math.floor(Number(cap) || 1));
                if (list.length <= limit) return list.slice();
                const scores = this.roadSyntaxResolveBackboneScoreList();
                const ranked = list.slice().sort((a, b) => {
                    const sa = Number(scores[a] || 0);
                    const sb = Number(scores[b] || 0);
                    if (sb !== sa) return sb - sa;
                    return a - b;
                });
                const topCount = Math.max(1, Math.min(limit, Math.floor(limit * 0.7)));
                const picked = ranked.slice(0, topCount);
                const remainNeed = limit - picked.length;
                if (remainNeed > 0) {
                    const rest = ranked.slice(topCount);
                    if (rest.length <= remainNeed) {
                        picked.push.apply(picked, rest);
                    } else {
                        const step = rest.length / remainNeed;
                        for (let i = 0; i < remainNeed; i += 1) {
                            const idx = Math.min(rest.length - 1, Math.floor(i * step));
                            picked.push(rest[idx]);
                        }
                    }
                }
                const uniq = [];
                const seen = Object.create(null);
                picked.forEach((v) => {
                    const key = String(v);
                    if (seen[key]) return;
                    seen[key] = true;
                    uniq.push(v);
                });
                return uniq;
            },
            roadSyntaxResolveLodPolicy(totalVisible = 0) {
                const zoom = this.roadSyntaxResolveMapZoom(16);
                const interacting = !!this.roadSyntaxInteractionLowFidelity || this.roadSyntaxIsInteractingInMetricView();
                if (interacting) {
                    const hardCap = zoom <= 14 ? 120 : 180;
                    return {
                        cap: Math.max(80, Math.min(hardCap, totalVisible > 0 ? totalVisible : hardCap)),
                        backboneOnly: true,
                    };
                }
                // LOD rule: low zoom shows only top backbone lines; high zoom restores full detail.
                if (zoom <= 12) return { cap: Math.max(80, Math.min(100, totalVisible || 100)), backboneOnly: true };
                if (zoom <= 13) return { cap: Math.max(100, Math.min(140, totalVisible || 140)), backboneOnly: true };
                if (zoom <= 14) return { cap: Math.max(140, Math.min(200, totalVisible || 200)), backboneOnly: true };
                if (zoom <= 15) return { cap: Math.max(200, Math.min(320, totalVisible || 320)), backboneOnly: true };
                return { cap: Math.max(1, totalVisible || Number.MAX_SAFE_INTEGER), backboneOnly: false };
            },
            roadSyntaxEnterLowFidelityMode() {
                if (!this.isRoadSyntaxMetricViewActive()) return;
                if (!this.roadSyntaxShouldUseLegacyViewportRefresh()) {
                    this.roadSyntaxLeaveLowFidelityMode();
                    return;
                }
                this.roadSyntaxInteractionLowFidelity = true;
                this.roadSyntaxBumpViewportRefreshToken();
                this.roadSyntaxClearViewportRefreshHandles();
                const activeLayerKey = this.roadSyntaxActiveLayerKey || this.resolveRoadSyntaxLayerKey(this.resolveRoadSyntaxActiveMetric());
                this.roadSyntaxResetVisibleIndexCache();
                this.roadSyntaxApplyViewportFilter({
                    layerKey: activeLayerKey,
                    applyStyle: false,
                    styleMode: 'new',
                });
                if (typeof this.switchRoadSyntaxLayerByKey === 'function' && activeLayerKey) {
                    this.switchRoadSyntaxLayerByKey(activeLayerKey, {
                        trackPerf: false,
                        preferVariant: 'lod',
                    });
                }
                if (typeof this.roadSyntaxLogOverlayHealth === 'function') {
                    this.roadSyntaxLogOverlayHealth('enter-low-fidelity');
                }
            },
            roadSyntaxLeaveLowFidelityMode() {
                this.roadSyntaxInteractionLowFidelity = false;
            },
            roadSyntaxResolveViewportVisibleCap(totalVisible = 0) {
                const zoom = this.roadSyntaxResolveMapZoom(16);
                let cap = 760;
                if (zoom <= 12) {
                    cap = 120;
                } else if (zoom <= 13) {
                    cap = 180;
                } else if (zoom <= 14) {
                    cap = 260;
                } else if (zoom <= 15) {
                    cap = 360;
                } else if (zoom <= 16) {
                    cap = 520;
                }
                if (this.roadSyntaxIsInteractingInMetricView()) {
                    cap = Math.min(cap, 140);
                }
                if (this.resolveRoadSyntaxActiveMetric() === 'connectivity') {
                    cap = Math.min(cap, 420);
                }
                if (totalVisible > 0) {
                    cap = Math.min(cap, totalVisible);
                }
                return Math.max(80, Math.floor(cap));
            },
            roadSyntaxDownsampleVisibleIndexes(indexes, cap) {
                const list = Array.isArray(indexes) ? indexes : [];
                const limit = Math.max(1, Math.floor(Number(cap) || 1));
                if (list.length <= limit) return list.slice();
                const out = [];
                const step = list.length / limit;
                let last = -1;
                for (let i = 0; i < limit; i += 1) {
                    const idx = Math.min(list.length - 1, Math.floor(i * step));
                    const lineIdx = Number(list[idx]);
                    if (!Number.isFinite(lineIdx)) continue;
                    if (lineIdx === last) continue;
                    out.push(lineIdx);
                    last = lineIdx;
                }
                return out;
            },
            roadSyntaxClearSwitchThrottleTimer() {
                if (this.roadSyntaxSwitchThrottleTimer) {
                    try { window.clearTimeout(this.roadSyntaxSwitchThrottleTimer); } catch (_) { }
                }
                this.roadSyntaxSwitchThrottleTimer = null;
            },
            roadSyntaxResetLodScoreCache() {
                this.roadSyntaxLodScoreCacheKey = '';
                this.roadSyntaxLodScoreList = [];
            },
            roadSyntaxResetVisibleIndexCache() {
                this.roadSyntaxVisibleIndexCacheKey = '';
                this.roadSyntaxVisibleIndexCacheList = [];
            },
            roadSyntaxBumpViewportRefreshToken() {
                this.roadSyntaxViewportRefreshToken += 1;
                return this.roadSyntaxViewportRefreshToken;
            },
            roadSyntaxIsInteractingInMetricView() {
                return this.roadSyntaxMapInteracting && this.isRoadSyntaxMetricViewActive();
            },
            roadSyntaxClearViewportRefreshHandles() {
                if (this.roadSyntaxViewportRefreshTimer) {
                    try { window.clearTimeout(this.roadSyntaxViewportRefreshTimer); } catch (_) { }
                }
                if (this.roadSyntaxViewportRefreshRaf) {
                    try { window.cancelAnimationFrame(this.roadSyntaxViewportRefreshRaf); } catch (_) { }
                }
                this.roadSyntaxViewportRefreshTimer = null;
                this.roadSyntaxViewportRefreshRaf = null;
            },
            roadSyntaxClearNodeRefreshTimer() {
                if (this.roadSyntaxNodeRefreshTimer) {
                    try { window.clearTimeout(this.roadSyntaxNodeRefreshTimer); } catch (_) { }
                }
                this.roadSyntaxNodeRefreshTimer = null;
            },
            scheduleRoadSyntaxNodeRefresh() {
                this.roadSyntaxClearNodeRefreshTimer();
                this.roadSyntaxNodeRefreshTimer = window.setTimeout(() => {
                    this.roadSyntaxNodeRefreshTimer = null;
                    if (!this.isRoadSyntaxMetricViewActive()) return;
                    if (this.resolveRoadSyntaxActiveMetric() !== 'connectivity') return;
                    this.renderRoadSyntaxNodeMarkers({ forceRebuild: false });
                }, 120);
            },
            scheduleRoadSyntaxViewportRefresh(reason = '') {
                if (!this.isRoadSyntaxMetricViewActive()) return;
                if (!this.roadSyntaxShouldUseLegacyViewportRefresh()) {
                    if (reason === 'moveend' || reason === 'zoomend') {
                        this.roadSyntaxLeaveLowFidelityMode();
                    }
                    return;
                }
                this.roadSyntaxBumpViewportRefreshToken();
                const token = this.roadSyntaxViewportRefreshToken;
                this.roadSyntaxClearViewportRefreshHandles();
                const isInteractionEnd = reason === 'moveend' || reason === 'zoomend';
                const refineDelayMs = Math.max(80, Math.min(600, Number(this.roadSyntaxRefineDelayMs || 150)));
                const waitMs = isInteractionEnd ? refineDelayMs : 36;
                this.roadSyntaxViewportRefreshTimer = window.setTimeout(() => {
                    this.roadSyntaxViewportRefreshTimer = null;
                    this.roadSyntaxViewportRefreshRaf = window.requestAnimationFrame(() => {
                        this.roadSyntaxViewportRefreshRaf = null;
                        if (token !== this.roadSyntaxViewportRefreshToken) return;
                        if (!this.isRoadSyntaxMetricViewActive()) return;
                        if (isInteractionEnd) {
                            this.roadSyntaxLeaveLowFidelityMode();
                        }
                        const activeLayerKey = this.roadSyntaxActiveLayerKey || this.resolveRoadSyntaxLayerKey(this.resolveRoadSyntaxActiveMetric());
                        this.roadSyntaxResetVisibleIndexCache();
                        this.roadSyntaxApplyViewportFilter({
                            layerKey: activeLayerKey,
                            applyStyle: true,
                            styleMode: 'new',
                        });
                        if (typeof this.switchRoadSyntaxLayerByKey === 'function' && activeLayerKey) {
                            const variant = (typeof this.roadSyntaxResolveDesiredLayerVariant === 'function')
                                ? this.roadSyntaxResolveDesiredLayerVariant()
                                : 'full';
                            this.switchRoadSyntaxLayerByKey(activeLayerKey, {
                                trackPerf: false,
                                preferVariant: variant,
                            });
                        }
                        if (typeof this.roadSyntaxLogOverlayHealth === 'function') {
                            this.roadSyntaxLogOverlayHealth(`viewport-refresh:${reason}`);
                        }
                    });
                }, waitMs);
            },
            roadSyntaxResolveFrameBudget(kind = 'layer', totalOps = 0) {
                const budget = (syntaxConst && syntaxConst.BUILD_BUDGET_MS) ? syntaxConst.BUILD_BUDGET_MS : fallbackBudget;
                if (kind === 'node') return budget.node;
                if (kind === 'line_switch') {
                    if (this.roadSyntaxIsInteractingInMetricView()) return budget.interacting;
                    return totalOps <= 1200 ? budget.lineFallbackSmall : budget.lineFallbackLarge;
                }
                if (this.roadSyntaxIsInteractingInMetricView()) return budget.interacting;
                if (this.roadSyntaxPoolInitRunning) return budget.init;
                return budget.steady;
            },
            buildRoadSyntaxBoundsRect(coords) {
                const list = Array.isArray(coords) ? coords : [];
                let minLng = Infinity;
                let minLat = Infinity;
                let maxLng = -Infinity;
                let maxLat = -Infinity;
                for (let i = 0; i < list.length; i += 1) {
                    const loc = this.normalizeLngLat(list[i]);
                    if (!loc) continue;
                    const lng = Number(loc[0]);
                    const lat = Number(loc[1]);
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                }
                if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
                    return null;
                }
                return { minLng, minLat, maxLng, maxLat };
            },
            roadSyntaxResolveMapBoundsRect(bounds) {
                if (!bounds) return null;
                let sw = null;
                let ne = null;
                try {
                    if (typeof bounds.getSouthWest === 'function' && typeof bounds.getNorthEast === 'function') {
                        sw = this.normalizeLngLat(bounds.getSouthWest());
                        ne = this.normalizeLngLat(bounds.getNorthEast());
                    }
                } catch (_) { }
                if (!sw || !ne) return null;
                const minLng = Math.min(sw[0], ne[0]);
                const maxLng = Math.max(sw[0], ne[0]);
                const minLat = Math.min(sw[1], ne[1]);
                const maxLat = Math.max(sw[1], ne[1]);
                if (![minLng, maxLng, minLat, maxLat].every((v) => Number.isFinite(v))) return null;
                return { minLng, minLat, maxLng, maxLat };
            },
            roadSyntaxBuildBoundsRectKey(rect) {
                if (!rect) return '';
                const map = this.roadSyntaxMap();
                let zoom = 0;
                if (map && typeof map.getZoom === 'function') {
                    try { zoom = Number(map.getZoom()) || 0; } catch (_) { zoom = 0; }
                }
                return [
                    zoom.toFixed(2),
                    rect.minLng.toFixed(4),
                    rect.minLat.toFixed(4),
                    rect.maxLng.toFixed(4),
                    rect.maxLat.toFixed(4),
                ].join('|');
            },
            roadSyntaxBoundsRectIntersects(a, b) {
                if (!a || !b) return true;
                if (a.maxLng < b.minLng) return false;
                if (a.minLng > b.maxLng) return false;
                if (a.maxLat < b.minLat) return false;
                if (a.minLat > b.maxLat) return false;
                return true;
            },
            roadSyntaxResetSpatialIndex() {
                this._roadSyntaxSpatialIndex = null;
            },
            roadSyntaxBuildSpatialIndex(items, key) {
                const list = Array.isArray(items) ? items : [];
                const cellSize = 0.005; // about 500m
                const cells = Object.create(null);
                const loose = [];
                let minLng = Infinity;
                let minLat = Infinity;
                let maxLng = -Infinity;
                let maxLat = -Infinity;

                list.forEach((item, idx) => {
                    const bbox = item && item.boundsRect;
                    if (!bbox || !Number.isFinite(bbox.minLng) || !Number.isFinite(bbox.minLat) || !Number.isFinite(bbox.maxLng) || !Number.isFinite(bbox.maxLat)) {
                        loose.push(idx);
                        return;
                    }
                    if (bbox.minLng < minLng) minLng = bbox.minLng;
                    if (bbox.minLat < minLat) minLat = bbox.minLat;
                    if (bbox.maxLng > maxLng) maxLng = bbox.maxLng;
                    if (bbox.maxLat > maxLat) maxLat = bbox.maxLat;
                    const x0 = Math.floor(bbox.minLng / cellSize);
                    const x1 = Math.floor(bbox.maxLng / cellSize);
                    const y0 = Math.floor(bbox.minLat / cellSize);
                    const y1 = Math.floor(bbox.maxLat / cellSize);
                    for (let x = x0; x <= x1; x += 1) {
                        for (let y = y0; y <= y1; y += 1) {
                            const cellKey = `${x},${y}`;
                            if (!cells[cellKey]) cells[cellKey] = [];
                            cells[cellKey].push(idx);
                        }
                    }
                });

                const datasetBounds = Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)
                    ? { minLng, minLat, maxLng, maxLat }
                    : null;

                this._roadSyntaxSpatialIndex = {
                    key: String(key || ''),
                    cellSize,
                    cells,
                    loose,
                    datasetBounds,
                    itemCount: list.length,
                };
                return this._roadSyntaxSpatialIndex;
            },
            roadSyntaxEnsureSpatialIndex() {
                const key = String(this.roadSyntaxSourceFingerprint || '');
                const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                const idx = this._roadSyntaxSpatialIndex;
                if (idx && idx.key === key && Number(idx.itemCount) === items.length) {
                    return idx;
                }
                return this.roadSyntaxBuildSpatialIndex(items, key);
            },
            roadSyntaxCollectSpatialCandidates(boundsRect) {
                const idx = this.roadSyntaxEnsureSpatialIndex();
                if (!idx || !boundsRect) return [];
                const out = [];
                const seen = Object.create(null);
                const cellSize = Number(idx.cellSize) || 0.005;
                const x0 = Math.floor(boundsRect.minLng / cellSize);
                const x1 = Math.floor(boundsRect.maxLng / cellSize);
                const y0 = Math.floor(boundsRect.minLat / cellSize);
                const y1 = Math.floor(boundsRect.maxLat / cellSize);
                for (let x = x0; x <= x1; x += 1) {
                    for (let y = y0; y <= y1; y += 1) {
                        const bucket = idx.cells[`${x},${y}`];
                        if (!Array.isArray(bucket) || !bucket.length) continue;
                        for (let i = 0; i < bucket.length; i += 1) {
                            const lineIdx = Number(bucket[i]);
                            if (!Number.isFinite(lineIdx)) continue;
                            const mark = String(lineIdx);
                            if (seen[mark]) continue;
                            seen[mark] = true;
                            out.push(lineIdx);
                        }
                    }
                }
                if (Array.isArray(idx.loose) && idx.loose.length) {
                    idx.loose.forEach((lineIdx) => {
                        const n = Number(lineIdx);
                        if (!Number.isFinite(n)) return;
                        const mark = String(n);
                        if (seen[mark]) return;
                        seen[mark] = true;
                        out.push(n);
                    });
                }
                return out;
            },
            roadSyntaxCurrentMapBoundsRect() {
                const map = this.roadSyntaxMap();
                if (!map || typeof map.getBounds !== 'function') return null;
                try {
                    return this.roadSyntaxResolveMapBoundsRect(map.getBounds());
                } catch (_) {
                    return null;
                }
            },
            roadSyntaxDatasetMayIntersect(boundsRect) {
                const idx = this.roadSyntaxEnsureSpatialIndex();
                const dataset = idx && idx.datasetBounds ? idx.datasetBounds : null;
                if (!dataset || !boundsRect) return true;
                return this.roadSyntaxBoundsRectIntersects(dataset, boundsRect);
            },
            roadSyntaxCollectVisibleLineIndexes() {
                const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                const total = items.length;
                if (!total) return [];
                const all = Array.from({ length: total }, (_, idx) => idx);
                const applyPolicy = (indexes) => {
                    const list = Array.isArray(indexes) ? indexes : [];
                    const policy = this.roadSyntaxResolveLodPolicy(list.length);
                    if (policy.backboneOnly) return this.roadSyntaxSelectBackboneIndexes(list, policy.cap);
                    return this.roadSyntaxDownsampleVisibleIndexes(list, policy.cap);
                };
                try {
                    if (!this.roadSyntaxViewportLazyEnabled) {
                        return applyPolicy(all);
                    }
                    const boundsRect = this.roadSyntaxCurrentMapBoundsRect();
                    if (!boundsRect) {
                        return applyPolicy(all);
                    }
                    const cacheKey = this.roadSyntaxBuildBoundsRectKey(boundsRect);
                    if (
                        cacheKey
                        && cacheKey === this.roadSyntaxVisibleIndexCacheKey
                        && Array.isArray(this.roadSyntaxVisibleIndexCacheList)
                    ) {
                        return applyPolicy(this.roadSyntaxVisibleIndexCacheList.slice());
                    }
                    const candidates = this.roadSyntaxCollectSpatialCandidates(boundsRect);
                    const source = candidates.length ? candidates : all;
                    const visible = [];
                    source.forEach((idx) => {
                        const lineIdx = Number(idx);
                        if (!Number.isFinite(lineIdx) || lineIdx < 0 || lineIdx >= items.length) return;
                        const item = items[lineIdx];
                        const bbox = item && item.boundsRect;
                        if (!bbox || this.roadSyntaxBoundsRectIntersects(bbox, boundsRect)) {
                            visible.push(lineIdx);
                        }
                    });
                    this.roadSyntaxVisibleIndexCacheKey = cacheKey;
                    this.roadSyntaxVisibleIndexCacheList = visible.slice();
                    return applyPolicy(visible);
                } catch (err) {
                    console.warn('[road-syntax] collect visible indexes fallback', err);
                    return applyPolicy(all);
                }
            },
            roadSyntaxApplyViewportFilter(options = {}) {
                const items = Array.isArray(this.roadSyntaxPolylineItems) ? this.roadSyntaxPolylineItems : [];
                const layerKey = String(
                    options && options.layerKey
                        ? options.layerKey
                        : (this.roadSyntaxActiveLayerKey || this.resolveRoadSyntaxLayerKey(this.resolveRoadSyntaxActiveMetric()))
                );
                if (!items.length) {
                    this.roadSyntaxTargetVisibleLineSet = {};
                    return {
                        visible: 0,
                        total: 0,
                        path: 'pool_only',
                        handle: null,
                        nextVisibleSet: {},
                        visibleIndexes: [],
                    };
                }
                const desiredVariant = (typeof this.roadSyntaxResolveDesiredLayerVariant === 'function')
                    ? this.roadSyntaxResolveDesiredLayerVariant()
                    : 'full';
                const layer = (typeof this.roadSyntaxGetLayer === 'function') ? this.roadSyntaxGetLayer(layerKey) : null;
                const runtimeLayer = (typeof this.roadSyntaxResolveLayerRuntimeEntry === 'function')
                    ? this.roadSyntaxResolveLayerRuntimeEntry(layer, desiredVariant)
                    : null;
                let nextSet = null;
                if (runtimeLayer && runtimeLayer.indexSet && typeof runtimeLayer.indexSet === 'object') {
                    if (typeof this.roadSyntaxCloneIndexSet === 'function') {
                        nextSet = this.roadSyntaxCloneIndexSet(runtimeLayer.indexSet);
                    } else {
                        nextSet = Object.assign({}, runtimeLayer.indexSet);
                    }
                }
                if (!nextSet) {
                    let visibleIndexes = this.roadSyntaxCollectVisibleLineIndexes();
                    if (!Array.isArray(visibleIndexes)) visibleIndexes = [];
                    nextSet = {};
                    visibleIndexes.forEach((idx) => {
                        nextSet[idx] = true;
                    });
                }
                this.roadSyntaxTargetVisibleLineSet = nextSet;
                const visibleIndexes = Object.keys(nextSet)
                    .map((v) => Number(v))
                    .filter((v) => Number.isFinite(v))
                    .sort((a, b) => a - b);
                return {
                    visible: Object.keys(nextSet).length,
                    total: items.length,
                    path: `pool_${desiredVariant}`,
                    handle: null,
                    nextVisibleSet: Object.assign({}, nextSet),
                    visibleIndexes,
                };
            },
            resolveRoadSyntaxInteractionStride() {
                return 1;
            },
            roadSyntaxApplyInteractionStride(strideValue = 1, options = {}) {
                this.roadSyntaxCurrentStride = 1;
            },
        };
    }

    global.createRoadSyntaxUiMethods = createRoadSyntaxUiMethods;
}(window));
