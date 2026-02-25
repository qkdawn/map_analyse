(function (global) {
    'use strict';

    function createRoadSyntaxControllerCoreMethods(ROAD_SYNTAX_CONST) {
        const fallbackConst = Object.freeze({
            SWITCH_SAMPLE_LIMIT: 40,
        });
        const syntaxConst = ROAD_SYNTAX_CONST || fallbackConst;

        function buildResolvedHandle(payload = {}, accepted = true) {
            return {
                accepted: !!accepted,
                queued: false,
                replaced: false,
                id: 0,
                size: 0,
                promise: Promise.resolve(Object.assign({ ok: !!accepted }, payload || {})),
            };
        }

        return {
            roadSyntaxEnsureMapWriteQueue() {
                const current = this.roadSyntaxMapWriteQueue;
                if (current && typeof current.enqueue === 'function') {
                    return current;
                }
                if (global.createMapWriteQueue && typeof global.createMapWriteQueue === 'function') {
                    const maxTasksPerFrame = Math.max(1, Number(this.roadSyntaxMapWriteQueueMaxTasksPerFrame) || 2);
                    const queue = global.createMapWriteQueue({
                        maxTasksPerFrame,
                        onError: (err, meta) => {
                            console.warn('[road-syntax] map write queue task failed', {
                                error: err && err.message ? err.message : String(err),
                                meta: meta || {}
                            });
                        },
                    });
                    this.roadSyntaxMapWriteQueue = queue;
                    this.roadSyntaxMapWriteQueuePending = 0;
                    return queue;
                }
                return null;
            },
            roadSyntaxOnMapWriteDrain(listener) {
                const queue = this.roadSyntaxEnsureMapWriteQueue();
                if (!queue || typeof queue.onDrain !== 'function') {
                    return () => { };
                }
                return queue.onDrain(listener);
            },
            roadSyntaxWaitMapWriteDrain(options = {}) {
                const queue = this.roadSyntaxEnsureMapWriteQueue();
                if (!queue || typeof queue.waitForDrain !== 'function') {
                    return Promise.resolve({ ok: true, reason: 'no_queue' });
                }
                const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
                return queue.waitForDrain(timeoutMs).then((result) => {
                    const normalized = result && typeof result === 'object' ? result : {};
                    return Object.assign({ ok: !!normalized.ok }, normalized);
                }).catch((err) => ({
                    ok: false,
                    reason: 'wait_for_drain_error',
                    error: err && err.message ? err.message : String(err),
                }));
            },
            roadSyntaxClearMapWriteQueue(options = {}) {
                const queue = this.roadSyntaxMapWriteQueue;
                if (queue && typeof queue.clear === 'function') {
                    try {
                        queue.clear((options && options.reason) || 'cleared_by_owner');
                    } catch (_) { }
                }
                this.roadSyntaxMapWriteQueuePending = 0;
                if (options && options.dispose) {
                    this.roadSyntaxMapWriteQueue = null;
                }
            },
            roadSyntaxEnqueueMapWrite(fn, options = {}) {
                if (typeof fn !== 'function') {
                    return buildResolvedHandle({ ok: false, skipped: true, reason: 'invalid_fn' }, false);
                }

                const queue = this.roadSyntaxEnsureMapWriteQueue();
                const key = options && typeof options.key === 'string' ? options.key : '';
                const replaceExisting = !(options && options.replaceExisting === false);
                const guard = options && typeof options.guard === 'function' ? options.guard : null;
                const meta = Object.assign({}, (options && options.meta && typeof options.meta === 'object') ? options.meta : {});
                if (key) meta.key = key;

                if (queue && typeof queue.enqueue === 'function') {
                    const enqueueResult = queue.enqueue(() => fn(meta), meta, {
                        key,
                        replaceExisting,
                        guard,
                    });
                    const promise = Promise.resolve(enqueueResult && enqueueResult.promise).then((result) => {
                        this.roadSyntaxMapWriteQueuePending = typeof queue.size === 'function' ? queue.size() : 0;
                        return result && typeof result === 'object'
                            ? result
                            : { ok: false, skipped: true, reason: 'invalid_queue_result' };
                    }).catch((err) => {
                        this.roadSyntaxMapWriteQueuePending = typeof queue.size === 'function' ? queue.size() : 0;
                        return {
                            ok: false,
                            reason: 'queue_promise_error',
                            error: err && err.message ? err.message : String(err),
                        };
                    });
                    this.roadSyntaxMapWriteQueuePending = typeof queue.size === 'function' ? queue.size() : 0;
                    return {
                        accepted: !!(enqueueResult && enqueueResult.accepted),
                        queued: true,
                        replaced: !!(enqueueResult && enqueueResult.replaced),
                        id: Number((enqueueResult && enqueueResult.id) || 0),
                        size: Number((enqueueResult && enqueueResult.size) || 0),
                        promise,
                    };
                }

                try {
                    const value = fn(meta);
                    this.roadSyntaxMapWriteQueuePending = 0;
                    if (value === false) {
                        return buildResolvedHandle({ ok: false, value }, true);
                    }
                    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
                        return buildResolvedHandle(Object.assign({}, value), true);
                    }
                    return buildResolvedHandle({ ok: true, value }, true);
                } catch (err) {
                    this.roadSyntaxMapWriteQueuePending = 0;
                    return buildResolvedHandle({
                        ok: false,
                        reason: 'fallback_execute_error',
                        error: err && err.message ? err.message : String(err),
                    }, true);
                }
            },
            roadSyntaxSetOverlayGroupVisible(group, visible, mapRef = null, options = {}) {
                if (!group) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, skipped: true, reason: 'group_missing' }, false)
                        : false;
                }
                const canSetMap = typeof group.setMap === 'function';
                const canShow = typeof group.show === 'function';
                const canHide = typeof group.hide === 'function';
                if (!canSetMap && !(visible ? canShow : canHide)) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, skipped: true, reason: 'group_api_missing' }, false)
                        : false;
                }

                const map = mapRef || this.roadSyntaxMap();
                const queueKey = options && typeof options.queueKey === 'string' ? options.queueKey : '';
                const handle = this.roadSyntaxEnqueueMapWrite(() => {
                    let ok = true;
                    try {
                        if (canSetMap) {
                            group.setMap(visible ? map : null);
                            return { ok: true };
                        }
                        if (visible && canShow) {
                            group.show();
                            return { ok: true };
                        }
                        if (!visible && canHide) {
                            group.hide();
                            return { ok: true };
                        }
                        ok = false;
                    } catch (err) {
                        ok = false;
                        console.warn('[road-syntax] overlay group visibility write failed', {
                            visible: !!visible,
                            error: err && err.message ? err.message : String(err)
                        });
                    }
                    return { ok };
                }, {
                    key: queueKey,
                    replaceExisting: !(options && options.replaceExisting === false),
                    guard: options && typeof options.guard === 'function' ? options.guard : null,
                    meta: {
                        reason: 'group_visibility',
                        visible: !!visible,
                        active_layer: String(this.roadSyntaxActiveLayerKey || ''),
                    },
                });

                return options && options.returnHandle ? handle : !!(handle && handle.accepted);
            },
            roadSyntaxSanitizeOverlayLines(lines, options = {}) {
                const input = Array.isArray(lines) ? lines : [];
                if (!input.length) return [];
                const sampleLimit = Math.max(1, Number(options.sampleLimit) || 3);
                const samples = [];
                let dropped = 0;
                const droppedLines = [];
                const out = [];
                const seen = new Set();
                const resolveEndpoint = (candidate, pickLast, depth = 0) => {
                    if (depth > 8 || candidate === null || typeof candidate === 'undefined') return null;
                    const coord = this.normalizeLngLat(
                        candidate,
                        pickLast ? 'road_syntax.overlay_sanitize.endpoint.last' : 'road_syntax.overlay_sanitize.endpoint.first'
                    );
                    if (coord) return coord;
                    if (Array.isArray(candidate)) {
                        if (!candidate.length) return null;
                        const next = candidate[pickLast ? candidate.length - 1 : 0];
                        return resolveEndpoint(next, pickLast, depth + 1);
                    }
                    if (candidate && typeof candidate.getLength === 'function' && typeof candidate.getAt === 'function') {
                        let len = 0;
                        try {
                            len = Number(candidate.getLength()) || 0;
                        } catch (_) {
                            len = 0;
                        }
                        if (len <= 0) return null;
                        let next = null;
                        try {
                            next = candidate.getAt(pickLast ? len - 1 : 0);
                        } catch (_) {
                            next = null;
                        }
                        return resolveEndpoint(next, pickLast, depth + 1);
                    }
                    return null;
                };
                input.forEach((line, idx) => {
                    if (!line || line.__roadSyntaxBroken || typeof line.setMap !== 'function') {
                        dropped += 1;
                        if (samples.length < sampleLimit) {
                            samples.push({ idx, reason: 'line-invalid' });
                        }
                        return;
                    }
                    if (seen.has(line)) {
                        dropped += 1;
                        if (samples.length < sampleLimit) {
                            samples.push({ idx, reason: 'line-duplicate' });
                        }
                        return;
                    }
                    seen.add(line);
                    let path = null;
                    try {
                        path = typeof line.getPath === 'function' ? line.getPath() : null;
                    } catch (_) {
                        path = null;
                    }
                    const firstCoord = resolveEndpoint(path, false);
                    const lastCoord = resolveEndpoint(path, true);
                    if (!firstCoord || !lastCoord) {
                        dropped += 1;
                        try { line.__roadSyntaxBroken = true; } catch (_) { }
                        droppedLines.push(line);
                        if (samples.length < sampleLimit) {
                            samples.push({
                                idx,
                                reason: 'endpoint-invalid'
                            });
                        }
                        return;
                    }
                    out.push(line);
                });
                if (droppedLines.length) {
                    this.roadSyntaxEnqueueMapWrite(() => {
                        droppedLines.forEach((line) => {
                            if (!line || typeof line.setMap !== 'function') return;
                            try { line.setMap(null); } catch (_) { }
                        });
                        return { ok: true };
                    }, {
                        key: 'road_syntax_sanitize_drop',
                        meta: {
                            reason: 'sanitize_drop',
                            dropped: droppedLines.length,
                            context: String((options && options.context) || ''),
                        },
                    });
                }
                if (dropped > 0) {
                    console.warn('[road-syntax] sanitized invalid overlays', {
                        context: String((options && options.context) || ''),
                        dropped,
                        input: input.length,
                        output: out.length,
                        samples
                    });
                }
                return out;
            },
            roadSyntaxSetLinesVisible(lines, visible, mapRef = null, options = {}) {
                const list = this.roadSyntaxSanitizeOverlayLines(lines, {
                    context: visible ? 'set_lines_visible_show' : 'set_lines_visible_hide'
                });
                if (!list.length) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: true, skipped: true, reason: 'empty_list' }, true)
                        : true;
                }

                const map = mapRef || this.roadSyntaxMap();
                const preferBatch = !(options && options.preferBatch === false);
                const queueKey = options && typeof options.queueKey === 'string' ? options.queueKey : '';
                const replaceExisting = !(options && options.replaceExisting === false);
                const guard = options && typeof options.guard === 'function' ? options.guard : null;
                let handle = null;

                if (preferBatch && map) {
                    if (visible && typeof map.add !== 'function') {
                        return options && options.returnHandle
                            ? buildResolvedHandle({ ok: false, reason: 'map_add_unavailable' }, false)
                            : false;
                    }
                    if (!visible && typeof map.remove !== 'function') {
                        return options && options.returnHandle
                            ? buildResolvedHandle({ ok: false, reason: 'map_remove_unavailable' }, false)
                            : false;
                    }
                    handle = this.roadSyntaxEnqueueMapWrite(() => {
                        if (visible) {
                            map.add(list);
                        } else {
                            map.remove(list);
                        }
                        return { ok: true };
                    }, {
                        key: queueKey,
                        replaceExisting,
                        guard,
                        meta: {
                            reason: visible ? 'set_lines_visible_show_batch' : 'set_lines_visible_hide_batch',
                            size: list.length,
                        },
                    });
                } else {
                    handle = this.roadSyntaxEnqueueMapWrite(() => {
                        let ok = true;
                        list.forEach((line) => {
                            if (line && typeof line.setMap === 'function') {
                                try {
                                    line.setMap(visible ? map : null);
                                } catch (err) {
                                    ok = false;
                                    try { line.__roadSyntaxBroken = true; } catch (_) { }
                                    try { line.setMap(null); } catch (_) { }
                                    console.warn('[road-syntax] line setMap fallback failed; dropped line', {
                                        visible: !!visible,
                                        error: err && err.message ? err.message : String(err)
                                    });
                                }
                            }
                        });
                        return { ok };
                    }, {
                        key: queueKey,
                        replaceExisting,
                        guard,
                        meta: {
                            reason: visible ? 'set_lines_visible_show_line' : 'set_lines_visible_hide_line',
                            size: list.length,
                        },
                    });
                }

                return options && options.returnHandle ? handle : !!(handle && handle.accepted);
            },
            roadSyntaxTryGroupSwitch(currentGroup, targetGroup, mapRef = null, options = {}) {
                const map = mapRef || this.roadSyntaxMap();
                if (!targetGroup) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, skipped: true, reason: 'target_group_missing' }, false)
                        : false;
                }

                const queueKey = options && typeof options.queueKey === 'string' ? options.queueKey : '';
                const replaceExisting = !(options && options.replaceExisting === false);
                const guard = options && typeof options.guard === 'function' ? options.guard : null;
                const handle = this.roadSyntaxEnqueueMapWrite(() => {
                    let ok = true;
                    if (currentGroup) {
                        try {
                            if (typeof currentGroup.setMap === 'function') {
                                currentGroup.setMap(null);
                            } else if (typeof currentGroup.hide === 'function') {
                                currentGroup.hide();
                            }
                        } catch (err) {
                            ok = false;
                            console.warn('[road-syntax] hide current overlay group failed', {
                                error: err && err.message ? err.message : String(err)
                            });
                        }
                    }

                    try {
                        if (typeof targetGroup.setMap === 'function') {
                            targetGroup.setMap(map || null);
                        } else if (typeof targetGroup.show === 'function') {
                            targetGroup.show();
                        } else {
                            ok = false;
                        }
                    } catch (err) {
                        ok = false;
                        console.warn('[road-syntax] show target overlay group failed', {
                            error: err && err.message ? err.message : String(err)
                        });
                    }

                    return { ok };
                }, {
                    key: queueKey,
                    replaceExisting,
                    guard,
                    meta: {
                        reason: 'group_switch',
                        has_current: !!currentGroup,
                        has_target: !!targetGroup,
                    },
                });

                return options && options.returnHandle ? handle : !!(handle && handle.accepted);
            },
            roadSyntaxTryBatchLineSwitch(hideLines, showLines, mapRef = null, options = {}) {
                const map = mapRef || this.roadSyntaxMap();
                if (!map) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, reason: 'map_missing' }, false)
                        : false;
                }

                const skipSanitize = !!(options && options.skipSanitize);
                const queueKey = options && typeof options.queueKey === 'string' ? options.queueKey : '';
                const replaceExisting = !(options && options.replaceExisting === false);
                const guard = options && typeof options.guard === 'function' ? options.guard : null;
                const hideList = skipSanitize
                    ? (Array.isArray(hideLines) ? hideLines : [])
                    : this.roadSyntaxSanitizeOverlayLines(hideLines, { context: 'batch_hide' });
                const showList = skipSanitize
                    ? (Array.isArray(showLines) ? showLines : [])
                    : this.roadSyntaxSanitizeOverlayLines(showLines, { context: 'batch_show' });

                if (!hideList.length && !showList.length) {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: true, skipped: true, reason: 'empty_batch' }, true)
                        : true;
                }

                if (hideList.length && typeof map.remove !== 'function') {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, reason: 'map_remove_unavailable' }, false)
                        : false;
                }
                if (showList.length && typeof map.add !== 'function') {
                    return options && options.returnHandle
                        ? buildResolvedHandle({ ok: false, reason: 'map_add_unavailable' }, false)
                        : false;
                }

                const handle = this.roadSyntaxEnqueueMapWrite(() => {
                    if (hideList.length) map.remove(hideList);
                    if (showList.length) map.add(showList);
                    return { ok: true };
                }, {
                    key: queueKey,
                    replaceExisting,
                    guard,
                    meta: {
                        reason: 'batch_switch',
                        hide: hideList.length,
                        show: showList.length,
                    },
                });

                return options && options.returnHandle ? handle : !!(handle && handle.accepted);
            },
            async prewarmRoadSyntaxFirstSwitch(requestToken, activeLayerKey = '') {
                return requestToken === this.roadSyntaxRequestToken;
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
                this.roadSyntaxActiveEdgeCap = null;
                return this.roadSyntaxActiveEdgeCap;
            },
            roadSyntaxLayerReadyCounts() {
                const strictWebglOnly = !!this.roadSyntaxStrictWebglOnly;
                const webglActive = (typeof this.roadSyntaxIsArcgisWebglActive === 'function')
                    ? this.roadSyntaxIsArcgisWebglActive()
                    : (
                        !!this.roadSyntaxUseArcgisWebgl
                        && !!this.roadSyntaxWebglActive
                        && typeof this.roadSyntaxCanUseArcgisWebglPayload === 'function'
                        && this.roadSyntaxCanUseArcgisWebglPayload(this.roadSyntaxWebglPayload)
                    );
                if (webglActive) {
                    return { ready: 1, total: 1 };
                }
                if (strictWebglOnly && this.roadSyntaxUseArcgisWebgl) {
                    return { ready: 0, total: 1 };
                }
                const readyMap = this.roadSyntaxLayerReadyMap || {};
                const total = Object.keys(readyMap).length;
                const ready = Object.values(readyMap).filter((v) => !!v).length;
                return { ready, total };
            },
            recordRoadSyntaxSwitchDuration(startAt, layerKey, hideCount = 0, showCount = 0, path = '') {
                const ms = Math.max(0, this.roadSyntaxNow() - Number(startAt || 0));
                const samples = Array.isArray(this.roadSyntaxSwitchSamples) ? this.roadSyntaxSwitchSamples.slice() : [];
                samples.push(ms);
                if (samples.length > syntaxConst.SWITCH_SAMPLE_LIMIT) {
                    samples.splice(0, samples.length - syntaxConst.SWITCH_SAMPLE_LIMIT);
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
                        map_write_queue_pending: Number(this.roadSyntaxMapWriteQueuePending || 0),
                    });
                }
            },
        };
    }

    global.createRoadSyntaxControllerCoreMethods = createRoadSyntaxControllerCoreMethods;
}(window));
