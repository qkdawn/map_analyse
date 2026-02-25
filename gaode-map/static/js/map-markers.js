(function (window, MapUtils) {
    function normalizeLngLatPair(point) {
        if (!point || typeof point !== 'object') return null;
        var lng = Number(point.lng);
        var lat = Number(point.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return [lng, lat];
    }

    function buildPointSample(point, idx) {
        var p = point && typeof point === 'object' ? point : {};
        return {
            idx: Number(idx),
            pid: p._pid || '',
            id: p.id || '',
            name: p.name || '',
            type: p.type || '',
            lng: p.lng,
            lat: p.lat,
            location: p.location
        };
    }

    function cloneStringArray(input) {
        if (!Array.isArray(input)) return [];
        return input
            .map(function (v) { return typeof v === 'string' ? v : String(v || ''); })
            .filter(function (v) { return v.length > 0; });
    }

    function buildMarkerDataSnapshot(point) {
        var p = point && typeof point === 'object' ? point : {};
        var lng = Number(p.lng);
        var lat = Number(p.lat);
        return {
            _pid: p._pid ? String(p._pid) : '',
            id: p.id === null || typeof p.id === 'undefined' ? '' : String(p.id),
            name: p.name === null || typeof p.name === 'undefined' ? '' : String(p.name),
            type: p.type === null || typeof p.type === 'undefined' ? '' : String(p.type),
            address: p.address === null || typeof p.address === 'undefined' ? '' : String(p.address),
            lines: cloneStringArray(p.lines),
            distance: p.distance === null || typeof p.distance === 'undefined' ? '' : String(p.distance),
            disabled: !!p.disabled,
            lng: Number.isFinite(lng) ? lng : NaN,
            lat: Number.isFinite(lat) ? lat : NaN,
        };
    }

    function markRawMapObject(value) {
        if (window.Vue && typeof window.Vue.markRaw === 'function') {
            return window.Vue.markRaw(value);
        }
        return value;
    }

    function MarkerManager(mapCore, config) {
        this.mapCore = mapCore;
        this.map = mapCore.map;
        this.mapData = (config && config.mapData) || {};
        this.mapTypeConfig = (config && config.mapTypeConfig) || {};
        this.enqueueMapWrite = (config && typeof config.enqueueMapWrite === 'function')
            ? config.enqueueMapWrite
            : null;
        this.isWriteAllowed = (config && typeof config.isWriteAllowed === 'function')
            ? config.isWriteAllowed
            : null;

        this.centerPoint = this.mapData.center || { lng: 0, lat: 0, name: '中心点', type: 'center' };

        this.markers = [];
        this.markersByType = {};
        this.markersByPid = {};
        this.typeClusterers = {};
        this.clusterRenderers = {};
        this.pointsByType = {};
        this.pointsByPid = {};
        this.pointStateMap = {};
        this.typeLabelMap = {};
        this.markerClassMap = {};
        this.labelsVisible = false;
        this.activeTypes = new Set();
        this.existingTypes = new Set();
        this.lastVisibleMarkerPids = new Set();
        this.lastFilteredPoints = [];
        this.showMarkers = true;
        this.hideAllPoints = false;
        this.spatialFilter = null;
        this._invalidAddMarkerCount = 0;
        this._invalidRuntimePositionWarned = false;
        this._coordHealthLastLogAt = 0;
        this.clustererDegraded = false;
        this.clustererDegradeReason = '';
        this._clustererErrorCount = 0;
        this._mapWriteToken = 0;
        this._inMapWriteTask = false;
        this._disposed = false;

        this.onMarkerClick = null;
    }

    MarkerManager.prototype.dispose = function () {
        this._disposed = true;
        this._mapWriteToken = Number(this._mapWriteToken || 0) + 1;
        try {
            this.destroyClusterers({ immediate: true });
        } catch (_) { }
    };

    MarkerManager.prototype.runMapWrite = function (fn, options) {
        var self = this;
        if (typeof fn !== 'function') {
            return { accepted: false, promise: Promise.resolve({ ok: false, reason: 'invalid_fn' }) };
        }
        var opts = options && typeof options === 'object' ? options : {};
        var key = typeof opts.key === 'string' && opts.key ? opts.key : 'write';
        var replaceExisting = opts.replaceExisting !== false;
        var guard = typeof opts.guard === 'function' ? opts.guard : null;
        var meta = (opts.meta && typeof opts.meta === 'object') ? Object.assign({}, opts.meta) : {};
        if (!meta.reason) meta.reason = 'marker_manager_write';
        var evaluateGuard = function (taskMeta) {
            if (typeof guard !== 'function') return { ok: true };
            var guardMeta = taskMeta && typeof taskMeta === 'object' ? taskMeta : {};
            try {
                var allowed = !!guard(guardMeta);
                if (!allowed) {
                    return { ok: false, skipped: true, reason: 'guard_rejected' };
                }
                return { ok: true };
            } catch (err) {
                return {
                    ok: false,
                    skipped: true,
                    reason: 'guard_error',
                    error: err && err.message ? err.message : String(err)
                };
            }
        };

        var executeSafely = function (taskMeta) {
            if (!self.canWriteToMap()) {
                return { ok: false, skipped: true, reason: 'manager_disposed' };
            }
            var mergedMeta = Object.assign({}, meta, taskMeta || {});
            var guardResult = evaluateGuard(mergedMeta);
            if (!guardResult || guardResult.ok === false) {
                return guardResult || { ok: false, skipped: true, reason: 'guard_rejected' };
            }
            self._inMapWriteTask = true;
            try {
                var value = fn(mergedMeta);
                if (value === false) return { ok: false, value: value };
                if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
                    return value;
                }
                return { ok: true, value: value };
            } catch (err) {
                return {
                    ok: false,
                    reason: 'marker_write_error',
                    error: err && err.message ? err.message : String(err)
                };
            } finally {
                self._inMapWriteTask = false;
            }
        };

        if (!self.canWriteToMap()) {
            return {
                accepted: true,
                promise: Promise.resolve({ ok: false, skipped: true, reason: 'manager_disposed' })
            };
        }
        if (self._inMapWriteTask || typeof self.enqueueMapWrite !== 'function') {
            return {
                accepted: true,
                promise: Promise.resolve(executeSafely(meta))
            };
        }
        return self.enqueueMapWrite(function (taskMeta) {
            return executeSafely(taskMeta);
        }, {
            key: 'poi:' + key,
            replaceExisting: replaceExisting,
            guard: guard,
            meta: meta
        });
    };

    MarkerManager.prototype.canWriteToMap = function () {
        if (this._disposed) return false;
        if (typeof this.isWriteAllowed !== 'function') return true;
        try {
            return !!this.isWriteAllowed();
        } catch (_) {
            return false;
        }
    };

    MarkerManager.prototype.safeSetMap = function (overlay, targetMap) {
        if (!overlay || typeof overlay.setMap !== 'function') return false;
        if (targetMap && !this.canWriteToMap()) {
            try { overlay.setMap(null); } catch (__){ }
            return false;
        }
        try {
            overlay.setMap(targetMap || null);
            return true;
        } catch (_) {
            try { overlay.setMap(null); } catch (__){ }
            return false;
        }
    };

    MarkerManager.prototype.init = function () {
        this.map = this.mapCore.map;
        this.collectExistingTypes();
        this.buildTypeLabelMap();
        this.ensureMarkerStylesFromConfig();
        this.buildMarkerClassMap();
        MapUtils.injectMarkerStyles(this.mapTypeConfig);
        this.preparePointsIndex();
    };

    MarkerManager.prototype.collectExistingTypes = function () {
        var self = this;
        this.existingTypes.clear();
        if (this.mapData.points && Array.isArray(this.mapData.points)) {
            this.mapData.points.forEach(function (p) {
                if (p && p.type) {
                    self.existingTypes.add(p.type);
                }
            });
        }
    };

    MarkerManager.prototype.buildTypeLabelMap = function () {
        var self = this;
        (this.mapTypeConfig.groups || []).forEach(function (group) {
            (group.items || []).forEach(function (item) {
                self.typeLabelMap[item.id] = item.label;
            });
        });
    };

    MarkerManager.prototype.ensureMarkerStylesFromConfig = function () {
        var styles = {};
        (this.mapTypeConfig.groups || []).forEach(function (group) {
            (group.items || []).forEach(function (item) {
                if (!item || !item.id) return;
                styles[item.id] = {
                    color: item.color || '#888',
                    match: item.id
                };
            });
        });
        styles.center = { color: '#ff4500', isCenter: true, match: 'center' };
        styles.default = { color: '#888', match: 'default' };
        this.mapTypeConfig.markerStyles = styles;
    };

    MarkerManager.prototype.buildMarkerClassMap = function () {
        var self = this;
        Object.keys(this.mapTypeConfig.markerStyles || {}).forEach(function (key) {
            var cfg = self.mapTypeConfig.markerStyles[key] || {};
            var typeName = cfg.match || key;
            self.markerClassMap[typeName] = 'marker-' + typeName;
        });
    };

    MarkerManager.prototype.preparePointsIndex = function () {
        var self = this;
        this.pointsByType = {};
        this.pointStateMap = {};
        this.pointsByPid = {};
        var invalidCount = 0;
        var invalidSamples = [];

        if (this.centerPoint && normalizeLngLatPair(this.centerPoint)) {
            this.centerPoint._pid = 'center';
            this.centerPoint.disabled = false;
            this.pointsByPid[this.centerPoint._pid] = this.centerPoint;
        } else {
            if (this.centerPoint) {
                invalidCount += 1;
                if (invalidSamples.length < 5) {
                    invalidSamples.push(buildPointSample(this.centerPoint, -1));
                }
            }
            this.centerPoint = null;
        }

        (this.mapData.points || []).forEach(function (point, idx) {
            if (!point) return;
            var normalized = normalizeLngLatPair(point);
            if (!normalized) {
                invalidCount += 1;
                if (invalidSamples.length < 5) {
                    invalidSamples.push(buildPointSample(point, idx));
                }
                return;
            }
            point.lng = normalized[0];
            point.lat = normalized[1];
            if (!point.type) point.type = 'default';
            point._pid = point._pid || ('p-' + idx);
            point.disabled = !!point.disabled;
            self.pointsByPid[point._pid] = point;
            self.pointStateMap[point._pid] = { disabled: point.disabled, type: point.type };
            self.pointsByType[point.type] = self.pointsByType[point.type] || [];
            self.pointsByType[point.type].push(point);
        });
        if (invalidCount > 0) {
            console.warn('[marker-manager] skipped invalid coordinates in preparePointsIndex', {
                invalid_count: invalidCount,
                total_candidates: Array.isArray(this.mapData.points) ? this.mapData.points.length : 0,
                samples: invalidSamples
            });
        }
    };

    MarkerManager.prototype.isPointEnabled = function (point) {
        if (!point) return false;
        if (point.type === 'center') return true;
        var state = this.pointStateMap[point._pid];
        return !(point.disabled || (state && state.disabled));
    };

    MarkerManager.prototype.setPointDisabled = function (pid, disabled) {
        var point = this.pointsByPid[pid];
        if (!point) return;
        point.disabled = disabled;
        this.pointStateMap[pid] = { disabled: disabled, type: point.type };
    };

    MarkerManager.prototype.setTypeEnabled = function (typeId, enabled) {
        var self = this;
        var list = this.pointsByType[typeId] || [];
        list.forEach(function (pt) {
            self.setPointDisabled(pt._pid, !enabled);
        });
    };

    MarkerManager.prototype.getPointsByType = function () {
        return this.pointsByType;
    };

    MarkerManager.prototype.getExistingTypes = function () {
        return this.existingTypes;
    };

    MarkerManager.prototype.getTypeLabel = function (typeId) {
        return this.typeLabelMap[typeId] || typeId;
    };

    MarkerManager.prototype.renderMarkers = function () {
        var self = this;
        if (this._disposed) return;
        this.destroyClusterers({ immediate: true });
        this.markers.forEach(function (marker) {
            self.safeSetMap(marker, null);
            try { marker.setLabel(null); } catch (_) { }
        });
        this.markers = [];
        this.markersByType = {};
        this.markersByPid = {};

        if (this.centerPoint) {
            this.addMarker(this.centerPoint);
        }
        if (this.mapData.points && Array.isArray(this.mapData.points)) {
            this.mapData.points.forEach(function (point) {
                self.addMarker(point);
            });
        }
    };

    MarkerManager.prototype.addMarker = function (point) {
        var self = this;
        var normalized = normalizeLngLatPair(point);
        if (!normalized) {
            this._invalidAddMarkerCount += 1;
            if (this._invalidAddMarkerCount <= 5) {
                console.warn('[marker-manager] addMarker skipped invalid coordinate', {
                    count: this._invalidAddMarkerCount,
                    sample: buildPointSample(point, -1)
                });
            } else if (this._invalidAddMarkerCount === 6) {
                console.warn('[marker-manager] addMarker skipped invalid coordinate (further logs suppressed)');
            }
            return null;
        }
        point.lng = normalized[0];
        point.lat = normalized[1];
        var isCenter = point.type === 'center';
        var marker = markRawMapObject(new AMap.Marker({
            position: [normalized[0], normalized[1]],
            title: point.name,
            map: isCenter ? this.map : null,
            content: '<div class="marker-dot ' + MapUtils.getMarkerClass(point.type, this.markerClassMap) + '"></div>',
            offset: new AMap.Pixel(-8, -8)
        }));

        marker.__pid = point && point._pid ? String(point._pid) : '';
        marker.__data = buildMarkerDataSnapshot(point);
        this.markersByPid[point._pid] = marker;
        this.setMarkerLabel(marker);

        marker.on('click', function () {
            self.openMarkerInfoWindow(marker);
            if (typeof self.onMarkerClick === 'function') {
                self.onMarkerClick(point._pid);
            }
        });

        this.markers.push(marker);
        if (!isCenter) {
            this.markersByType[point.type] = this.markersByType[point.type] || [];
            this.markersByType[point.type].push(marker);
        }
    };

    MarkerManager.prototype.setMarkerLabel = function (marker) {
        var data = marker && marker.__data ? marker.__data : {};
        var title = data && data.name ? String(data.name) : '';
        if (this.labelsVisible) {
            marker.setLabel({
                content: '<div class="marker-label">' + title + '</div>',
                offset: new AMap.Pixel(0, -30)
            });
        } else {
            marker.setLabel(null);
        }
    };

    MarkerManager.prototype.resolveMarkerPoint = function (marker) {
        if (!marker) return null;
        var pid = marker.__pid ? String(marker.__pid) : '';
        if (pid && this.pointsByPid && this.pointsByPid[pid]) {
            return this.pointsByPid[pid];
        }
        return marker.__data || null;
    };

    MarkerManager.prototype.setLabelsVisible = function (visible) {
        this.labelsVisible = visible;
        var self = this;
        this.markers.forEach(function (marker) {
            if (marker.getMap()) {
                self.setMarkerLabel(marker);
            } else {
                marker.setLabel(null);
            }
        });
    };

    MarkerManager.prototype.toggleLabels = function () {
        this.setLabelsVisible(!this.labelsVisible);
        return this.labelsVisible;
    };

    MarkerManager.prototype.openMarkerInfoWindow = function (marker) {
        var point = this.resolveMarkerPoint(marker) || marker.__data || {};
        var typeLabel = this.getTypeLabel(point.type);
        if (point.type === 'center') {
            typeLabel = '中心点';
        }
        var typeId = point.type || '';
        var typeLabelText = typeLabel || '';
        var nameText = point.name || '';
        var isTraffic = false;
        if (typeof typeId === 'string') {
            if (typeId.startsWith('15') || typeId.startsWith('type-15')) {
                isTraffic = true;
            }
        }
        if (!isTraffic && /交通|公交|地铁|车站|站|机场|港口|码头|出租|轻轨|轮渡|停车/.test(typeLabelText)) {
            isTraffic = true;
        }

        var isParking = false;
        if (typeof typeId === 'string' && (typeId === '150900' || typeId === 'type-150900' || typeId.indexOf('1509') !== -1)) {
            isParking = true;
        }
        if (!isParking && /停车/.test(typeLabelText + nameText)) {
            isParking = true;
        }

        var addressText = point.address || '';
        var lines = Array.isArray(point.lines) ? point.lines.slice() : [];
        if (isTraffic && !isParking && addressText) {
            if (!lines.length) {
                lines = [addressText];
            } else if (lines.indexOf(addressText) === -1) {
                lines.push(addressText);
            }
        }
        var showAddress = !isTraffic || isParking;
        var showLines = isTraffic && !isParking;
        var coordLng = typeof point.lng === 'number' ? point.lng : marker.getPosition().getLng();
        var coordLat = typeof point.lat === 'number' ? point.lat : marker.getPosition().getLat();
        var coordText = coordLng.toFixed(6) + ', ' + coordLat.toFixed(6);

        // Calculate distance if missing and center exists
        var distanceStr = point.distance;
        if ((!distanceStr || distanceStr === '—') && this.centerPoint && point.type !== 'center') {
            var centerPair = normalizeLngLatPair(this.centerPoint);
            if (centerPair) {
                var p1 = new AMap.LngLat(centerPair[0], centerPair[1]);
                var p2 = new AMap.LngLat(coordLng, coordLat);
                var dist = Math.round(p1.distance(p2));
                distanceStr = dist;
            }
        }

        var infoContainer = document.createElement('div');
        infoContainer.style.padding = '10px';
        infoContainer.style.fontSize = '13px';
        infoContainer.style.minWidth = '200px';

        // 1. Name
        var nameEl = document.createElement('div');
        nameEl.style.fontWeight = 'bold';
        nameEl.style.fontSize = '14px';
        nameEl.style.marginBottom = '6px';
        nameEl.style.borderBottom = '1px solid #eee';
        nameEl.style.paddingBottom = '4px';
        nameEl.textContent = point.name;
        infoContainer.appendChild(nameEl);

        // 2. Type
        var typeEl = document.createElement('div');
        typeEl.style.marginBottom = '4px';
        typeEl.innerHTML = '<span style="color:#888;">类型：</span>' + typeLabel;
        infoContainer.appendChild(typeEl);

        // 3. Address
        // 地址/途经线路统一放在最后

        // 4. Coordinates
        var coordEl = document.createElement('div');
        coordEl.style.marginBottom = '4px';
        coordEl.innerHTML = '<span style="color:#888;">坐标：</span>' + coordText;
        infoContainer.appendChild(coordEl);

        // 5. Distance (for non-center)
        if (point.type !== 'center') {
            var distEl = document.createElement('div');
            distEl.style.marginBottom = '4px';
            var distVal = (distanceStr && distanceStr !== '—') ? distanceStr + ' 米' : '—';
            distEl.innerHTML = '<span style="color:#888;">距离中心：</span>' + distVal;
            infoContainer.appendChild(distEl);
        }

        // Lines (Traffic)
        if (showAddress && addressText) {
            var addressEl = document.createElement('div');
            addressEl.style.marginBottom = '4px';
            addressEl.style.color = '#666';
            addressEl.innerHTML = '<span style="color:#666;">地址：</span>' + addressText;
            infoContainer.appendChild(addressEl);
        }

        if (showLines && lines && lines.length > 0) {
            var linesEl = document.createElement('div');
            linesEl.style.marginBottom = '4px';
            linesEl.style.color = '#666';
            linesEl.innerHTML = '<span style="color:#666;">途经线路：</span>' + lines.join('，');
            infoContainer.appendChild(linesEl);
        } else {
            // DEBUG: Temporary check why lines are missing
            // var debugEl = document.createElement('div');
            // debugEl.style.color = 'red';
            // debugEl.textContent = 'Db: L=' + (point.lines ? point.lines.length : 'N') + ' A=' + (point.address || 'N');
            // infoContainer.appendChild(debugEl);
        }


        var infoWindow = new AMap.InfoWindow({
            content: infoContainer,
            offset: new AMap.Pixel(0, -30)
        });
        infoWindow.open(this.map, marker.getPosition());
    };

    MarkerManager.prototype.focusMarkerOnMap = function (pid, openInfo) {
        var marker = this.markersByPid[pid];
        if (!marker) return;
        if (!marker.getMap()) {
            this.safeSetMap(marker, this.map);
        }
        this.map.setCenter(marker.getPosition());
        if (this.map.getZoom && this.map.getZoom() < 15) {
            this.map.setZoom(15);
        }
        if (openInfo) {
            this.openMarkerInfoWindow(marker);
        }
    };

    MarkerManager.prototype._destroyClusterersNow = function () {
        Object.keys(this.typeClusterers).forEach(function (key) {
            var clusterer = this.typeClusterers[key];
            if (!clusterer) return;
            try {
                if (typeof clusterer.setMap === 'function') {
                    clusterer.setMap(null);
                }
            } catch (_) { }
            try {
                if (typeof clusterer.setMarkers === 'function') {
                    clusterer.setMarkers([]);
                } else if (typeof clusterer.clearMarkers === 'function') {
                    clusterer.clearMarkers();
                }
            } catch (_) { }
        }, this);
        this.typeClusterers = {};
    };

    MarkerManager.prototype.destroyClusterers = function (options) {
        var opts = options && typeof options === 'object' ? options : {};
        if (this._disposed || opts.immediate || this._inMapWriteTask || typeof this.enqueueMapWrite !== 'function') {
            this._destroyClusterersNow();
            return;
        }
        this.runMapWrite(function () {
            this._destroyClusterersNow();
            return { ok: true };
        }.bind(this), {
            key: 'destroy_clusterers',
            replaceExisting: true,
            meta: { reason: 'destroy_clusterers' }
        });
    };

    MarkerManager.prototype.createClusterRenderer = function (type) {
        var color = MapUtils.getTypeColor(type, this.mapTypeConfig);
        return function (context) {
            var marker = context && context.marker ? context.marker : null;
            if (!marker || typeof marker.setContent !== 'function') return;
            var rawCount = Number(context && context.count);
            var count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
            var size = Math.max(32, Math.min(50, 18 + count));
            var div = document.createElement('div');
            div.style.width = size + 'px';
            div.style.height = size + 'px';
            div.style.background = color;
            div.style.borderRadius = '50%';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.color = '#fff';
            div.style.fontSize = '13px';
            div.style.fontWeight = 'bold';
            div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
            div.style.border = '2px solid #fff';
            div.textContent = String(Math.round(count));
            marker.setContent(div);
            if (typeof marker.setOffset === 'function' && Number.isFinite(size)) {
                marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
            }
        };
    };

    MarkerManager.prototype.getClusterRenderer = function (type) {
        if (!this.clusterRenderers[type]) {
            this.clusterRenderers[type] = this.createClusterRenderer(type);
        }
        return this.clusterRenderers[type];
    };

    MarkerManager.prototype.setActiveTypes = function (activeTypes) {
        this.activeTypes = new Set(activeTypes);
    };

    MarkerManager.prototype.setShowMarkers = function (show) {
        this.showMarkers = !!show;
    };

    MarkerManager.prototype.setHideAllPoints = function (hide) {
        this.hideAllPoints = !!hide;
    };

    MarkerManager.prototype.setSpatialFilter = function (filterFn) {
        this.spatialFilter = typeof filterFn === 'function' ? filterFn : null;
    };

    MarkerManager.prototype.getVisiblePointsData = function (count) {
        var heatCount = typeof count === 'number' ? count : 10;
        return (this.lastFilteredPoints || []).map(function (pt) {
            return { lng: pt.lng, lat: pt.lat, count: heatCount };
        });
    };

    MarkerManager.prototype.getVisiblePoints = function () {
        return (this.lastFilteredPoints || []).slice();
    };

    MarkerManager.prototype.sanitizeClusterMarkers = function (list, typeKey) {
        var self = this;
        var out = [];
        var dropped = 0;
        var samples = [];
        (Array.isArray(list) ? list : []).forEach(function (marker, idx) {
            if (!marker || typeof marker.getPosition !== 'function') {
                dropped += 1;
                if (samples.length < 3) {
                    samples.push({ reason: 'marker-invalid', idx: idx });
                }
                return;
            }
            var pos = null;
            try {
                pos = marker.getPosition();
            } catch (_) {
                pos = null;
            }
            var lng = pos && typeof pos.getLng === 'function' ? Number(pos.getLng()) : NaN;
            var lat = pos && typeof pos.getLat === 'function' ? Number(pos.getLat()) : NaN;
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                dropped += 1;
                if (samples.length < 3) {
                    samples.push({ reason: 'position-invalid', idx: idx });
                }
                self.safeSetMap(marker, null);
                return;
            }
            if (typeof marker.getTitle === 'function' && typeof marker.setTitle === 'function') {
                var title = null;
                try { title = marker.getTitle(); } catch (_) { title = null; }
                if (title === null || typeof title === 'undefined') {
                    try { marker.setTitle(''); } catch (_) { }
                }
            }
            if (typeof marker.getContent === 'function' && typeof marker.setContent === 'function') {
                var content = null;
                try { content = marker.getContent(); } catch (_) { content = null; }
                if (content === null || typeof content === 'undefined') {
                    try { marker.setContent('<div class="marker-dot marker-default"></div>'); } catch (_) { }
                }
            }
            out.push(marker);
        });
        if (dropped > 0) {
            console.warn('[marker-manager] sanitizeClusterMarkers dropped invalid markers', {
                type: String(typeKey || ''),
                dropped: dropped,
                input: Array.isArray(list) ? list.length : 0,
                output: out.length,
                samples: samples
            });
        }
        return out;
    };

    MarkerManager.prototype.logCoordinateHealth = function (reason, options) {
        var self = this;
        var opts = options && typeof options === 'object' ? options : {};
        var force = !!opts.force;
        var sampleLimit = Math.max(1, Number(opts.sampleLimit) || 5);
        var throttleMs = Math.max(0, Number(opts.throttleMs) || 1200);
        var now = Date.now();
        if (!force && (now - this._coordHealthLastLogAt) < throttleMs) {
            return null;
        }
        this._coordHealthLastLogAt = now;

        var total = 0;
        var invalidPositionCount = 0;
        var invalidDataCount = 0;
        var samples = [];
        (this.markers || []).forEach(function (marker, idx) {
            if (!marker) return;
            total += 1;
            var point = self.resolveMarkerPoint(marker) || marker.__data || null;
            var dataPair = normalizeLngLatPair(point);
            if (!dataPair) {
                invalidDataCount += 1;
                if (samples.length < sampleLimit) {
                    samples.push({
                        issue: 'marker_data_invalid',
                        marker_idx: idx,
                        sample: buildPointSample(point, idx)
                    });
                }
            }

            var pos = null;
            try {
                pos = (typeof marker.getPosition === 'function') ? marker.getPosition() : null;
            } catch (_) {
                pos = null;
            }
            var posPair = normalizeLngLatPair(pos);
            if (!posPair) {
                invalidPositionCount += 1;
                if (samples.length < sampleLimit) {
                    samples.push({
                        issue: 'marker_position_invalid',
                        marker_idx: idx,
                        has_map: !!(marker && typeof marker.getMap === 'function' && marker.getMap()),
                        sample: buildPointSample(point, idx)
                    });
                }
            }
        });

        if (force || invalidPositionCount > 0 || invalidDataCount > 0) {
            var level = (invalidPositionCount > 0 || invalidDataCount > 0) ? 'warn' : 'info';
            console[level]('[marker-manager] coordinate health', {
                reason: String(reason || ''),
                total_markers: total,
                invalid_marker_position: invalidPositionCount,
                invalid_marker_data: invalidDataCount,
                samples: samples
            });
        }
        return {
            totalMarkers: total,
            invalidMarkerPosition: invalidPositionCount,
            invalidMarkerData: invalidDataCount
        };
    };

    MarkerManager.prototype.applyFilters = function () {
        if (!this.canWriteToMap()) {
            return {
                accepted: true,
                promise: Promise.resolve({
                    ok: false,
                    skipped: true,
                    reason: 'manager_disposed'
                })
            };
        }
        var self = this;
        var resolvedHandle = function (payload) {
            var result = (payload && typeof payload === 'object')
                ? Object.assign({}, payload)
                : { ok: payload !== false, value: payload };
            return {
                accepted: true,
                promise: Promise.resolve(result)
            };
        };
        var needCluster = this.showMarkers;
        if (needCluster && !this.mapCore.clusterPluginReady) {
            var loadThenApplyPromise = this.mapCore.loadPlugins().then(function () {
                if (!self.canWriteToMap()) {
                    return {
                        ok: false,
                        skipped: true,
                        reason: 'manager_disposed'
                    };
                }
                var nestedHandle = self.applyFilters();
                if (nestedHandle && nestedHandle.promise && typeof nestedHandle.promise.then === 'function') {
                    return nestedHandle.promise;
                }
                return { ok: true, reason: 'cluster_plugin_ready_sync' };
            }).catch(function (err) {
                return {
                    ok: false,
                    skipped: true,
                    reason: 'cluster_plugin_load_failed',
                    error: err && err.message ? err.message : String(err)
                };
            });
            return {
                accepted: true,
                promise: Promise.resolve(loadThenApplyPromise).then(function (result) {
                    return result && typeof result === 'object'
                        ? result
                        : { ok: result !== false, value: result };
                })
            };
        }
        var applyToken = Number(this._mapWriteToken || 0) + 1;
        this._mapWriteToken = applyToken;
        var guardLatest = function () {
            return self.canWriteToMap() && applyToken === self._mapWriteToken;
        };
        var applyNow = function () {
            if (!guardLatest()) {
                return { ok: false, skipped: true, reason: 'stale_apply_filters' };
            }
            this._destroyClusterersNow();
            this.lastVisibleMarkerPids.clear();
            this.lastFilteredPoints = [];
            this.markersByType = {};
            var aborted = false;
            var markerList = Array.isArray(this.markers) ? this.markers : [];
            for (var mi = 0; mi < markerList.length; mi += 1) {
                if (!guardLatest()) {
                    aborted = true;
                    break;
                }
                var marker = markerList[mi];
                var point = self.resolveMarkerPoint(marker);
                if (!point) continue;
                var pos = (marker && typeof marker.getPosition === 'function') ? marker.getPosition() : null;
                var posLng = pos && typeof pos.getLng === 'function' ? Number(pos.getLng()) : NaN;
                var posLat = pos && typeof pos.getLat === 'function' ? Number(pos.getLat()) : NaN;
                if (!Number.isFinite(posLng) || !Number.isFinite(posLat)) {
                    if (!self._invalidRuntimePositionWarned) {
                        console.warn('[marker-manager] runtime marker position invalid; marker will be hidden', {
                            sample: buildPointSample(point, -1)
                        });
                        self._invalidRuntimePositionWarned = true;
                    }
                    self.safeSetMap(marker, null);
                    try { marker.setLabel(null); } catch (_) { }
                    continue;
                }

                var isActiveType = point.type === 'center' || self.activeTypes.has(point.type);
                var isEnabled = self.isPointEnabled(point);
                var withinRadius = true;
                if (self.mapCore.mapMode === 'around' && self.mapCore.currentRadius && point.type !== 'center') {
                    withinRadius = MapUtils.isWithinRadius(point, self.mapCore.center, self.mapCore.currentRadius);
                }
                var withinPolygon = true;
                if (self.spatialFilter) {
                    withinPolygon = self.spatialFilter(point);
                }
                var isVisible = isActiveType && isEnabled && withinRadius && withinPolygon;

                if (isVisible) {
                    self.lastVisibleMarkerPids.add(point._pid);
                    if (point.type !== 'center') {
                        self.lastFilteredPoints.push(point);
                    }
                }

                if (point.type === 'center') {
                    if (!self.hideAllPoints && isVisible && !marker.getMap()) {
                        self.safeSetMap(marker, self.map);
                        self.setMarkerLabel(marker);
                    } else if ((self.hideAllPoints || !isVisible) && marker.getMap()) {
                        self.safeSetMap(marker, null);
                        try { marker.setLabel(null); } catch (_) { }
                    }
                    continue;
                }

                if (!isVisible || !self.showMarkers || self.hideAllPoints) {
                    if (marker.getMap()) {
                        self.safeSetMap(marker, null);
                    }
                    try { marker.setLabel(null); } catch (_) { }
                } else {
                    var list = self.markersByType[point.type] || [];
                    list.push(marker);
                    self.markersByType[point.type] = list;
                }
            }
            if (aborted || !guardLatest()) {
                this._destroyClusterersNow();
                this.lastVisibleMarkerPids.clear();
                this.lastFilteredPoints = [];
                this.markersByType = {};
                this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
                return { ok: false, skipped: true, reason: 'stale_apply_filters_midflight' };
            }

            if (!this.showMarkers) {
                this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
                return { ok: true, reason: 'markers_hidden' };
            }

            var clusterMaxZoom = 17;
            if (this.map.getMaxZoom) {
                clusterMaxZoom = Math.max(3, this.map.getMaxZoom() - 1);
            }

            if (this.clustererDegraded) {
                Object.keys(self.markersByType).forEach(function (typeKey) {
                    if (aborted || !guardLatest()) {
                        aborted = true;
                        return;
                    }
                    var list = self.sanitizeClusterMarkers(self.markersByType[typeKey], typeKey);
                    list.forEach(function (marker) {
                        if (!marker) return;
                        if (!marker.getMap()) {
                            self.safeSetMap(marker, self.map);
                        }
                        self.setMarkerLabel(marker);
                    });
                });
                this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
                return { ok: true, reason: 'cluster_degraded' };
            }

            Object.keys(self.markersByType).forEach(function (typeKey) {
                if (aborted || !guardLatest()) {
                    aborted = true;
                    return;
                }
                var list = self.sanitizeClusterMarkers(self.markersByType[typeKey], typeKey);
                var clusterer = self.typeClusterers[typeKey];
                if (!list.length) return;

                try {
                    if (!guardLatest()) {
                        aborted = true;
                        return;
                    }
                    if (clusterer) {
                        clusterer.setMarkers(list);
                    } else {
                        self.typeClusterers[typeKey] = markRawMapObject(new AMap.MarkerClusterer(self.map, list, {
                            gridSize: 80,
                            maxZoom: clusterMaxZoom,
                            minClusterSize: 2,
                            renderClusterMarker: self.getClusterRenderer(typeKey)
                        }));
                    }
                } catch (err) {
                    self._clustererErrorCount += 1;
                    self.clustererDegraded = true;
                    self.clustererDegradeReason = err && err.message ? err.message : String(err);
                    console.error('[marker-manager] clusterer failed, fallback to non-cluster mode', {
                        type: typeKey,
                        error_count: self._clustererErrorCount,
                        reason: self.clustererDegradeReason
                    });
                    list.forEach(function (marker) {
                        if (!marker) return;
                        self.safeSetMap(marker, self.map);
                        self.setMarkerLabel(marker);
                    });
                }
            });
            if (aborted || !guardLatest()) {
                this._destroyClusterersNow();
                this.lastVisibleMarkerPids.clear();
                this.lastFilteredPoints = [];
                this.markersByType = {};
                this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
                return { ok: false, skipped: true, reason: 'stale_apply_filters_midflight' };
            }
            if (this.clustererDegraded) {
                this._destroyClusterersNow();
            }

            Object.keys(this.typeClusterers).forEach(function (typeKey) {
                if (aborted || !guardLatest()) {
                    aborted = true;
                    return;
                }
                if (!self.markersByType[typeKey] || self.markersByType[typeKey].length === 0) {
                    var c = self.typeClusterers[typeKey];
                    if (c) {
                        try {
                            if (typeof c.setMap === 'function') c.setMap(null);
                        } catch (_) { }
                        try {
                            if (typeof c.setMarkers === 'function') {
                                c.setMarkers([]);
                            } else if (typeof c.clearMarkers === 'function') {
                                c.clearMarkers();
                            }
                        } catch (_) { }
                        delete self.typeClusterers[typeKey];
                    }
                }
            });
            if (aborted || !guardLatest()) {
                this._destroyClusterersNow();
                this.lastVisibleMarkerPids.clear();
                this.lastFilteredPoints = [];
                this.markersByType = {};
                this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
                return { ok: false, skipped: true, reason: 'stale_apply_filters_midflight' };
            }

            this.mapCore.updateCityCirclesVisibility(this.lastVisibleMarkerPids);
            return { ok: true };
        };

        var handle = this.runMapWrite(function () {
            return applyNow.call(this);
        }.bind(this), {
            key: 'apply_filters',
            replaceExisting: true,
            guard: guardLatest,
            meta: {
                reason: 'apply_filters',
                marker_count: Array.isArray(this.markers) ? this.markers.length : 0
            }
        });
        if (handle && handle.promise && typeof handle.promise.then === 'function') {
            return handle;
        }
        return resolvedHandle({ ok: true, reason: 'apply_filters_sync_fallback' });
    };

    MarkerManager.prototype.getVisibleMarkers = function () {
        return this.markers.filter(function (marker) {
            return marker && marker.getMap();
        });
    };

    MarkerManager.prototype.computeTypeCounts = function () {
        var counts = {};
        Object.keys(this.pointsByType || {}).forEach(function (typeKey) {
            if (typeKey === 'center') return;
            counts[typeKey] = (this.pointsByType[typeKey] || []).length;
        }, this);
        return counts;
    };

    MarkerManager.prototype.getTypeCounts = function () {
        return this.computeTypeCounts();
    };

    MarkerManager.prototype.setMarkerClickHandler = function (handler) {
        this.onMarkerClick = handler;
    };

    window.MarkerManager = MarkerManager;
})(window, window.MapUtils);
