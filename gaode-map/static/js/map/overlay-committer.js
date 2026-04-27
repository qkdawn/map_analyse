(function (global) {
    'use strict';

    function buildResolvedHandle(result) {
        return {
            accepted: true,
            queued: false,
            replaced: false,
            id: 0,
            size: 0,
            promise: Promise.resolve(result && typeof result === 'object' ? result : { ok: true }),
        };
    }

    function createRoadSyntaxOverlayCommitMethods() {
        return {
            roadSyntaxFormatReadyStatus(prefix = '图层预加载中', done = 0, total = 0) {
                const safeDone = Number.isFinite(Number(done)) ? Number(done) : 0;
                const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
                return `${prefix}：${safeDone}/${safeTotal}`;
            },
            roadSyntaxBuildVisibleLineSet(lines = null) {
                const source = Array.isArray(lines) ? lines : (Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : []);
                const out = {};
                source.forEach((line, idx) => {
                    if (!line || line.__roadSyntaxBroken) return;
                    out[idx] = true;
                });
                return out;
            },
            roadSyntaxNormalizeVisibleLineSet(setLike = null, lines = null) {
                const source = setLike && typeof setLike === 'object' ? setLike : {};
                const lineList = Array.isArray(lines) ? lines : (Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : []);
                const out = {};
                Object.keys(source).forEach((key) => {
                    const idx = Number(key);
                    if (!Number.isFinite(idx) || idx < 0 || idx >= lineList.length) return;
                    const line = lineList[idx];
                    if (!line || line.__roadSyntaxBroken) return;
                    out[idx] = true;
                });
                return out;
            },
            roadSyntaxCommitOverlayState(nextSet, options = {}) {
                const safeOptions = (options && typeof options === 'object') ? options : {};
                const map = safeOptions.mapRef || this.roadSyntaxMap();
                const reason = String((safeOptions && safeOptions.reason) || 'unknown');
                const queueKeyBase = String((safeOptions && safeOptions.queueKey) || `road_syntax_commit:${reason}`);
                const queueReplaceExisting = Object.prototype.hasOwnProperty.call(safeOptions, 'queueReplaceExisting')
                    ? !!safeOptions.queueReplaceExisting
                    : true;
                const queueGuard = (safeOptions && typeof safeOptions.queueGuard === 'function') ? safeOptions.queueGuard : null;
                const lines = Array.isArray(safeOptions.lines)
                    ? safeOptions.lines
                    : (Array.isArray(this.roadSyntaxPolylines) ? this.roadSyntaxPolylines : []);
                if (!lines.length) {
                    this.roadSyntaxTargetVisibleLineSet = {};
                    this.roadSyntaxAppliedVisibleLineSet = {};
                    this.roadSyntaxOverlayCommitToken = Number(this.roadSyntaxOverlayCommitToken || 0) + 1;
                    this.roadSyntaxOverlayLastCommitPath = 'noop';
                    this.roadSyntaxOverlayLastCommitReason = reason;
                    return {
                        visible: 0,
                        total: 0,
                        hideCount: 0,
                        showCount: 0,
                        path: 'noop',
                        changed: false,
                        handle: buildResolvedHandle({ ok: true, skipped: true, reason: 'empty_lines' }),
                        nextVisibleSet: {},
                        visibleIndexes: [],
                    };
                }

                const prevSet = this.roadSyntaxNormalizeVisibleLineSet(this.roadSyntaxAppliedVisibleLineSet, lines);
                const normalizedNextSet = this.roadSyntaxNormalizeVisibleLineSet(nextSet, lines);

                const hideCandidates = [];
                const showCandidates = [];
                Object.keys(prevSet).forEach((key) => {
                    if (normalizedNextSet[key]) return;
                    const idx = Number(key);
                    const line = Number.isFinite(idx) ? lines[idx] : null;
                    if (!line || line.__roadSyntaxBroken) return;
                    hideCandidates.push(line);
                });
                Object.keys(normalizedNextSet).forEach((key) => {
                    if (prevSet[key]) return;
                    const idx = Number(key);
                    const line = Number.isFinite(idx) ? lines[idx] : null;
                    if (!line || line.__roadSyntaxBroken) {
                        delete normalizedNextSet[key];
                        return;
                    }
                    showCandidates.push(line);
                });

                const hideLines = this.roadSyntaxSanitizeOverlayLines(hideCandidates, {
                    context: `overlay_commit_hide:${reason}`
                });
                const showLines = this.roadSyntaxSanitizeOverlayLines(showCandidates, {
                    context: `overlay_commit_show:${reason}`
                });
                const changed = hideLines.length > 0 || showLines.length > 0;

                let path = 'noop';
                let handle = buildResolvedHandle({ ok: true, skipped: true, reason: 'no_change' });
                let stateCommitted = false;
                const commitState = () => {
                    if (stateCommitted) return;
                    stateCommitted = true;
                    this.roadSyntaxAppliedVisibleLineSet = Object.assign({}, normalizedNextSet);
                    this.roadSyntaxOverlayCommitToken = Number(this.roadSyntaxOverlayCommitToken || 0) + 1;
                    this.roadSyntaxOverlayLastCommitPath = path;
                    this.roadSyntaxOverlayLastCommitReason = reason;
                };
                if (changed) {
                    const batchHandle = this.roadSyntaxTryBatchLineSwitch(hideLines, showLines, map, {
                        skipSanitize: true,
                        returnHandle: true,
                        queueKey: `${queueKeyBase}:batch`,
                        replaceExisting: queueReplaceExisting,
                        guard: queueGuard,
                    });
                    if (batchHandle && batchHandle.accepted) {
                        path = 'map_batch';
                        handle = batchHandle;
                    } else {
                        path = 'line_fallback';
                        const enqueue = typeof this.roadSyntaxEnqueueMapWrite === 'function'
                            ? this.roadSyntaxEnqueueMapWrite.bind(this)
                            : null;
                        if (enqueue) {
                            const fallbackHandle = enqueue(() => {
                                hideLines.forEach((line) => {
                                    if (!line || typeof line.setMap !== 'function') return;
                                    try {
                                        line.setMap(null);
                                    } catch (err) {
                                        try { line.__roadSyntaxBroken = true; } catch (_) { }
                                        try { line.setMap(null); } catch (_) { }
                                        console.warn('[road-syntax] line hide fallback failed; dropped line', {
                                            error: err && err.message ? err.message : String(err)
                                        });
                                    }
                                });
                                showLines.forEach((line) => {
                                    if (!line || typeof line.setMap !== 'function') return;
                                    try {
                                        line.setMap(map || null);
                                    } catch (err) {
                                        try { line.__roadSyntaxBroken = true; } catch (_) { }
                                        try { line.setMap(null); } catch (_) { }
                                        console.warn('[road-syntax] line show fallback failed; dropped line', {
                                            error: err && err.message ? err.message : String(err)
                                        });
                                    }
                                });
                                return { ok: true };
                            }, {
                                key: `${queueKeyBase}:line`,
                                replaceExisting: queueReplaceExisting,
                                guard: queueGuard,
                                meta: {
                                    reason: 'overlay_commit_line_fallback',
                                    hide_count: hideLines.length,
                                    show_count: showLines.length,
                                },
                            });
                            if (fallbackHandle && fallbackHandle.promise) {
                                handle = fallbackHandle;
                            } else {
                                handle = buildResolvedHandle({ ok: false, reason: 'fallback_enqueue_rejected' });
                            }
                        } else {
                            hideLines.forEach((line) => {
                                if (!line || typeof line.setMap !== 'function') return;
                                try {
                                    line.setMap(null);
                                } catch (err) {
                                    try { line.__roadSyntaxBroken = true; } catch (_) { }
                                    try { line.setMap(null); } catch (_) { }
                                    console.warn('[road-syntax] line hide fallback failed; dropped line', {
                                        error: err && err.message ? err.message : String(err)
                                    });
                                }
                            });
                            showLines.forEach((line) => {
                                if (!line || typeof line.setMap !== 'function') return;
                                try {
                                    line.setMap(map || null);
                                } catch (err) {
                                    try { line.__roadSyntaxBroken = true; } catch (_) { }
                                    try { line.setMap(null); } catch (_) { }
                                    console.warn('[road-syntax] line show fallback failed; dropped line', {
                                        error: err && err.message ? err.message : String(err)
                                    });
                                }
                            });
                            handle = buildResolvedHandle({ ok: true, reason: 'fallback_sync' });
                        }
                    }
                }

                Object.keys(normalizedNextSet).forEach((key) => {
                    const idx = Number(key);
                    const line = Number.isFinite(idx) ? lines[idx] : null;
                    if (!line || line.__roadSyntaxBroken) {
                        delete normalizedNextSet[key];
                    }
                });

                const visibleIndexes = Object.keys(normalizedNextSet)
                    .map((v) => Number(v))
                    .filter((v) => Number.isFinite(v))
                    .sort((a, b) => a - b);
                this.roadSyntaxTargetVisibleLineSet = Object.assign({}, normalizedNextSet);

                if (!changed) {
                    commitState();
                } else if (handle && handle.promise && typeof handle.promise.then === 'function') {
                    const sourcePromise = Promise.resolve(handle.promise);
                    handle = Object.assign({}, handle, {
                        promise: sourcePromise.then((result) => {
                            if (result && result.ok) {
                                commitState();
                            }
                            return result && typeof result === 'object'
                                ? result
                                : { ok: false, reason: 'invalid_commit_result' };
                        }).catch((err) => ({
                            ok: false,
                            reason: 'commit_handle_error',
                            error: err && err.message ? err.message : String(err),
                        })),
                    });
                }

                return {
                    visible: visibleIndexes.length,
                    total: lines.length,
                    hideCount: hideLines.length,
                    showCount: showLines.length,
                    path,
                    changed,
                    handle,
                    nextVisibleSet: Object.assign({}, normalizedNextSet),
                    visibleIndexes,
                };
            },
        };
    }

    global.createRoadSyntaxOverlayCommitMethods = createRoadSyntaxOverlayCommitMethods;
}(window));
