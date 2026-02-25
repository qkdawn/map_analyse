package com.example.placesearch.util;

public class LocationUtils {
    private static final int DEFAULT_MAX_ITER = 10;
    private static final double DEFAULT_THRESHOLD = 1e-6;
    private static final double EARTH_RADIUS_M = 6371000.0;

    public static double[] gcj02ToWgs84(double lng, double lat) {
        return gcj02ToWgs84(lng, lat, DEFAULT_MAX_ITER, DEFAULT_THRESHOLD);
    }

    public static double[] gcj02ToWgs84(double lng, double lat, int maxIter, double threshold) {
        if (outOfChina(lng, lat)) {
            return new double[]{lng, lat};
        }

        double guessLng = lng;
        double guessLat = lat;
        for (int i = 0; i < maxIter; i++) {
            double[] calc = wgs84ToGcj02(guessLng, guessLat);
            double dLng = calc[0] - lng;
            double dLat = calc[1] - lat;
            if (Math.abs(dLng) < threshold && Math.abs(dLat) < threshold) {
                break;
            }
            guessLng -= dLng;
            guessLat -= dLat;
        }

        return new double[]{guessLng, guessLat};
    }

    public static double haversineMeters(double lng1, double lat1, double lng2, double lat2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1);
        double dLambda = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2)
                * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }

    private static double[] wgs84ToGcj02(double lng, double lat) {
        if (outOfChina(lng, lat)) {
            return new double[]{lng, lat};
        }

        double dLat = transformLat(lng - 105.0, lat - 35.0);
        double dLng = transformLng(lng - 105.0, lat - 35.0);
        double radLat = lat / 180.0 * Math.PI;
        double magic = Math.sin(radLat);
        magic = 1 - 0.00669342162296594323 * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * Math.PI);
        dLng = (dLng * 180.0) / (6378245.0 / sqrtMagic * Math.cos(radLat) * Math.PI);
        double mgLat = lat + dLat;
        double mgLng = lng + dLng;
        return new double[]{mgLng, mgLat};
    }

    private static double transformLat(double lng, double lat) {
        double ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320.0 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    private static double transformLng(double lng, double lat) {
        double ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    private static boolean outOfChina(double lng, double lat) {
        return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
    }
}
