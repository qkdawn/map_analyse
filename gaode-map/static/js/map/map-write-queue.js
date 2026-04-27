(function (global) {
    'use strict';

    function nowMs() {
        if (global.performance && typeof global.performance.now === 'function') {
            return global.performance.now();
        }
        return Date.now();
    }

    function createMapWriteQueue(options = {}) {
        const queue = [];
        const maxTasksPerFrame = Math.max(1, Number(options.maxTasksPerFrame) || 2);
        const onError = typeof options.onError === 'function' ? options.onError : null;

        let scheduled = false;
        let flushing = false;
        let nextTaskId = 1;
        let becameActiveSinceDrain = false;

        const drainListeners = new Set();
        const drainWaiters = [];

        function snapshot(ok = true, reason = 'drain') {
            return {
                ok: !!ok,
                reason: String(reason || 'drain'),
                pending: queue.length,
                flushing: !!flushing,
                timestamp: nowMs(),
            };
        }

        function markActive() {
            becameActiveSinceDrain = true;
        }

        function resolveWaiters(payload) {
            while (drainWaiters.length) {
                const waiter = drainWaiters.shift();
                if (!waiter) continue;
                if (waiter.timer) {
                    try { clearTimeout(waiter.timer); } catch (_) { }
                }
                try {
                    waiter.resolve(payload);
                } catch (_) { }
            }
        }

        function emitDrain(reason = 'drain') {
            if (queue.length > 0 || flushing) return;
            const payload = snapshot(true, reason);
            resolveWaiters(payload);
            if (!becameActiveSinceDrain) return;
            becameActiveSinceDrain = false;
            drainListeners.forEach((listener) => {
                try {
                    listener(payload);
                } catch (_) { }
            });
        }

        function settleTask(task, extra = {}) {
            if (!task || typeof task.resolve !== 'function') return;
            const finishedAt = nowMs();
            const startedAt = Number(task.startedAt || finishedAt);
            const result = Object.assign({
                id: Number(task.id || 0),
                key: String(task.key || ''),
                meta: task.meta || {},
                enqueuedAt: Number(task.enqueuedAt || finishedAt),
                startedAt,
                finishedAt,
                durationMs: Math.max(0, finishedAt - startedAt),
                ok: true,
            }, extra || {});
            try {
                task.resolve(result);
            } catch (_) { }
        }

        function runTask(task) {
            if (!task || typeof task.fn !== 'function') return;
            task.startedAt = nowMs();

            if (typeof task.guard === 'function') {
                let allowed = true;
                try {
                    allowed = !!task.guard(task.meta || {});
                } catch (err) {
                    allowed = false;
                    if (onError) {
                        try {
                            onError(err, Object.assign({}, task.meta || {}, { queue_reason: 'guard_error' }));
                        } catch (_) { }
                    }
                }
                if (!allowed) {
                    settleTask(task, {
                        ok: false,
                        skipped: true,
                        reason: 'guard_rejected',
                    });
                    return;
                }
            }

            try {
                const value = task.fn(task.meta || {});
                if (value === false) {
                    settleTask(task, {
                        ok: false,
                        value,
                    });
                    return;
                }
                if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
                    settleTask(task, Object.assign({ value }, value));
                    return;
                }
                settleTask(task, {
                    ok: true,
                    value,
                });
            } catch (err) {
                if (onError) {
                    try {
                        onError(err, task.meta || {});
                    } catch (_) { }
                }
                settleTask(task, {
                    ok: false,
                    error: err && err.message ? err.message : String(err),
                });
            }
        }

        function schedule() {
            if (scheduled) return;
            scheduled = true;
            const raf = global.requestAnimationFrame;
            if (typeof raf === 'function') {
                raf(flush);
            } else {
                setTimeout(flush, 0);
            }
        }

        function flush() {
            scheduled = false;
            if (flushing) {
                schedule();
                return;
            }
            flushing = true;
            let processed = 0;
            while (queue.length > 0 && processed < maxTasksPerFrame) {
                const task = queue.shift();
                runTask(task);
                processed += 1;
            }
            flushing = false;
            if (queue.length > 0) {
                schedule();
                return;
            }
            emitDrain('flush');
        }

        function enqueue(fn, meta = {}, opts = {}) {
            if (typeof fn !== 'function') {
                return {
                    accepted: false,
                    replaced: false,
                    size: queue.length,
                    id: 0,
                    promise: Promise.resolve({
                        ok: false,
                        skipped: true,
                        reason: 'invalid_fn',
                        pending: queue.length,
                    }),
                };
            }

            markActive();
            const taskMeta = (meta && typeof meta === 'object') ? Object.assign({}, meta) : {};
            const key = typeof opts.key === 'string' && opts.key
                ? String(opts.key)
                : (typeof taskMeta.key === 'string' ? String(taskMeta.key) : '');
            const replaceExisting = opts.replaceExisting !== false;
            const guard = typeof opts.guard === 'function' ? opts.guard : null;

            const task = {
                id: nextTaskId++,
                fn,
                meta: taskMeta,
                key,
                guard,
                enqueuedAt: nowMs(),
                resolve: null,
                startedAt: 0,
            };
            const promise = new Promise((resolve) => {
                task.resolve = resolve;
            });

            let replaced = false;
            if (key && replaceExisting) {
                for (let i = queue.length - 1; i >= 0; i -= 1) {
                    const queued = queue[i];
                    if (!queued || queued.key !== key) continue;
                    queue.splice(i, 1);
                    replaced = true;
                    settleTask(queued || null, {
                        ok: false,
                        skipped: true,
                        replaced: true,
                        reason: 'replaced',
                        replacedBy: task.id,
                    });
                }
            }
            queue.push(task);

            schedule();
            return {
                accepted: true,
                replaced,
                size: queue.length,
                id: task.id,
                promise,
            };
        }

        function flushNow(limit = Infinity) {
            const safeLimit = Math.max(0, Number(limit));
            let processed = 0;
            while (queue.length > 0 && processed < safeLimit) {
                const task = queue.shift();
                runTask(task);
                processed += 1;
            }
            if (queue.length > 0) {
                schedule();
            } else if (!flushing) {
                emitDrain('flush_now');
            }
            return {
                ok: true,
                processed,
                remaining: queue.length,
            };
        }

        function clear(reason = 'cleared') {
            const dropped = queue.splice(0, queue.length);
            dropped.forEach((task) => {
                settleTask(task, {
                    ok: false,
                    skipped: true,
                    cleared: true,
                    reason: String(reason || 'cleared'),
                });
            });
            if (!flushing) {
                emitDrain('clear');
            }
            return dropped.length;
        }

        function size() {
            return queue.length;
        }

        function onDrain(listener) {
            if (typeof listener !== 'function') {
                return () => { };
            }
            drainListeners.add(listener);
            if (queue.length === 0 && !flushing) {
                try {
                    listener(snapshot(true, 'already_idle'));
                } catch (_) { }
            }
            return () => {
                drainListeners.delete(listener);
            };
        }

        function waitForDrain(timeoutMs = 0) {
            const timeout = Math.max(0, Number(timeoutMs) || 0);
            if (queue.length === 0 && !flushing) {
                return Promise.resolve(snapshot(true, 'already_idle'));
            }
            return new Promise((resolve) => {
                const waiter = {
                    resolve,
                    timer: null,
                };
                if (timeout > 0) {
                    waiter.timer = setTimeout(() => {
                        const idx = drainWaiters.indexOf(waiter);
                        if (idx >= 0) {
                            drainWaiters.splice(idx, 1);
                        }
                        resolve(snapshot(false, 'timeout'));
                    }, timeout);
                }
                drainWaiters.push(waiter);
            });
        }

        return {
            enqueue,
            flushNow,
            clear,
            size,
            onDrain,
            waitForDrain,
            maxTasksPerFrame,
        };
    }

    global.createMapWriteQueue = createMapWriteQueue;
}(window));
