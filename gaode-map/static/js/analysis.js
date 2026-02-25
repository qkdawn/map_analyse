(function (window) {
    function AnalysisManager(mapCore) {
        this.mapCore = mapCore;
        this.map = mapCore.map;
        this.selectedCenter = null;
        this.marker = null;

        this.isochroneMode = 'walking';
        this.isochroneTime = 15; // minutes
        this.isWaiting = false;

        this.bindEvents();
    }

    AnalysisManager.prototype.bindEvents = function () {
        var self = this;

        // Map Click Event -> Select Point
        this.map.on('click', function (e) {
            self.handleMapClick(e.lnglat);
        });

        // UI Controls
        var modeSelect = document.getElementById('transportMode');
        if (modeSelect) {
            modeSelect.addEventListener('change', function (e) {
                self.isochroneMode = e.target.value;
            });
        }

        var timeInput = document.getElementById('timeHorizon');
        if (timeInput) {
            timeInput.addEventListener('change', function (e) {
                self.isochroneTime = parseInt(e.target.value) || 15;
            });
        }

        // Start Button
        var btnStart = document.getElementById('btnStartAnalysis');
        if (btnStart) {
            btnStart.addEventListener('click', function () {
                self.handleAnalysisClick();
            });
        }
    };

    AnalysisManager.prototype.handleMapClick = function (lnglat) {
        // Update Internal State
        this.selectedCenter = lnglat;

        // Visual Feedback: Remove old marker, add new marker
        if (this.marker) {
            this.map.remove(this.marker);
        }

        this.marker = new AMap.Marker({
            position: lnglat,
            anchor: 'bottom-center',
        });
        this.map.add(this.marker);

        // Update UI
        var coordsText = lnglat.lng.toFixed(4) + ", " + lnglat.lat.toFixed(4);
        var infoBox = document.getElementById('selectedPointInfo');
        var coordsSpan = document.getElementById('pointCoords');
        var hintBox = document.getElementById('pointHint');
        var btnStart = document.getElementById('btnStartAnalysis');

        if (infoBox) infoBox.style.display = 'block';
        if (coordsSpan) coordsSpan.textContent = coordsText;
        if (hintBox) hintBox.style.display = 'none';

        // Enable Start Button
        if (btnStart) btnStart.disabled = false;

        // Clear previous results? (Optional, maybe keep them for comparison until new one is generated)
        // this.mapCore.clearCustomPolygons(); 
    };

    AnalysisManager.prototype.handleAnalysisClick = function () {
        if (!this.selectedCenter) {
            alert("请先在地图上选择一个起点");
            return;
        }
        if (this.isWaiting) return;

        this.isWaiting = true;
        this.showLoading(true);

        var self = this;
        var btnStart = document.getElementById('btnStartAnalysis');
        if (btnStart) btnStart.disabled = true;

        // Prepare Request
        var payload = {
            lat: this.selectedCenter.lat,
            lon: this.selectedCenter.lng,
            time_min: this.isochroneTime,
            mode: this.isochroneMode,
            coord_type: 'gcj02'
        };

        fetch('/api/v1/analysis/isochrone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(response => {
                if (!response.ok) throw new Error("API Request Failed");
                return response.json();
            })
            .then(geojson => {
                self.renderResult(geojson);
                // Re-enable button
                if (btnStart) btnStart.disabled = false;
            })
            .catch(err => {
                console.error(err);
                alert("计算失败: " + err.message);
                if (btnStart) btnStart.disabled = false;
            })
            .finally(() => {
                self.isWaiting = false;
                self.showLoading(false);
            });
    };

    AnalysisManager.prototype.renderResult = function (geojson) {
        if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) {
            alert("未获取到有效的等时圈数据");
            return;
        }

        var coords = geojson.geometry.coordinates;
        var type = geojson.geometry.type;
        var paths = [];

        if (type === 'Polygon') {
            paths.push(coords[0]);
        } else if (type === 'MultiPolygon') {
            coords.forEach(poly => {
                paths.push(poly[0]);
            });
        }

        // Draw using MapCore
        this.mapCore.setCustomPolygons(paths);

        // Auto fit view to show the result
        // this.mapCore.updateFitView(); // Optional: might not want to zoom out too much
    };

    AnalysisManager.prototype.showLoading = function (show) {
        var el = document.getElementById('analysisStatus');
        if (el) {
            el.textContent = show ? '正在计算等时圈...' : '计算完成';
            el.style.color = show ? 'blue' : 'green';
        }
    }

    window.AnalysisManager = AnalysisManager;
})(window);
