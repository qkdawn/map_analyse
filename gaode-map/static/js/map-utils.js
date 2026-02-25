(function (window) {
    function haversineDistance(lat1, lng1, lat2, lng2) {
        var toRad = function (deg) { return deg * Math.PI / 180; };
        var dLat = toRad(lat2 - lat1);
        var dLng = toRad(lng2 - lng1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371000 * c;
    }

    function getDistanceToCenter(point, centerPoint) {
        if (!centerPoint) return 0;
        if (typeof point.distance === 'number') {
            return point.distance;
        }
        if (typeof point._cachedDistance === 'number') {
            return point._cachedDistance;
        }
        var distance = haversineDistance(centerPoint.lat, centerPoint.lng, point.lat, point.lng);
        point._cachedDistance = distance;
        return distance;
    }

    function isWithinRadius(point, centerPoint, radius) {
        if (!radius) return true;
        if (point.type === 'center') return true;
        return getDistanceToCenter(point, centerPoint) <= radius;
    }

    function formatPointMeta(point) {
        var parts = [];
        if (point.distance) {
            parts.push(point.distance + ' 米');
        }
        if (point.lines && point.lines.length) {
            parts.push(point.lines.join(' / '));
        }
        return parts.join(' · ') || '—';
    }

    function getMarkerClass(type, markerClassMap) {
        return (markerClassMap && markerClassMap[type]) || 'marker-default';
    }

    function getTypeColor(type, mapTypeConfig) {
        var styles = (mapTypeConfig && mapTypeConfig.markerStyles) || {};
        if (styles[type] && styles[type].color) {
            return styles[type].color;
        }
        return '#888';
    }

    function injectMarkerStyles(mapTypeConfig) {
        var styleParts = [];
        styleParts.push('.marker-default { background: #888; }');

        Object.keys(mapTypeConfig.markerStyles || {}).forEach(function (key) {
            var cfg = mapTypeConfig.markerStyles[key] || {};
            var typeName = cfg.match || key;
            var className = '.marker-' + typeName;
            var sizeStyles = '';

            if (cfg.isCenter) {
                sizeStyles = 'width: 20px; height: 20px; box-shadow: 0 0 12px rgba(255,69,0,0.7);';
            }

            styleParts.push(className + ' { background: ' + (cfg.color || '#888') + '; ' + sizeStyles + ' }');
        });

        var styleEl = document.createElement('style');
        styleEl.innerHTML = styleParts.join('\n');
        document.head.appendChild(styleEl);
    }

    window.MapUtils = {
        haversineDistance: haversineDistance,
        getDistanceToCenter: getDistanceToCenter,
        isWithinRadius: isWithinRadius,
        formatPointMeta: formatPointMeta,
        getMarkerClass: getMarkerClass,
        getTypeColor: getTypeColor,
        injectMarkerStyles: injectMarkerStyles
    };
})(window);
