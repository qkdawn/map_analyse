import { markRaw } from 'vue'

    function createAnalysisIsochroneMethods() {
        return {
                _isScopeCoordPair(point) {
                    return Array.isArray(point)
                        && point.length >= 2
                        && Number.isFinite(Number(point[0]))
                        && Number.isFinite(Number(point[1]));
                },
                _normalizePolygonPayloadRings(raw, traceLabel = 'scope.payload') {
                    const rings = [];
                    const appendRing = (candidate, label) => {
                        const ring = this._closePolygonRing(this.normalizePath(candidate, 3, label));
                        if (Array.isArray(ring) && ring.length >= 4) {
                            rings.push(ring.map((pt) => [Number(pt[0]), Number(pt[1])]));
                        }
                    };
                    if (!Array.isArray(raw) || !raw.length) return rings;
                    if (this._isScopeCoordPair(raw[0])) {
                        appendRing(raw, `${traceLabel}.ring`);
                        return rings;
                    }
                    raw.forEach((item, idx) => {
                        if (Array.isArray(item) && item.length && this._isScopeCoordPair(item[0])) {
                            appendRing(item, `${traceLabel}.ring_${idx}`);
                            return;
                        }
                        if (Array.isArray(item) && item.length && Array.isArray(item[0]) && item[0].length && this._isScopeCoordPair(item[0][0])) {
                            appendRing(item[0], `${traceLabel}.poly_${idx}`);
                        }
                    });
                    return rings;
                },
                _measureScopeRingArea(ring) {
                    if (!Array.isArray(ring) || ring.length < 4) return 0;
                    let sum = 0;
                    for (let i = 0; i < ring.length - 1; i += 1) {
                        const a = ring[i];
                        const b = ring[i + 1];
                        if (!this._isScopeCoordPair(a) || !this._isScopeCoordPair(b)) continue;
                        sum += (Number(a[0]) * Number(b[1])) - (Number(b[0]) * Number(a[1]));
                    }
                    return Math.abs(sum / 2);
                },
                getIsochronePolygonRings() {
                    if (!this.lastIsochroneGeoJSON || !this.lastIsochroneGeoJSON.geometry) return [];
                    const geometry = this.lastIsochroneGeoJSON.geometry;
                    if (geometry.type === 'Polygon') {
                        return this._normalizePolygonPayloadRings(geometry.coordinates && geometry.coordinates[0], 'scope.iso.polygon');
                    }
                    if (geometry.type === 'MultiPolygon') {
                        return this._normalizePolygonPayloadRings(geometry.coordinates || [], 'scope.iso.multipolygon');
                    }
                    return [];
                },
                getIsochronePolygonRing() {
                    const rings = this.getIsochronePolygonRings();
                    if (!rings.length) return null;
                    let best = rings[0];
                    let bestArea = this._measureScopeRingArea(best);
                    rings.slice(1).forEach((ring) => {
                        const area = this._measureScopeRingArea(ring);
                        if (area > bestArea) {
                            best = ring;
                            bestArea = area;
                        }
                    });
                    return best;
                },
                getIsochronePolygonPayload() {
                    const rings = this.getIsochronePolygonRings();
                    if (!rings.length) return [];
                    return rings.length === 1 ? rings[0] : rings;
                },
                _extractGeometryOuterRings(geometry, traceLabel = 'geometry') {
                    if (!geometry || !geometry.type) return [];
                    if (geometry.type === 'Polygon') {
                        return this._normalizePolygonPayloadRings(
                            geometry.coordinates && geometry.coordinates[0],
                            `${traceLabel}.polygon`
                        );
                    }
                    if (geometry.type === 'MultiPolygon') {
                        return this._normalizePolygonPayloadRings(
                            geometry.coordinates || [],
                            `${traceLabel}.multipolygon`
                        );
                    }
                    return [];
                },
                isIsochroneDebugAvailable() {
                    const hasAreaScope = this.isochroneScopeMode === 'area'
                        && this.hasDrawnScopePolygon()
                        && !!this.lastIsochroneGeoJSON;
                    if (!hasAreaScope) return false;
                    if (!this.hasIsochroneForExport()) return false;
                    return this.scopeSource === 'drawn_isochrone' || this.scopeSource === 'history';
                },
                getIsochroneDebugButtonTitle() {
                    if (this.isLoadingIsochroneDebug) return '正在加载采样点调试结果';
                    if (this.isochroneDebugOpen) return '关闭采样点调试图层';
                    if (this.isIsochroneDebugAvailable()) return '显示边界采样点及单点等时圈';
                    return '请先生成面等时圈';
                },
                _buildIsochroneDebugPayload() {
                    const clipPolygon = this.getDrawnScopePolygonPoints();
                    if (!Array.isArray(clipPolygon) || clipPolygon.length < 4) return null;
                    const center = this.selectedPoint
                        ? [Number(this.selectedPoint.lng), Number(this.selectedPoint.lat)]
                        : this._estimatePolygonCenter(clipPolygon);
                    if (!Array.isArray(center) || center.length < 2) return null;
                    return {
                        lat: Number(center[1]),
                        lon: Number(center[0]),
                        time_min: parseInt(this.timeHorizon, 10) || 15,
                        mode: this.transportMode || 'walking',
                        coord_type: 'gcj02',
                        clip_polygon: clipPolygon,
                        sample_boundary_step_m: 120,
                        sample_max_points: null,
                    };
                },
                async toggleIsochroneDebug() {
                    if (this.isLoadingIsochroneDebug) return;
                    if (this.isochroneDebugOpen) {
                        this.clearIsochroneDebugState();
                        return;
                    }
                    if (!this.isIsochroneDebugAvailable()) {
                        this._showH3ExportToast('请先生成面等时圈结果', 'warning');
                        return;
                    }
                    await this.loadIsochroneDebugSamples();
                },
                clearIsochroneDebugState(options = {}) {
                    const preserveData = !!(options && options.preserveData);
                    const markers = Array.isArray(this.isochroneDebugMarkers) ? this.isochroneDebugMarkers : [];
                    markers.forEach((item) => this.safeMapSet(item && item.overlay, null));
                    this.isochroneDebugMarkers = [];

                    const polygons = Array.isArray(this.isochroneDebugPolygons) ? this.isochroneDebugPolygons : [];
                    polygons.forEach((item) => this.safeMapSet(item && item.overlay, null));
                    this.isochroneDebugPolygons = [];

                    if (this.isochroneDebugInfoWindow && typeof this.isochroneDebugInfoWindow.close === 'function') {
                        this.isochroneDebugInfoWindow.close();
                    }

                    if (!preserveData) {
                        this.isochroneDebugSelectedSampleId = '';
                        this.isochroneDebugOpen = false;
                        this.isLoadingIsochroneDebug = false;
                        this.isochroneDebugSamplePoints = [];
                        this.isochroneDebugFeatures = [];
                        this.isochroneDebugErrors = [];
                    }
                },
                async loadIsochroneDebugSamples() {
                    const payload = this._buildIsochroneDebugPayload();
                    if (!payload) {
                        this._showH3ExportToast('当前面等时圈参数不完整，无法加载调试图层', 'warning');
                        return;
                    }
                    this.clearIsochroneDebugState();
                    this.isLoadingIsochroneDebug = true;
                    try {
                        const res = await fetch('/api/v1/analysis/isochrone/debug-samples', {
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
                        const data = await res.json();
                        this.isochroneDebugSamplePoints = Array.isArray(data && data.sample_points) ? data.sample_points : [];
                        this.isochroneDebugFeatures = Array.isArray(data && data.isochrone_features) ? data.isochrone_features : [];
                        this.isochroneDebugErrors = Array.isArray(data && data.meta && data.meta.errors) ? data.meta.errors : [];
                        this.isochroneDebugOpen = true;
                        this.renderIsochroneDebugOverlays();
                        const okCount = this.isochroneDebugFeatures.length;
                        const failCount = this.isochroneDebugErrors.length;
                        this._showH3ExportToast(`调试图层已加载：成功 ${okCount} 个，失败 ${failCount} 个`, 'info', 2400);
                    } catch (e) {
                        console.error(e);
                        this.clearIsochroneDebugState();
                        this._showH3ExportToast(`调试加载失败：${(e && e.message) || e}`, 'error', 3200);
                    } finally {
                        this.isLoadingIsochroneDebug = false;
                    }
                },
                renderIsochroneDebugOverlays() {
                    this.clearIsochroneDebugState({ preserveData: true });
                    if (!this.isochroneDebugOpen) return;
                    const map = this.mapCore && this.mapCore.map ? this.mapCore.map : null;
                    if (!map || typeof AMap === 'undefined') return;

                    const polygonItems = [];
                    (this.isochroneDebugFeatures || []).forEach((feature, featureIdx) => {
                        const sampleId = String((((feature || {}).properties || {}).sample_id) || '').trim();
                        if (!sampleId) return;
                        const rings = this._extractGeometryOuterRings(
                            (feature && feature.geometry) || null,
                            `isochrone.debug.feature_${featureIdx}`
                        );
                        rings.forEach((ring, ringIdx) => {
                            const overlay = new AMap.Polygon(Object.assign({
                                path: ring,
                                bubble: true,
                                clickable: false,
                                zIndex: 106,
                            }, this._getIsochroneDebugPolygonStyle(sampleId)));
                            this.safeMapSet(overlay, map);
                            polygonItems.push({
                                sampleId: sampleId,
                                ringIndex: ringIdx,
                                overlay: overlay,
                            });
                        });
                    });
                    this.isochroneDebugPolygons = polygonItems;

                    const markerItems = [];
                    (this.isochroneDebugSamplePoints || []).forEach((point, idx) => {
                        const sampleId = String((point && point.id) || '').trim();
                        const loc = this.normalizeLngLat(point && point.location, `isochrone.debug.sample_${idx}`);
                        if (!sampleId || !loc) return;
                        const marker = new AMap.CircleMarker(Object.assign({
                            center: loc,
                            bubble: true,
                            clickable: true,
                            cursor: 'pointer',
                            zIndex: 118,
                        }, this._getIsochroneDebugMarkerStyle(sampleId)));
                        marker.on('mouseover', () => this.focusIsochroneDebugSample(sampleId, { openInfoWindow: false }));
                        marker.on('click', () => this.focusIsochroneDebugSample(sampleId, { openInfoWindow: true }));
                        this.safeMapSet(marker, map);
                        markerItems.push({
                            sampleId: sampleId,
                            overlay: marker,
                        });
                    });
                    this.isochroneDebugMarkers = markerItems;
                    this.updateIsochroneDebugOverlayStyles();
                },
                _getIsochroneDebugPolygonStyle(sampleId) {
                    const active = !!sampleId && sampleId === this.isochroneDebugSelectedSampleId;
                    return {
                        strokeColor: active ? '#0f172a' : '#0284c7',
                        strokeWeight: active ? 2.6 : 1.1,
                        strokeOpacity: active ? 0.92 : 0.58,
                        fillColor: active ? '#38bdf8' : '#7dd3fc',
                        fillOpacity: active ? 0.16 : 0.06,
                    };
                },
                _getIsochroneDebugMarkerStyle(sampleId) {
                    const active = !!sampleId && sampleId === this.isochroneDebugSelectedSampleId;
                    return {
                        radius: active ? 7.5 : 4.5,
                        strokeColor: active ? '#082f49' : '#ffffff',
                        strokeWeight: active ? 2 : 1.2,
                        fillColor: active ? '#0ea5e9' : '#f97316',
                        fillOpacity: active ? 0.96 : 0.9,
                    };
                },
                updateIsochroneDebugOverlayStyles() {
                    (this.isochroneDebugPolygons || []).forEach((item) => {
                        if (!item || !item.overlay || typeof item.overlay.setOptions !== 'function') return;
                        item.overlay.setOptions(this._getIsochroneDebugPolygonStyle(item.sampleId));
                    });
                    (this.isochroneDebugMarkers || []).forEach((item) => {
                        if (!item || !item.overlay || typeof item.overlay.setOptions !== 'function') return;
                        item.overlay.setOptions(this._getIsochroneDebugMarkerStyle(item.sampleId));
                    });
                },
                focusIsochroneDebugSample(sampleId, options = {}) {
                    const nextId = String(sampleId || '').trim();
                    if (!nextId) return;
                    this.isochroneDebugSelectedSampleId = nextId;
                    this.updateIsochroneDebugOverlayStyles();
                    if (options && options.openInfoWindow) {
                        this.openIsochroneDebugInfoWindow(nextId);
                    }
                },
                openIsochroneDebugInfoWindow(sampleId) {
                    const nextId = String(sampleId || '').trim();
                    if (!nextId || typeof AMap === 'undefined') return;
                    const markerItem = (this.isochroneDebugMarkers || []).find((item) => item.sampleId === nextId);
                    const point = (this.isochroneDebugSamplePoints || []).find((item) => String(item && item.id) === nextId);
                    if (!markerItem || !markerItem.overlay || !point) return;
                    const errorRow = (this.isochroneDebugErrors || []).find((item) => String(item && item.sample_id) === nextId);
                    const seq = Number(point.seq || 0) || 0;
                    const loc = this.normalizeLngLat(point.location, `isochrone.debug.info.${nextId}`);
                    if (!loc) return;
                    if (!this.isochroneDebugInfoWindow) {
                        this.isochroneDebugInfoWindow = new AMap.InfoWindow({
                            offset: new AMap.Pixel(0, -12),
                            closeWhenClickMap: true,
                        });
                    }
                    const statusText = errorRow ? '失败' : '成功';
                    const messageText = errorRow && errorRow.message ? ` / ${String(errorRow.message)}` : '';
                    const html = `
                        <div style="min-width:180px; line-height:1.5; font-size:12px; color:#0f172a;">
                            <div style="font-weight:700; margin-bottom:4px;">采样点 #${seq}</div>
                            <div>坐标：${Number(loc[0]).toFixed(6)}, ${Number(loc[1]).toFixed(6)}</div>
                            <div>状态：${statusText}${messageText}</div>
                        </div>
                    `;
                    this.isochroneDebugInfoWindow.setContent(html);
                    this.isochroneDebugInfoWindow.open(this.mapCore && this.mapCore.map ? this.mapCore.map : null, loc);
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
                hasDrawnScopePolygon() {
                    const polygon = this.getDrawnScopePolygonPoints();
                    return Array.isArray(polygon) && polygon.length >= 4;
                },
                getDrawnScopePointCount() {
                    const polygon = this.hasDrawnScopePolygon() ? this.getDrawnScopePolygonPoints() : [];
                    if (!polygon.length) return 0;
                    let count = polygon.length;
                    const first = polygon[0];
                    const last = polygon[polygon.length - 1];
                    if (
                        Array.isArray(first)
                        && Array.isArray(last)
                        && Math.abs(Number(first[0]) - Number(last[0])) < 1e-8
                        && Math.abs(Number(first[1]) - Number(last[1])) < 1e-8
                    ) {
                        count -= 1;
                    }
                    return Math.max(0, count);
                },
                _closePolygonRing(path) {
                    const normalized = Array.isArray(path) ? path.slice() : [];
                    if (normalized.length < 3) return [];
                    const first = normalized[0];
                    const last = normalized[normalized.length - 1];
                    if (
                        !Array.isArray(first)
                        || !Array.isArray(last)
                        || first.length < 2
                        || last.length < 2
                    ) {
                        return [];
                    }
                    if (
                        Math.abs(Number(first[0]) - Number(last[0])) > 1e-8
                        || Math.abs(Number(first[1]) - Number(last[1])) > 1e-8
                    ) {
                        normalized.push([first[0], first[1]]);
                    }
                    return normalized;
                },
                _estimatePolygonCenter(path) {
                    const normalized = this.normalizePath(path, 3, 'draw_scope.center');
                    if (!normalized.length) return null;
                    let minLng = Infinity;
                    let minLat = Infinity;
                    let maxLng = -Infinity;
                    let maxLat = -Infinity;
                    normalized.forEach((pt) => {
                        const lng = Number(pt[0]);
                        const lat = Number(pt[1]);
                        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
                        if (lng < minLng) minLng = lng;
                        if (lat < minLat) minLat = lat;
                        if (lng > maxLng) maxLng = lng;
                        if (lat > maxLat) maxLat = lat;
                    });
                    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
                        return null;
                    }
                    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
                },
                stopScopeDrawing(options = {}) {
                    const opts = (options && typeof options === 'object') ? options : {};
                    const mouseTool = this.drawScopeMouseTool;
                    if (mouseTool && this.drawScopeDrawHandler && typeof mouseTool.off === 'function') {
                        try {
                            mouseTool.off('draw', this.drawScopeDrawHandler);
                        } catch (_) { }
                    }
                    if (mouseTool && typeof mouseTool.close === 'function') {
                        try {
                            mouseTool.close();
                        } catch (_) { }
                    }
                    this.drawScopeDrawHandler = null;
                    this.drawScopeActive = false;
                    if (opts.destroyTool) {
                        this.drawScopeMouseTool = null;
                    }
                },
                async ensureDrawScopeToolReady() {
                    if (this.drawScopeMouseTool) return { ok: true, cached: true };
                    if (!this.mapCore || !this.mapCore.map) return { ok: false, reason: 'map-not-ready' };
                    if (!window.AMap || typeof AMap.plugin !== 'function') return { ok: false, reason: 'amap-not-ready' };
                    return new Promise((resolve) => {
                        try {
                            AMap.plugin(['AMap.MouseTool'], () => {
                                try {
                                    this.drawScopeMouseTool = markRaw(new AMap.MouseTool(this.mapCore.map));
                                    resolve({ ok: true, cached: false });
                                } catch (e) {
                                    console.error('MouseTool init failed', e);
                                    resolve({ ok: false, reason: 'mouse-tool-init-failed' });
                                }
                            });
                        } catch (e) {
                            console.error('AMap.plugin MouseTool failed', e);
                            resolve({ ok: false, reason: 'mouse-tool-plugin-failed' });
                        }
                    });
                },
                async toggleScopeDrawing() {
                    if (this.drawScopeActive) {
                        this.stopScopeDrawing();
                        return;
                    }
                    if (this.isCalculating) return;
                    const ready = await this.ensureDrawScopeToolReady();
                    if (!ready || !ready.ok || !this.drawScopeMouseTool) {
                        this.errorMessage = '绘制工具加载失败，请稍后重试';
                        return;
                    }

                    this.stopScopeDrawing();
                    const mouseTool = this.drawScopeMouseTool;
                    this.drawScopeDrawHandler = (evt) => {
                        const overlay = evt && evt.obj ? evt.obj : null;
                        const rawPath = (overlay && typeof overlay.getPath === 'function') ? overlay.getPath() : [];
                        if (overlay && typeof overlay.setMap === 'function') {
                            try { overlay.setMap(null); } catch (_) { }
                        }
                        const normalized = this.normalizePath(rawPath, 3, 'draw_scope.path');
                        const ring = this._closePolygonRing(normalized);
                        this.stopScopeDrawing();
                        if (ring.length < 4) {
                            this.errorMessage = '绘制区域无效，请重新绘制';
                            return;
                        }

                        this.clearH3Grid();
                        this.lastIsochroneGeoJSON = {
                            type: 'Feature',
                            properties: {
                                mode: 'drawn_polygon',
                            },
                            geometry: {
                                type: 'Polygon',
                                coordinates: [ring],
                            },
                        };
                        this.drawnScopePolygon = ring.map((pt) => [pt[0], pt[1]]);
                        this.scopeSource = 'drawn_polygon';
                        if (this.mapCore && typeof this.mapCore.clearBoundaryPolygons === 'function') {
                            this.mapCore.clearBoundaryPolygons();
                        }
                        this.applySimplifyConfig();
                        const center = this._estimatePolygonCenter(ring);
                        if (center) {
                            this.setSelectedPoint({ lng: center[0], lat: center[1] }, { showMarker: false });
                        }
                        this.errorMessage = '';
                        this.poiStatus = '已绘制范围，可直接进入下一步';
                    };

                    if (typeof mouseTool.on === 'function') {
                        mouseTool.on('draw', this.drawScopeDrawHandler);
                    }
                    this.drawScopeActive = true;
                    this.errorMessage = '绘制模式已开启：单击添加顶点，双击结束';
                    try {
                        mouseTool.polygon({
                            strokeColor: '#ff6f00',
                            strokeWeight: 2,
                            strokeOpacity: 0.95,
                            fillColor: '#ff6f00',
                            fillOpacity: 0.12,
                        });
                    } catch (e) {
                        console.error('MouseTool polygon start failed', e);
                        this.stopScopeDrawing();
                        this.errorMessage = '进入绘制模式失败，请重试';
                    }
                },
                clearDrawnScopePolygon() {
                    this.stopScopeDrawing();
                    if (!this.hasDrawnScopePolygon()) return;
                    this.scopeSource = '';
                    this.currentHistoryRecordId = '';
                    this.currentHistoryPolygonWgs84 = [];
                    this.drawnScopePolygon = [];
                    this.lastIsochroneGeoJSON = null;
                    this.clearH3Grid();
                    this.applySimplifyConfig();
                    this.poiStatus = '';
                    this.errorMessage = '';
                },
                setIsochroneScopeMode(mode) {
                    const next = String(mode || '').trim().toLowerCase() === 'area' ? 'area' : 'point';
                    if (next === this.isochroneScopeMode) return;
                    this.isochroneScopeMode = next;
                    this.errorMessage = '';
                    this.stopScopeDrawing();
                    this.clearIsochroneDebugState();
                    if (next === 'point') {
                        if (this.scopeSource === 'drawn_polygon') {
                            this.scopeSource = '';
                            this.currentHistoryRecordId = '';
                            this.currentHistoryPolygonWgs84 = [];
                            this.drawnScopePolygon = [];
                            this.lastIsochroneGeoJSON = null;
                            this.clearScopeOutlineDisplay();
                        }
                        this.poiStatus = '';
                        this.applySimplifyConfig();
                        return;
                    }
                    if (this.marker) {
                        this.safeMapSet(this.marker, null);
                        this.marker = null;
                    }
                    if (this.scopeSource !== 'drawn_polygon') {
                        this.poiStatus = '已切换到面等时圈，请先绘制范围';
                    }
                    this.applySimplifyConfig();
                },
                setSelectedPoint(lnglat, options = {}) {
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
                    const showMarker = Object.prototype.hasOwnProperty.call(options, 'showMarker')
                        ? !!options.showMarker
                        : (this.isochroneScopeMode === 'point');
                    if (!showMarker) {
                        if (this.marker) {
                            this.safeMapSet(this.marker, null);
                            this.marker = null;
                        }
                        return;
                    }
                    const markerPos = (window.AMap && typeof AMap.LngLat === 'function')
                        ? new AMap.LngLat(lng, lat)
                        : [lng, lat];
                    if (this.marker) {
                        this.marker.setPosition(markerPos);
                        return;
                    }
                    if (!this.mapCore || !this.mapCore.map) return;
                    this.marker = markRaw(new AMap.Marker({ position: markerPos }));
                    this.mapCore.map.add(this.marker);
                },
                resolveMapCenterTarget() {
                    if (this.selectedPoint && Number.isFinite(Number(this.selectedPoint.lng)) && Number.isFinite(Number(this.selectedPoint.lat))) {
                        return [Number(this.selectedPoint.lng), Number(this.selectedPoint.lat)];
                    }
                    const polygon = this.getIsochronePolygonPoints();
                    if (Array.isArray(polygon) && polygon.length >= 3) {
                        let minLng = Infinity;
                        let minLat = Infinity;
                        let maxLng = -Infinity;
                        let maxLat = -Infinity;
                        polygon.forEach((pt) => {
                            if (!Array.isArray(pt) || pt.length < 2) return;
                            const lng = Number(pt[0]);
                            const lat = Number(pt[1]);
                            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
                            if (lng < minLng) minLng = lng;
                            if (lat < minLat) minLat = lat;
                            if (lng > maxLng) maxLng = lng;
                            if (lat > maxLat) maxLat = lat;
                        });
                        if (Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)) {
                            return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
                        }
                    }
                    const center = this.mapCore && this.mapCore.center ? this.mapCore.center : null;
                    if (center && Number.isFinite(Number(center.lng)) && Number.isFinite(Number(center.lat))) {
                        return [Number(center.lng), Number(center.lat)];
                    }
                    return [112.9388, 28.2282];
                },
                goMapBackToCenter() {
                    const map = this.mapCore && this.mapCore.map ? this.mapCore.map : null;
                    if (!map) return;
                    const target = this.resolveMapCenterTarget();
                    const currentZoom = Number(map.getZoom ? map.getZoom() : NaN);
                    if (typeof map.setZoomAndCenter === 'function' && Number.isFinite(currentZoom)) {
                        map.setZoomAndCenter(currentZoom, target);
                        return;
                    }
                    if (typeof map.setCenter === 'function') {
                        map.setCenter(target);
                    }
                },
                isStep3PanelVisible(panelId) {
                    if (panelId === 'syntax' && !this.roadSyntaxModulesReady) {
                        return false;
                    }
                    return true;
                },
                getIsochronePolygonPoints() {
                    const ring = this.getIsochronePolygonRing();
                    return Array.isArray(ring) ? ring.slice() : [];
                },
                getDrawnScopePolygonPoints() {
                    const ring = this._closePolygonRing(
                        this.normalizePath(this.drawnScopePolygon, 3, 'draw_scope.stored')
                    );
                    return Array.isArray(ring) ? ring.slice() : [];
                },
                _prepareScopeAnalysisRun() {
                    this.isCalculating = true;
                    this.errorMessage = '';
                    this.fetchProgress = 0;
                    this.poiStatus = '';
                    this.resetRoadSyntaxState();
                    this.resetPopulationAnalysisState({ keepMeta: true, keepYear: true });
                    this.clearIsochroneDebugState();
                },
                _completeScopeAnalysis(geojson, options = {}) {
                    this.clearH3Grid();
                    this.scopeSource = String((options && options.scopeSource) || '').trim();
                    this.currentHistoryRecordId = '';
                    this.currentHistoryPolygonWgs84 = [];
                    this.renderResult(geojson);
                    this.step = 2;
                    this.activeStep3Panel = 'poi';
                    this.lastNonAgentStep3Panel = 'poi';
                    if (typeof this.resetAnalysisDisplayTargetsForPanel === 'function') {
                        this.resetAnalysisDisplayTargetsForPanel('poi', { apply: false });
                    }
                    this.applySimplifyConfig();
                    this.poiStatus = String((options && options.poiStatus) || '');
                },
                _resolveCircleRadiusMeters() {
                    const speedByMode = {
                        walking: 5,
                        bicycling: 15,
                        driving: 30,
                    };
                    const mode = String(this.transportMode || 'walking').trim().toLowerCase();
                    const speedKmh = Number(speedByMode[mode]) || speedByMode.walking;
                    const timeMin = Math.max(0, parseInt(this.timeHorizon, 10) || 15);
                    return (speedKmh * 1000 * timeMin) / 60;
                },
                _buildCircleScopeGeoJSON(center, radiusMeters) {
                    const lng = Number(center && center.lng);
                    const lat = Number(center && center.lat);
                    const safeRadiusMeters = Number(radiusMeters);
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
                    if (!Number.isFinite(safeRadiusMeters) || safeRadiusMeters <= 0) return null;

                    const segments = 72;
                    const metersPerLatDegree = 111320;
                    const cosLat = Math.cos((lat * Math.PI) / 180);
                    const metersPerLonDegree = Math.max(1e-6, metersPerLatDegree * Math.abs(cosLat));
                    const ring = [];

                    for (let i = 0; i <= segments; i += 1) {
                        const angle = (Math.PI * 2 * i) / segments;
                        const dxMeters = safeRadiusMeters * Math.cos(angle);
                        const dyMeters = safeRadiusMeters * Math.sin(angle);
                        ring.push([
                            lng + (dxMeters / metersPerLonDegree),
                            lat + (dyMeters / metersPerLatDegree),
                        ]);
                    }

                    return {
                        type: 'Feature',
                        properties: {
                            mode: 'circle',
                            scope_kind: 'circle',
                            center: [lng, lat],
                            time_min: parseInt(this.timeHorizon, 10) || 15,
                            transport_mode: this.transportMode || 'walking',
                            radius_m: safeRadiusMeters,
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [ring],
                        },
                    };
                },
                async startCircleAnalysis() {
                    if (this.isCalculating || this.drawScopeActive) return;
                    if (this.isochroneScopeMode !== 'point' || !this.selectedPoint) return;

                    this._prepareScopeAnalysisRun();
                    try {
                        const radiusMeters = this._resolveCircleRadiusMeters();
                        const geojson = this._buildCircleScopeGeoJSON(this.selectedPoint, radiusMeters);
                        if (!geojson) {
                            throw new Error('圆形圈参数无效');
                        }
                        this._completeScopeAnalysis(geojson, {
                            scopeSource: 'circle',
                            poiStatus: `已生成约 ${Math.round(radiusMeters)} 米圆形范围`,
                        });
                    } catch (e) {
                        console.error(e);
                        this.errorMessage = "计算失败: " + e.message;
                    } finally {
                        this.isCalculating = false;
                    }
                },
                async startAnalysis() {
                    if (this.isCalculating || this.drawScopeActive) return;
                    const useDrawnScope = this.isochroneScopeMode === 'area';
                    if (useDrawnScope && !this.hasDrawnScopePolygon()) {
                        this.errorMessage = '请先绘制分析区域';
                        return;
                    }
                    if (!useDrawnScope && !this.selectedPoint) return;
                    this._prepareScopeAnalysisRun();

                    try {
                        if (useDrawnScope) {
                            const drawnPolygon = this.getDrawnScopePolygonPoints();
                            const fallbackCenter = this._estimatePolygonCenter(drawnPolygon);
                            if (!this.selectedPoint && fallbackCenter) {
                                this.setSelectedPoint({ lng: fallbackCenter[0], lat: fallbackCenter[1] }, { showMarker: false });
                            }
                            if (!this.selectedPoint) {
                                throw new Error('手绘范围中心点无效，请重新绘制');
                            }
                            const payload = {
                                lat: this.selectedPoint.lat,
                                lon: this.selectedPoint.lng,
                                time_min: parseInt(this.timeHorizon),
                                mode: this.transportMode,
                                coord_type: 'gcj02',
                                origin_mode: 'multi_sample',
                                clip_polygon: drawnPolygon,
                                clip_output: false,
                                sample_boundary_step_m: 120,
                                sample_inner_step_m: 220
                            };
                            const res = await fetch('/api/v1/analysis/isochrone', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (!res.ok) throw new Error("API 请求失败");
                            const geojson = await res.json();
                            this._completeScopeAnalysis(geojson, {
                                scopeSource: 'drawn_isochrone',
                                poiStatus: '已按手绘范围计算等时圈',
                            });
                            return;
                        }

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
                        this._completeScopeAnalysis(geojson, {
                            scopeSource: 'isochrone',
                        });

                    } catch (e) {
                        console.error(e);
                        this.errorMessage = "计算失败: " + e.message;
                    } finally {
                        this.isCalculating = false;
                    }
                },
                async triggerSearch() {
                    if (this.isochroneScopeMode !== 'point') {
                        this.errorMessage = '点等时圈模式下才可搜索起点';
                        return;
                    }
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
        };
    }

export { createAnalysisIsochroneMethods };
