(function (global) {
    'use strict';

    function createRoadSyntaxWebGLMethods() {
        return {
            resolveRoadSyntaxLocaApi() {
                if (window.Loca && typeof window.Loca.LineLayer === 'function') {
                    return window.Loca;
                }
                const amapLoca = window.AMap && window.AMap.Loca;
                if (amapLoca && typeof amapLoca.LineLayer === 'function') {
                    return amapLoca;
                }
                return null;
            },
            resolveRoadSyntaxLocaEngine(locaApi) {
                const api = locaApi || this.resolveRoadSyntaxLocaApi();
                if (!api) return '';
                if (typeof api.Container === 'function' && typeof api.GeoJSONSource === 'function') {
                    return 'loca_v2';
                }
                if (typeof api.LineLayer === 'function') {
                    return 'loca_v1';
                }
                return '';
            },
            waitRoadSyntaxLocaApiReady(timeoutMs = 2000, intervalMs = 50) {
                const vm = this;
                const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
                return new Promise((resolve) => {
                    const tick = () => {
                        const api = vm.resolveRoadSyntaxLocaApi();
                        if (api) {
                            resolve(api);
                            return;
                        }
                        if (Date.now() >= deadline) {
                            resolve(null);
                            return;
                        }
                        window.setTimeout(tick, Math.max(10, Number(intervalMs) || 50));
                    };
                    tick();
                });
            },
            roadSyntaxIsArcgisWebglActive() {
                if (!this.roadSyntaxUseArcgisWebgl) return false;
                if (!this.roadSyntaxWebglActive) return false;
                if (typeof this.roadSyntaxCanUseArcgisWebglPayload !== 'function') return false;
                return this.roadSyntaxCanUseArcgisWebglPayload(this.roadSyntaxWebglPayload);
            },
            roadSyntaxCanUseArcgisWebglPayload(payload) {
                if (!payload || typeof payload !== 'object') return false;
                if (!payload.enabled) return false;
                const roads = payload.roads || {};
                const features = Array.isArray(roads.features) ? roads.features : [];
                return features.length > 0;
            },
            async ensureRoadSyntaxLocaReady() {
                if (!window.AMap || !window.AMap.Map) return false;
                if (this.resolveRoadSyntaxLocaApi()) return true;
                if (this._roadSyntaxLocaLoaderPromise) {
                    try {
                        await this._roadSyntaxLocaLoaderPromise;
                    } catch (_) { }
                    return !!this.resolveRoadSyntaxLocaApi();
                }
                const key = String((this.config && this.config.amap_js_api_key) || '').trim();
                if (!key) return false;
                const waitLocaReady = async () => {
                    const api = await this.waitRoadSyntaxLocaApiReady(2200, 40);
                    if (api) return true;
                    throw new Error('loca loaded but api is unavailable');
                };
                this._roadSyntaxLocaLoaderPromise = new Promise((resolve, reject) => {
                    let settled = false;
                    const settle = (ok, err) => {
                        if (settled) return;
                        settled = true;
                        if (timeoutId) {
                            try { window.clearTimeout(timeoutId); } catch (_) { }
                        }
                        if (ok) {
                            resolve(true);
                        } else {
                            reject(err || new Error('loca load failed'));
                        }
                    };
                    const onLoad = () => {
                        waitLocaReady().then(
                            () => settle(true),
                            (err) => settle(false, err)
                        );
                    };
                    const onError = () => settle(false, new Error('loca script load error'));
                    const timeoutId = window.setTimeout(() => {
                        settle(false, new Error('loca load timeout'));
                    }, 12000);

                    const existing = document.querySelector('script[data-road-syntax-loca="1"]');
                    if (existing) {
                        if (this.resolveRoadSyntaxLocaApi()) {
                            settle(true);
                            return;
                        }
                        const loadState = String((existing.dataset && existing.dataset.loadState) || '').trim();
                        if (loadState === 'loaded') {
                            onLoad();
                            return;
                        }
                        if (loadState === 'error') {
                            onError();
                            return;
                        }
                        existing.addEventListener('load', onLoad, { once: true });
                        existing.addEventListener('error', onError, { once: true });
                        return;
                    }
                    const script = document.createElement('script');
                    script.setAttribute('data-road-syntax-loca', '1');
                    script.dataset.loadState = 'loading';
                    script.src = `https://webapi.amap.com/loca?v=1.3.2&key=${encodeURIComponent(key)}`;
                    script.async = true;
                    script.onload = () => {
                        script.dataset.loadState = 'loaded';
                        onLoad();
                    };
                    script.onerror = () => {
                        script.dataset.loadState = 'error';
                        onError();
                    };
                    document.head.appendChild(script);
                });
                try {
                    await this._roadSyntaxLocaLoaderPromise;
                } catch (err) {
                    const reason = err && err.message ? String(err.message) : 'unknown';
                    this.roadSyntaxWebglStatus = `loca_load_failed:${reason}`;
                    console.warn('[road-syntax] loca load failed', err);
                } finally {
                    this._roadSyntaxLocaLoaderPromise = null;
                }
                return !!this.resolveRoadSyntaxLocaApi();
            },
            roadSyntaxWebglMetricStats(features, metricField, fallbackField) {
                const list = Array.isArray(features) ? features : [];
                const values = [];
                const readMetric = function (props, field) {
                    if (!props || typeof props !== 'object') return NaN;
                    if (!Object.prototype.hasOwnProperty.call(props, field)) return NaN;
                    const raw = props[field];
                    if (raw === null || typeof raw === 'undefined' || raw === '') return NaN;
                    const n = Number(raw);
                    return Number.isFinite(n) ? n : NaN;
                };
                list.forEach((feature) => {
                    const props = (feature && feature.properties) || {};
                    let v = readMetric(props, metricField);
                    if (!Number.isFinite(v)) v = readMetric(props, fallbackField);
                    if (!Number.isFinite(v)) v = readMetric(props, 'webgl_metric_value');
                    if (Number.isFinite(v)) values.push(v);
                });
                if (!values.length) return { min: 0, max: 1, p10: 0, p90: 1 };
                values.sort((a, b) => a - b);
                const min = values[0];
                const max = values[values.length - 1];
                const q = (ratio) => {
                    if (values.length <= 1) return values[0];
                    const p = Math.max(0, Math.min(1, Number(ratio) || 0)) * (values.length - 1);
                    const lo = Math.floor(p);
                    const hi = Math.min(values.length - 1, lo + 1);
                    const f = p - lo;
                    return values[lo] + (values[hi] - values[lo]) * f;
                };
                let p10 = q(0.10);
                let p90 = q(0.90);
                if (!(p90 > p10)) {
                    p10 = min;
                    p90 = max;
                }
                if (!(p90 > p10)) {
                    p10 = 0;
                    p90 = 1;
                }
                return { min, max, p10, p90 };
            },
            roadSyntaxWebglStyleFromMetric(metricValue, normValue, hasMetricValue = true) {
                const metric = String(
                    metricValue
                    || (typeof this.resolveRoadSyntaxActiveMetric === 'function'
                        ? this.resolveRoadSyntaxActiveMetric()
                        : (typeof this.roadSyntaxDefaultMetric === 'function' ? this.roadSyntaxDefaultMetric() : 'connectivity'))
                );
                const t = Number.isFinite(Number(normValue)) ? this.clamp01(normValue) : NaN;
                const scale = String(this.roadSyntaxDepthmapColorScale || 'axmanesque').toLowerCase();
                const missingValue = !hasMetricValue || !Number.isFinite(t);
                let depthmapColor = '';
                const safeT = Number.isFinite(t) ? t : 0;
                if (typeof this.roadSyntaxDepthmapClassColor === 'function') {
                    const palette = (typeof this.roadSyntaxDepthmapPalette === 'function')
                        ? this.roadSyntaxDepthmapPalette()
                        : null;
                    depthmapColor = this.roadSyntaxDepthmapClassColor(t, palette);
                } else {
                    const fallbackPalette = ['#3333dd', '#3388dd', '#22ccdd', '#22ccbb', '#22dd88', '#88dd22', '#bbcc22', '#ddcc22', '#dd8833', '#dd3333'];
                    const idx = Math.max(0, Math.min(fallbackPalette.length - 1, Math.floor(safeT * fallbackPalette.length)));
                    depthmapColor = fallbackPalette[idx];
                }
                if (metric === 'intelligibility') {
                    return {
                        // Intelligibility main view is scatter plot; map lines are a visible context layer.
                        lineWidth: 2.2,
                        color: '#2563eb',
                        opacity: 0.62,
                    };
                }
                const hideMissing = missingValue && (scale === 'monochrome' || scale === 'greyscale');
                return {
                    lineWidth: 2.1,
                    color: depthmapColor,
                    opacity: hideMissing ? 0.0 : 0.88,
                };
            },
            roadSyntaxWebglColorFromNorm(normValue, metricValue = null) {
                return this.roadSyntaxWebglStyleFromMetric(
                    metricValue || this.resolveRoadSyntaxActiveMetric(),
                    normValue
                ).color;
            },
            roadSyntaxCloneWebglProps(rawProps) {
                const source = (rawProps && typeof rawProps === 'object') ? rawProps : {};
                const out = {};
                Object.keys(source).forEach((key) => {
                    const value = source[key];
                    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
                        out[key] = value;
                        return;
                    }
                    if (typeof value === 'number') {
                        if (Number.isFinite(value)) {
                            out[key] = value;
                        }
                        return;
                    }
                    if (Array.isArray(value)) {
                        const simpleList = value
                            .map((entry) => {
                                if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') {
                                    return entry;
                                }
                                if (typeof entry === 'number' && Number.isFinite(entry)) {
                                    return entry;
                                }
                                return null;
                            })
                            .filter((entry) => entry !== null);
                        if (simpleList.length) {
                            out[key] = simpleList;
                        }
                    }
                });
                return out;
            },
            roadSyntaxNormalizeWebglLineCoords(rawCoords) {
                const list = Array.isArray(rawCoords) ? rawCoords : [];
                const out = [];
                let prevLng = NaN;
                let prevLat = NaN;
                for (let i = 0; i < list.length; i += 1) {
                    const coord = this.normalizeLngLat(list[i], 'road_syntax.webgl.coord');
                    if (!coord) continue;
                    const lng = Number(coord[0]);
                    const lat = Number(coord[1]);
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
                    if (out.length && Math.abs(lng - prevLng) < 1e-12 && Math.abs(lat - prevLat) < 1e-12) {
                        continue;
                    }
                    out.push([lng, lat]);
                    prevLng = lng;
                    prevLat = lat;
                }
                return out.length >= 2 ? out : [];
            },
            roadSyntaxBuildPlainWebglFeatures(rawFeatures) {
                const source = Array.isArray(rawFeatures) ? rawFeatures : [];
                const out = [];
                source.forEach((feature) => {
                    if (!feature || typeof feature !== 'object') return;
                    const geom = (feature && feature.geometry && typeof feature.geometry === 'object')
                        ? feature.geometry
                        : {};
                    const geomType = String(geom.type || '').toLowerCase();
                    const props = this.roadSyntaxCloneWebglProps((feature && feature.properties) || {});
                    if (geomType === 'linestring') {
                        const coords = this.roadSyntaxNormalizeWebglLineCoords(geom.coordinates);
                        if (coords.length < 2) return;
                        out.push({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: coords,
                            },
                            properties: props,
                        });
                        return;
                    }
                    if (geomType === 'multilinestring') {
                        const parts = Array.isArray(geom.coordinates) ? geom.coordinates : [];
                        const normalizedParts = parts
                            .map((part) => this.roadSyntaxNormalizeWebglLineCoords(part))
                            .filter((part) => Array.isArray(part) && part.length >= 2);
                        if (!normalizedParts.length) return;
                        out.push({
                            type: 'Feature',
                            geometry: {
                                type: 'MultiLineString',
                                coordinates: normalizedParts,
                            },
                            properties: props,
                        });
                    }
                });
                return out;
            },
            roadSyntaxMarkRaw(value) {
                if (window.Vue && typeof window.Vue.markRaw === 'function') {
                    return window.Vue.markRaw(value);
                }
                return value;
            },
            roadSyntaxHideAllPolylineLayers() {
                const map = this.roadSyntaxMap();
                if (!map) return;
                const lines = Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : [];
                // Avoid map.remove(list) here: AMap worker may reject proxied array payloads in some runtimes.
                this.roadSyntaxSetLinesVisible(lines, false, map, { preferBatch: false });
                const pool = this.roadSyntaxLayerPool || {};
                Object.keys(pool).forEach((key) => {
                    const entry = pool[key];
                    if (!entry) return;
                    const variants = entry.variants || {};
                    Object.keys(variants).forEach((variantKey) => {
                        const runtime = variants[variantKey];
                        if (!runtime) return;
                        if (runtime.overlayGroup) {
                            this.roadSyntaxSetOverlayGroupVisible(runtime.overlayGroup, false, map);
                        } else if (Array.isArray(runtime.overlays) && runtime.overlays.length) {
                            this.roadSyntaxSetLinesVisible(runtime.overlays, false, map, { preferBatch: false });
                        }
                    });
                });
                this.roadSyntaxAppliedVisibleLineSet = {};
                this.roadSyntaxTargetVisibleLineSet = {};
            },
            async renderRoadSyntaxArcgisWebgl(payload, options = {}) {
                if (!this.roadSyntaxCanUseArcgisWebglPayload(payload)) {
                    this.roadSyntaxWebglStatus = 'invalid_webgl_payload';
                    return false;
                }
                const map = this.roadSyntaxMap();
                if (!map) {
                    this.roadSyntaxWebglStatus = 'map_unavailable';
                    return false;
                }
                const ready = await this.ensureRoadSyntaxLocaReady();
                const locaApi = this.resolveRoadSyntaxLocaApi();
                if (!ready || !locaApi) {
                    this.roadSyntaxWebglStatus = this.roadSyntaxWebglStatus || 'loca_api_unavailable';
                    return false;
                }
                const locaEngine = this.resolveRoadSyntaxLocaEngine(locaApi);
                if (!locaEngine) {
                    this.roadSyntaxWebglStatus = 'loca_api_unsupported';
                    return false;
                }
                const roads = payload.roads || {};
                const plainFeatures = this.roadSyntaxBuildPlainWebglFeatures(
                    Array.isArray(roads.features) ? roads.features : []
                );
                if (!plainFeatures.length) {
                    this.roadSyntaxWebglStatus = 'webgl_features_empty_after_sanitize';
                    return false;
                }
                const sourceData = {
                    type: 'FeatureCollection',
                    features: plainFeatures,
                };
                const metric = this.resolveRoadSyntaxActiveMetric();
                if (typeof this.resolveRoadSyntaxLayerKey === 'function') {
                    this.roadSyntaxActiveLayerKey = this.resolveRoadSyntaxLayerKey(metric);
                    this.roadSyntaxActiveLayerVariant = 'full';
                }
                const metricField = this.resolveRoadSyntaxMetricField(metric);
                const fallbackField = this.resolveRoadSyntaxFallbackField(metric);
                const stats = this.roadSyntaxWebglMetricStats(sourceData.features, metricField, fallbackField);
                const rangeMin = Number(stats.min);
                const rangeMax = Number(stats.max);
                const vm = this;
                const readMetricNumber = function (props, field) {
                    if (!props || typeof props !== 'object') return NaN;
                    if (!Object.prototype.hasOwnProperty.call(props, field)) return NaN;
                    const raw = props[field];
                    if (raw === null || typeof raw === 'undefined' || raw === '') return NaN;
                    const value = Number(raw);
                    return Number.isFinite(value) ? value : NaN;
                };
                const metricValueFromProps = function (props) {
                    let metricValue = readMetricNumber(props, metricField);
                    if (!Number.isFinite(metricValue)) metricValue = readMetricNumber(props, fallbackField);
                    if (!Number.isFinite(metricValue)) metricValue = readMetricNumber(props, 'webgl_metric_value');
                    return metricValue;
                };
                const resolveFeatureProps = function (candidate) {
                    const feature = candidate && (candidate.value || candidate);
                    if (!feature || typeof feature !== 'object') return {};
                    if (feature.properties && typeof feature.properties === 'object') return feature.properties;
                    return feature;
                };
                const styleFromProps = function (props) {
                    const metricValue = metricValueFromProps(props);
                    const hasMetric = Number.isFinite(metricValue);
                    const norm = hasMetric
                        ? ((typeof vm.roadSyntaxNormalizeScoreByRange === 'function')
                            ? vm.roadSyntaxNormalizeScoreByRange(metricValue, rangeMin, rangeMax)
                            : vm.clamp01(metricValue))
                        : NaN;
                    return vm.roadSyntaxWebglStyleFromMetric(metric, norm, hasMetric);
                };
                let layer = null;
                try {
                    if (locaEngine === 'loca_v2') {
                        if (!this.roadSyntaxLocaContainer) {
                            this.roadSyntaxLocaContainer = this.roadSyntaxMarkRaw(new locaApi.Container({ map: map }));
                        }
                        const source = new locaApi.GeoJSONSource({ data: sourceData });
                        layer = this.roadSyntaxMarkRaw(new locaApi.LineLayer({
                            zIndex: 125,
                            zooms: [2, 20],
                            opacity: 1.0,
                        }));
                        layer.setSource(source);
                        layer.setStyle({
                            lineWidth: function (_index, feature) {
                                const props = resolveFeatureProps(feature);
                                return styleFromProps(props).lineWidth;
                            },
                            color: function (_index, feature) {
                                const props = resolveFeatureProps(feature);
                                return styleFromProps(props).color;
                            },
                            opacity: function (_index, feature) {
                                const props = resolveFeatureProps(feature);
                                return styleFromProps(props).opacity;
                            },
                        });
                    } else {
                        const lineData = [];
                        sourceData.features.forEach((feature) => {
                            const geom = (feature && feature.geometry) || {};
                            const geomType = String(geom.type || '').toLowerCase();
                            const properties = this.roadSyntaxCloneWebglProps((feature && feature.properties) || {});
                            if (geomType === 'linestring' && Array.isArray(geom.coordinates)) {
                                lineData.push({
                                    coordinates: geom.coordinates,
                                    properties,
                                });
                                return;
                            }
                            if (geomType === 'multilinestring' && Array.isArray(geom.coordinates)) {
                                geom.coordinates.forEach((coords) => {
                                    if (!Array.isArray(coords) || coords.length < 2) return;
                                    lineData.push({
                                        coordinates: coords,
                                        properties,
                                    });
                                });
                            }
                        });
                        if (!lineData.length) {
                            this.roadSyntaxWebglStatus = 'loca_v1_empty_line_data';
                            return false;
                        }
                        layer = this.roadSyntaxMarkRaw(new locaApi.LineLayer({
                            map: map,
                            zIndex: 125,
                            zooms: [2, 20],
                            visible: true,
                            eventSupport: false,
                        }));
                        if (typeof layer.setData !== 'function' || typeof layer.setOptions !== 'function') {
                            this.roadSyntaxWebglStatus = 'loca_v1_layer_api_unavailable';
                            return false;
                        }
                        layer.setData(lineData, {
                            lnglat: function (input) {
                                const row = (input && (input.value || input)) || {};
                                return Array.isArray(row.coordinates) ? row.coordinates : [];
                            },
                        });
                        layer.setOptions({
                            style: {
                                lineWidth: function (input) {
                                    const props = resolveFeatureProps(input);
                                    return styleFromProps(props).lineWidth;
                                },
                                color: function (input) {
                                    const props = resolveFeatureProps(input);
                                    return styleFromProps(props).color;
                                },
                                opacity: function (input) {
                                    const props = resolveFeatureProps(input);
                                    return styleFromProps(props).opacity;
                                },
                            },
                        });
                        if (typeof layer.render === 'function') {
                            layer.render();
                        }
                    }
                } catch (err) {
                    const reason = err && err.message ? String(err.message) : 'unknown';
                    this.roadSyntaxWebglStatus = `loca_render_exception:${reason}`;
                    console.warn('[road-syntax] arcgis webgl layer build failed', err);
                    return false;
                }
                if (!layer) {
                    this.roadSyntaxWebglStatus = 'loca_layer_unavailable';
                    return false;
                }

                if (this.roadSyntaxLocaLineLayer) {
                    this.roadSyntaxDetachLocaLayer(this.roadSyntaxLocaLineLayer, map);
                }
                this.roadSyntaxLocaLineLayer = layer;
                if (locaEngine === 'loca_v2') {
                    if (this.roadSyntaxLocaContainer && typeof this.roadSyntaxLocaContainer.add === 'function') {
                        try {
                            this.roadSyntaxLocaContainer.add(layer);
                        } catch (_) { }
                    }
                } else if (typeof layer.setMap === 'function') {
                    try {
                        layer.setMap(map);
                    } catch (_) { }
                }
                if (typeof layer.show === 'function') {
                    try { layer.show(); } catch (_) { }
                }
                if (typeof layer.render === 'function') {
                    try { layer.render(); } catch (_) { }
                }

                this.roadSyntaxHideAllPolylineLayers();
                this.roadSyntaxWebglPayload = payload;
                this.roadSyntaxWebglActive = true;
                this.roadSyntaxWebglStatus = `${String(payload.status || 'ok')}|${locaEngine}|metric=${metricField}`;
                this.roadSyntaxSwitchPath = 'arcgis_webgl';
                // WebGL active means legacy pool progress text should stop overriding UI state.
                this.roadSyntaxPoolInitRunning = false;
                this.roadSyntaxPoolReady = true;
                this.roadSyntaxPoolDegraded = false;
                this.roadSyntaxPoolInitTotal = 1;
                this.roadSyntaxPoolInitDone = 1;
                if (options && options.hideWhenSuspended && this.roadSyntaxDisplaySuspended) {
                    this.setRoadSyntaxArcgisWebglVisible(false);
                } else {
                    this.setRoadSyntaxArcgisWebglVisible(true);
                }
                return true;
            },
            roadSyntaxDetachLocaLayer(layer, map) {
                if (!layer) return;
                const currentMap = map || this.roadSyntaxMap();
                const container = this.roadSyntaxLocaContainer;
                if (container && typeof container.remove === 'function') {
                    try {
                        container.remove(layer);
                    } catch (_) { }
                }
                if (typeof layer.setMap === 'function') {
                    try {
                        layer.setMap(null);
                    } catch (_) { }
                }
                if (typeof layer.hide === 'function') {
                    try {
                        layer.hide();
                    } catch (_) { }
                }
                if (currentMap && typeof currentMap.remove === 'function') {
                    try {
                        currentMap.remove(layer);
                    } catch (_) { }
                }
            },
            setRoadSyntaxArcgisWebglVisible(visible) {
                const layer = this.roadSyntaxLocaLineLayer;
                if (!layer) return;
                try {
                    if (visible) {
                        if (typeof layer.show === 'function') {
                            layer.show();
                        } else if (typeof layer.setMap === 'function') {
                            const map = this.roadSyntaxMap();
                            if (map) layer.setMap(map);
                        }
                        if (typeof layer.render === 'function') layer.render();
                    } else if (typeof layer.hide === 'function') {
                        layer.hide();
                    } else if (typeof layer.setMap === 'function') {
                        layer.setMap(null);
                    }
                } catch (_) { }
            },
            clearRoadSyntaxArcgisWebgl(options = {}) {
                const dispose = !!(options && options.dispose);
                const container = this.roadSyntaxLocaContainer;
                const layer = this.roadSyntaxLocaLineLayer;
                this.roadSyntaxDetachLocaLayer(layer);
                this.roadSyntaxLocaLineLayer = null;
                if (dispose && container && typeof container.destroy === 'function') {
                    try {
                        container.destroy();
                    } catch (_) { }
                    this.roadSyntaxLocaContainer = null;
                }
                this.roadSyntaxWebglActive = false;
                this.roadSyntaxWebglStatus = '';
            },
        };
    }

    global.createRoadSyntaxWebGLMethods = createRoadSyntaxWebGLMethods;
}(window));
