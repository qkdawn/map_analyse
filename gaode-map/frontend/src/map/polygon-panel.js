(function(window) {
    function byId(id) {
        return document.getElementById(id);
    }

    var currentPolygons = [];
    var activeFilterId = null;
    var geometryReady = false;
    var geometryPromise = null;

    function setStatus(message, isError) {
        var statusEl = byId('polygonStatus');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'polygon-status' + (isError ? ' error' : '');
    }

    function parseCoordinates(input) {
        if (!input) {
            throw new Error('请输入多边形坐标');
        }
        var parsed = JSON.parse(input);
        if (!Array.isArray(parsed) || parsed.length < 3) {
            throw new Error('多边形至少需要 3 个坐标点');
        }
        var normalized = parsed.map(function(item) {
            if (!Array.isArray(item) || item.length !== 2) {
                throw new Error('坐标点必须为 [lng, lat] 数组');
            }
            var lng = Number(item[0]);
            var lat = Number(item[1]);
            if (!isFinite(lng) || !isFinite(lat)) {
                throw new Error('坐标点必须是数字');
            }
            if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
                throw new Error('坐标点超出范围');
            }
            return [lng, lat];
        });
        return normalized;
    }

    function ensureGeometryUtil() {
        if (geometryReady) return Promise.resolve(true);
        if (geometryPromise) return geometryPromise;
        geometryPromise = new Promise(function(resolve) {
            if (!window.AMap || typeof AMap.plugin !== 'function') {
                resolve(false);
                return;
            }
            AMap.plugin(['AMap.GeometryUtil'], function() {
                geometryReady = !!(AMap.GeometryUtil && typeof AMap.GeometryUtil.isPointInRing === 'function');
                resolve(geometryReady);
            });
        });
        return geometryPromise;
    }

    function isPointInPolygon(point, polygon) {
        if (!geometryReady || !AMap.GeometryUtil) return false;
        if (!point || !polygon || polygon.length < 3) return false;
        var lng = Number(point.lng);
        var lat = Number(point.lat);
        if (!isFinite(lng) || !isFinite(lat)) return false;
        return AMap.GeometryUtil.isPointInRing([lng, lat], polygon);
    }

    function getActivePolygon() {
        if (!activeFilterId) return null;
        return (currentPolygons || []).find(function(item) { return item.id === activeFilterId; }) || null;
    }

    function runFilters() {
        if (window.filterPanel && typeof window.filterPanel.applyFilters === 'function') {
            window.filterPanel.applyFilters();
            return;
        }
        window.markerManager.applyFilters();
        if (window.mapCore && typeof window.mapCore.updateFitView === 'function' &&
            typeof window.markerManager.getVisibleMarkers === 'function') {
            window.mapCore.updateFitView(window.markerManager.getVisibleMarkers());
        }
    }

    function applyPolygonFilter() {
        if (!window.markerManager || typeof window.markerManager.setSpatialFilter !== 'function') {
            return;
        }
        var activePolygon = getActivePolygon();
        if (!activePolygon) {
            activeFilterId = null;
            window.markerManager.setSpatialFilter(null);
            runFilters();
            return;
        }
        if (!geometryReady) {
            ensureGeometryUtil().then(function(ready) {
                if (!ready) {
                    setStatus('AMap.GeometryUtil 未加载，无法过滤', true);
                    return;
                }
                applyPolygonFilter();
            });
            return;
        }
        window.markerManager.setSpatialFilter(function(point) {
            return isPointInPolygon(point, activePolygon.coordinates || []);
        });
        runFilters();
    }

    function togglePolygonFilter(polygonId) {
        if (!polygonId) return;
        ensureGeometryUtil().then(function(ready) {
            if (!ready) {
                setStatus('AMap.GeometryUtil 未加载，无法过滤', true);
                return;
            }
            activeFilterId = (activeFilterId === polygonId) ? null : polygonId;
            renderPolygonList(currentPolygons);
            applyPolygonFilter();
        });
    }

    function renderPolygonList(polygons) {
        var listEl = byId('polygonList');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!polygons || !polygons.length) {
            var empty = document.createElement('div');
            empty.className = 'polygon-empty';
            empty.textContent = '暂无记录';
            listEl.appendChild(empty);
            return;
        }
        polygons.forEach(function(item) {
            var row = document.createElement('div');
            row.className = 'polygon-item';
            if (activeFilterId === item.id) {
                row.classList.add('active-filter');
            }

            var label = document.createElement('div');
            label.className = 'polygon-label';
            label.textContent = '多边形 #' + item.id + '（' + item.coordinates.length + ' 点）';
            row.appendChild(label);

            var actions = document.createElement('div');
            actions.className = 'polygon-actions';

            var filterBtn = document.createElement('button');
            filterBtn.className = 'polygon-filter';
            filterBtn.textContent = activeFilterId === item.id ? '取消过滤' : '过滤';
            if (activeFilterId === item.id) {
                filterBtn.classList.add('active');
            }
            filterBtn.addEventListener('click', function() {
                togglePolygonFilter(item.id);
            });
            actions.appendChild(filterBtn);

            var delBtn = document.createElement('button');
            delBtn.className = 'polygon-delete';
            delBtn.textContent = '删除';
            delBtn.addEventListener('click', function() {
                deletePolygon(item.id);
            });
            actions.appendChild(delBtn);
            row.appendChild(actions);

            listEl.appendChild(row);
        });
    }

    function applyPolygons(polygons) {
        if (!window.mapCore || typeof window.mapCore.setCustomPolygons !== 'function') {
            return;
        }
        var paths = (polygons || []).map(function(item) { return item.coordinates; });
        window.mapCore.setCustomPolygons(paths);
    }

    async function loadPolygons() {
        if (typeof window.mapId === 'undefined' || window.mapId === null) {
            return [];
        }
        var res = await fetch('/api/v1/maps/' + window.mapId + '/polygons');
        if (!res.ok) {
            throw new Error('获取多边形失败 ' + res.status);
        }
        var data = await res.json();
        return data.polygons || [];
    }

    async function refreshPolygons() {
        try {
            var polygons = await loadPolygons();
            currentPolygons = polygons || [];
            if (activeFilterId && !getActivePolygon()) {
                activeFilterId = null;
            }
            renderPolygonList(currentPolygons);
            applyPolygons(currentPolygons);
            applyPolygonFilter();
            setStatus('', false);
        } catch (err) {
            setStatus(err.message, true);
        }
    }

    async function savePolygon() {
        var inputEl = byId('polygonInput');
        if (!inputEl) return;
        var coords = parseCoordinates(inputEl.value.trim());
        var res = await fetch('/api/v1/maps/' + window.mapId + '/polygons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: coords })
        });
        if (!res.ok) {
            throw new Error('保存多边形失败 ' + res.status);
        }
        inputEl.value = '';
        await refreshPolygons();
    }

    async function deletePolygon(polygonId) {
        if (!polygonId) return;
        var res = await fetch('/api/v1/maps/' + window.mapId + '/polygons/' + polygonId, {
            method: 'DELETE'
        });
        if (!res.ok) {
            throw new Error('删除多边形失败 ' + res.status);
        }
        await refreshPolygons();
    }

    function initPolygonPanel() {
        var panel = byId('polygonPanel');
        var inputEl = byId('polygonInput');
        var saveBtn = byId('btnSavePolygon');

        if (!panel || !inputEl || !saveBtn) return;

        if (typeof window.mapId === 'undefined' || window.mapId === null) {
            inputEl.disabled = true;
            saveBtn.disabled = true;
            setStatus('缺少 mapId，无法保存多边形', true);
            return;
        }

        saveBtn.addEventListener('click', async function() {
            saveBtn.disabled = true;
            try {
                await savePolygon();
            } catch (err) {
                setStatus(err.message, true);
            } finally {
                saveBtn.disabled = false;
            }
        });

        ensureGeometryUtil().then(function(ready) {
            if (!ready) {
                setStatus('AMap.GeometryUtil 未加载，无法过滤', true);
            }
            refreshPolygons();
        });
    }

    window.addEventListener('DOMContentLoaded', initPolygonPanel);
})(window);
