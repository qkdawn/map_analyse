package com.example.placesearch.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.placesearch.dto.request.AroundSearchRequest;
import com.example.placesearch.dto.request.CitySearchRequest;
import com.example.placesearch.dto.request.PolygonSearchRequest;
import com.example.placesearch.dto.response.PoiResponse;
import com.example.placesearch.dto.response.SearchResponse;
import com.example.placesearch.entity.Code;
import com.example.placesearch.entity.Region;
import com.example.placesearch.repository.CodeRepository;
import com.example.placesearch.repository.RegionRepository;
import com.example.placesearch.util.LocationUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Optional;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlaceService {
    private final RegionRepository regionRepository;
    private final CodeRepository codeRepository;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int POLYGON_PAGE_SIZE_CAP = 5000;
    private static final Pattern PARKING_SUFFIX_PATTERN = Pattern.compile(
            "(停车场)?(出入口|入口|出口|东门|西门|南门|北门|[A-Za-z]口|\\d+号口)$"
    );
    private static final double PARKING_DEDUP_DISTANCE_M = 90.0;

    public SearchResponse searchAround(AroundSearchRequest request) {
        log.info("===== 开始处理搜索请求 =====");
        SearchResponse response = new SearchResponse();

        try {
            log.info("原始请求参数: {}", request);

            // 参数验证
            if (request.getLocation() == null || request.getRadius() == null) {
                response.setError("10001", "缺少必要参数: location或radius");
                log.error("参数验证失败: location 或 radius 为空");
                return response;
            }

            // 解析经纬度
            String[] coords = request.getLocation().split(",");
            if (coords.length != 2) {
                response.setError("10002", "location格式不正确，应为: 经度,纬度");
                log.error("location 格式错误: {}", request.getLocation());
                return response;
            }

            double radius;
            float centerLon;
            float centerLat;
            YearRange yearRange = buildYearRange(request.getYear());
            try {
                centerLon = Float.parseFloat(coords[0]);
                centerLat = Float.parseFloat(coords[1]);
                radius = request.getRadius();
                log.info("解析后的经纬度: lon={}, lat={}", centerLon, centerLat);
            } catch (NumberFormatException e) {
                response.setError("10003", "经纬度格式不正确");
                log.error("经纬度解析失败", e);
                return response;
            }

            log.info("搜索半径: {} 米", radius);
            final double queryLon = centerLon;
            final double queryLat = centerLat;

//            double[] wgs84Center = LocationUtils.gcj02ToWgs84(centerLon, centerLat);
//            final float queryLon = (float) wgs84Center[0];
//            final float queryLat = (float) wgs84Center[1];
//            log.info("GCJ-02转WGS84后经纬度: lon={}, lat={}", queryLon, queryLat);

            // 处理类型参数
            List<String> typeCodesParam = parseTypeCodes(request.getTypes());
            boolean typeCodesEmpty = (typeCodesParam == null || typeCodesParam.isEmpty());
            Integer pageSizeParam = request.getPageSize();
            int pageSize = pageSizeParam == null || pageSizeParam <= 0 ? 25 : pageSizeParam;
            int pageNum = request.getPageNum() == null || request.getPageNum() <= 0 ? 1 : request.getPageNum();
            Pageable pageable = pageSizeParam != null && pageSizeParam == -1
                    ? Pageable.unpaged()
                    : PageRequest.of(pageNum - 1, pageSize);

            // 执行查询
            log.info("开始执行数据库查询...");
            List<Region> results = regionRepository.findAround(
                    queryLon,
                    queryLat,
                    radius,
                    yearRange.start,
                    yearRange.end,
                    typeCodesParam,
                    typeCodesEmpty,
                    pageable
            );
            log.info("数据库查询完成，返回 {} 条结果", results.size());

            if (results.isEmpty()) {
                log.warn("未找到匹配的地点");
                response.setPois(Collections.emptyList());
                return response;
            }

            // 转换结果
            List<PoiResponse> pois = results.stream().map(region -> {
                try {
                    // 构建响应对象
                    PoiResponse poi = new PoiResponse();
                    poi.setId(region.getId());
                    poi.setName(region.getName());

                    // 处理typecode，补零到6位
                    String typecode = region.getTypecode();
                    if (typecode != null && typecode.length() < 6) {
                        typecode = String.format("%06d", Integer.parseInt(typecode));
                    }
                    poi.setTypecode(typecode);

                    poi.setType(String.join(";",
                            region.getCategoryLarge(),
                            region.getCategoryMedium(),
                            region.getCategorySmall()));
                    poi.setAddress(region.getAddress());
                    poi.setPname(region.getPname());
                    poi.setCityname(region.getCityname());
                    poi.setAdname(region.getAdname());
                    poi.setAdcode(region.getAdcode());
                    poi.setLocation(region.getMarlon() + "," + region.getMarlat());

                    // 计算实际距离（欧几里得距离）
                    Double poiLon = region.getMarlon();
                    Double poiLat = region.getMarlat();
                    double distance = LocationUtils.haversineMeters(queryLon, queryLat, poiLon, poiLat);
                    // 转换为字符串，距离取整（米）
                    poi.setDistance(String.valueOf(Math.round(distance)));

                    if (region.getTimestamp() != null) {
                        // 直接使用LocalDateTime的getYear()方法
                        poi.setYear(String.valueOf(region.getTimestamp().getYear()));
                    }

                    return poi;
                } catch (Exception e) {
                    log.error("结果转换失败", e);
                    throw new RuntimeException("结果转换异常", e);
                }
            }).collect(Collectors.toList());

            log.info("结果转换完成，共生成 {} 个 POI", pois.size());
            response.setPois(pois);

        } catch (Exception e) {
            log.error("服务器发生未知错误", e);
            response.setError("10004", "服务器错误: " + e.getMessage());
        }

        log.info("===== 请求处理完成 =====");
        return response;
    }

    public SearchResponse searchByCity(CitySearchRequest request) {
        log.info("===== 开始处理城市搜索请求 =====");
        SearchResponse response = new SearchResponse();

        try {
            log.info("原始请求参数: {}", request);

            // 参数验证
            if (!StringUtils.hasText(request.getCityName()) && !StringUtils.hasText(request.getCityCode())) {
                response.setError("20001", "缺少必要参数: cityName或cityCode");
                log.error("参数验证失败: cityName 和 cityCode 为空");
                return response;
            }

            YearRange yearRange = buildYearRange(request.getYear());
            List<String> typeCodesParam = parseTypeCodes(request.getTypes());
            Integer pageSizeParam = request.getPageSize();
            int pageSize = pageSizeParam == null || pageSizeParam <= 0 ? 25 : pageSizeParam;
            int pageNum = request.getPageNum() == null || request.getPageNum() <= 0 ? 1 : request.getPageNum();
            Pageable pageable = pageSizeParam != null && pageSizeParam == -1
                    ? Pageable.unpaged()
                    : PageRequest.of(pageNum - 1, pageSize);

            String cityname = request.getCityName();
            if (StringUtils.hasText(cityname)) {
                log.info("跳过查询code，搜索条件: cityname={}, year={}, types={}", cityname, request.getYear(), typeCodesParam);
            } else {
                String citycode = request.getCityCode();
                log.info("搜索条件: citycode={}, year={}, types={}", citycode, request.getYear(), typeCodesParam);

                // 验证citycode是否存在
                Optional<Code> codeOpt = codeRepository.findFirstByCitycode(citycode);
                if (codeOpt.isEmpty()) {
                    response.setError("20002", "无效的城市编码: " + citycode);
                    log.error("无效的城市编码: {}", citycode);
                    return response;
                }

                cityname = codeOpt.get().getCityname();
                log.info("找到城市: citycode={}, cityname={}", citycode, cityname);
            }

            // 执行查询
            List<Region> results = regionRepository.findByCityAndFilters(
                    cityname,
                    yearRange.start,
                    yearRange.end,
                    typeCodesParam,
                    pageable
            );

            log.info("数据库查询完成，返回 {} 条结果", results.size());

            if (results.isEmpty()) {
                log.warn("未找到匹配的地点");
                response.setPois(Collections.emptyList());
                return response;
            }

            // 转换结果（与searchAround方法保持一致）
            List<PoiResponse> pois = results.stream().map(region -> {
                try {
                    // 构建响应对象
                    PoiResponse poi = new PoiResponse();
                    poi.setId(region.getId());
                    poi.setName(region.getName());

                    // 处理typecode，补零到6位
                    String typecode = region.getTypecode();
                    if (typecode != null && typecode.length() < 6) {
                        typecode = String.format("%06d", Integer.parseInt(typecode));
                    }
                    poi.setTypecode(typecode);

                    poi.setType(String.join(";",
                            region.getCategoryLarge(),
                            region.getCategoryMedium(),
                            region.getCategorySmall()));
                    poi.setAddress(region.getAddress());
                    poi.setPname(region.getPname());
                    poi.setCityname(region.getCityname());
                    poi.setAdname(region.getAdname());
                    poi.setAdcode(region.getAdcode());
                    poi.setLocation(region.getMarlon() + "," + region.getMarlat());
                    poi.setDistance("");  // 城市查询不计算距离

                    if (region.getTimestamp() != null) {
                        // 直接使用LocalDateTime的getYear()方法
                        poi.setYear(String.valueOf(region.getTimestamp().getYear()));
                    }

                    return poi;
                } catch (Exception e) {
                    log.error("结果转换失败", e);
                    throw new RuntimeException("结果转换异常", e);
                }
            }).collect(Collectors.toList());

            log.info("结果转换完成，共生成 {} 个 POI", pois.size());
            response.setPois(pois);

        } catch (Exception e) {
            log.error("服务器发生未知错误", e);
            response.setError("20003", "服务器错误: " + e.getMessage());
        }

        log.info("===== 请求处理完成 =====");
        return response;
    }

    public SearchResponse searchByPolygon(PolygonSearchRequest request) {
        log.info("===== 开始处理多边形搜索请求 =====");
        SearchResponse response = new SearchResponse();

        try {
            log.info("原始请求参数: {}", request);

            if (!StringUtils.hasText(request.getPolygon())) {
                response.setError("30001", "缺少必要参数: polygon");
                log.error("参数验证失败: polygon 为空");
                return response;
            }

            final PolygonBounds polygonBounds;
            try {
                polygonBounds = buildPolygonBounds(request.getPolygon());
            } catch (IllegalArgumentException e) {
                response.setError("30002", e.getMessage());
                log.error("polygon 参数无效: {}", request.getPolygon());
                return response;
            }
            log.info(
                    "polygon bounds: lon=[{}, {}], lat=[{}, {}]",
                    polygonBounds.minLon,
                    polygonBounds.maxLon,
                    polygonBounds.minLat,
                    polygonBounds.maxLat
            );

            List<String> typeCodesParam = parseTypeCodes(request.getTypes());
            boolean typeCodesEmpty = (typeCodesParam == null || typeCodesParam.isEmpty());
            YearRange yearRange = buildYearRange(request.getYear());

            Integer pageSizeParam = request.getPageSize();
            int pageSize;
            if (pageSizeParam != null && pageSizeParam == -1) {
                pageSize = POLYGON_PAGE_SIZE_CAP;
            } else if (pageSizeParam == null || pageSizeParam <= 0) {
                pageSize = 25;
            } else if (pageSizeParam > POLYGON_PAGE_SIZE_CAP) {
                pageSize = POLYGON_PAGE_SIZE_CAP;
            } else {
                pageSize = pageSizeParam;
            }
            int pageNum = request.getPageNum() == null || request.getPageNum() <= 0 ? 1 : request.getPageNum();
            Pageable pageable = PageRequest.of(pageNum - 1, pageSize);
            if (pageSizeParam != null && pageSizeParam == -1) {
                log.info("polygon page_size=-1 detected, capped to {}", pageSize);
            }

            List<Region> bboxCandidates = regionRepository.findByBoundingBox(
                    polygonBounds.minLon,
                    polygonBounds.maxLon,
                    polygonBounds.minLat,
                    polygonBounds.maxLat,
                    yearRange.start,
                    yearRange.end,
                    typeCodesParam,
                    typeCodesEmpty,
                    pageable
            );
            log.info("bbox 查询完成，返回 {} 条候选结果", bboxCandidates.size());

            List<Region> insidePolygon = bboxCandidates.stream()
                    .filter(region -> pointInPolygon(region.getMarlon(), region.getMarlat(), polygonBounds.vertices))
                    .collect(Collectors.toList());
            log.info("polygon 精筛完成，命中 {} 条结果", insidePolygon.size());

            List<Region> dedupedResults = dedupePolygonRegions(insidePolygon);
            int removed = Math.max(0, insidePolygon.size() - dedupedResults.size());
            if (removed > 0) {
                log.info("多边形去重完成: 原始 {} -> 去重后 {} (移除 {})", insidePolygon.size(), dedupedResults.size(), removed);
            }

            if (dedupedResults.isEmpty()) {
                response.setPois(Collections.emptyList());
                return response;
            }

            List<PoiResponse> pois = dedupedResults.stream().map(region -> {
                try {
                    PoiResponse poi = new PoiResponse();
                    poi.setId(region.getId());
                    poi.setName(region.getName());

                    String typecode = region.getTypecode();
                    if (typecode != null && typecode.length() < 6) {
                        typecode = String.format("%06d", Integer.parseInt(typecode));
                    }
                    poi.setTypecode(typecode);
                    poi.setType(String.join(";",
                            region.getCategoryLarge(),
                            region.getCategoryMedium(),
                            region.getCategorySmall()));
                    poi.setAddress(region.getAddress());
                    poi.setPname(region.getPname());
                    poi.setCityname(region.getCityname());
                    poi.setAdname(region.getAdname());
                    poi.setAdcode(region.getAdcode());
                    poi.setLocation(region.getMarlon() + "," + region.getMarlat());
                    // polygon 查询没有单一中心点，不返回距离。
                    poi.setDistance("");

                    if (region.getTimestamp() != null) {
                        poi.setYear(String.valueOf(region.getTimestamp().getYear()));
                    }

                    return poi;
                } catch (Exception e) {
                    log.error("结果转换失败", e);
                    throw new RuntimeException("结果转换异常", e);
                }
            }).collect(Collectors.toList());

            response.setPois(pois);
        } catch (Exception e) {
            log.error("服务器发生未知错误", e);
            response.setError("30003", "服务器错误: " + e.getMessage());
        }

        log.info("===== 多边形搜索处理完成 =====");
        return response;
    }

    private PolygonBounds buildPolygonBounds(String polygonRaw) {
        String raw = polygonRaw == null ? "" : polygonRaw.trim();
        if (!StringUtils.hasText(raw)) {
            throw new IllegalArgumentException("polygon不能为空");
        }

        List<double[]> points;
        if (raw.startsWith("[")) {
            points = parsePolygonJsonArray(raw);
        } else {
            points = parsePolygonSemicolon(raw);
        }

        if (points.size() < 3) {
            throw new IllegalArgumentException("polygon点数不足，至少需要3个点");
        }

        if (!samePoint(points.get(0), points.get(points.size() - 1))) {
            points.add(new double[]{points.get(0)[0], points.get(0)[1]});
        }

        double minLon = Double.POSITIVE_INFINITY;
        double minLat = Double.POSITIVE_INFINITY;
        double maxLon = Double.NEGATIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        for (double[] p : points) {
            if (p == null || p.length < 2) {
                continue;
            }
            minLon = Math.min(minLon, p[0]);
            maxLon = Math.max(maxLon, p[0]);
            minLat = Math.min(minLat, p[1]);
            maxLat = Math.max(maxLat, p[1]);
        }
        if (!Double.isFinite(minLon) || !Double.isFinite(minLat) || !Double.isFinite(maxLon) || !Double.isFinite(maxLat)) {
            throw new IllegalArgumentException("polygon包含非法坐标");
        }

        String ring = points.stream()
                .map(p -> String.format(Locale.US, "%.8f %.8f", p[0], p[1]))
                .collect(Collectors.joining(","));
        return new PolygonBounds("POLYGON((" + ring + "))", minLon, maxLon, minLat, maxLat, points);
    }

    private record PolygonBounds(
            String wkt,
            double minLon,
            double maxLon,
            double minLat,
            double maxLat,
            List<double[]> vertices
    ) { }

    private YearRange buildYearRange(Integer year) {
        if (year == null) {
            return new YearRange(null, null);
        }
        LocalDateTime start = LocalDateTime.of(year, 1, 1, 0, 0, 0);
        LocalDateTime end = start.plusYears(1);
        return new YearRange(start, end);
    }

    private record YearRange(
            LocalDateTime start,
            LocalDateTime end
    ) { }

    private boolean pointInPolygon(Double lon, Double lat, List<double[]> polygon) {
        if (lon == null || lat == null || polygon == null || polygon.size() < 3) {
            return false;
        }
        int size = polygon.size();
        if (size >= 2 && samePoint(polygon.get(0), polygon.get(size - 1))) {
            size -= 1;
        }
        if (size < 3) {
            return false;
        }

        boolean inside = false;
        final double x = lon;
        final double y = lat;
        for (int i = 0, j = size - 1; i < size; j = i++) {
            double[] pi = polygon.get(i);
            double[] pj = polygon.get(j);
            if (pi == null || pj == null || pi.length < 2 || pj.length < 2) {
                continue;
            }
            double xi = pi[0];
            double yi = pi[1];
            double xj = pj[0];
            double yj = pj[1];
            boolean intersects = ((yi > y) != (yj > y))
                    && (x < (xj - xi) * (y - yi) / ((yj - yi) + 1e-15) + xi);
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private List<double[]> parsePolygonSemicolon(String polygonRaw) {
        List<double[]> points = new ArrayList<>();
        String[] pairs = polygonRaw.split(";");
        for (String pair : pairs) {
            String item = pair == null ? "" : pair.trim();
            if (item.isEmpty()) {
                continue;
            }
            String[] coords = item.split(",");
            if (coords.length != 2) {
                throw new IllegalArgumentException("polygon格式不正确，应为: lng,lat;lng,lat;...");
            }
            try {
                double lng = Double.parseDouble(coords[0].trim());
                double lat = Double.parseDouble(coords[1].trim());
                points.add(new double[]{lng, lat});
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("polygon包含非法坐标");
            }
        }
        return points;
    }

    private List<double[]> parsePolygonJsonArray(String polygonRaw) {
        try {
            JsonNode root = JSON.readTree(polygonRaw);
            if (!root.isArray()) {
                throw new IllegalArgumentException("polygon JSON 必须是数组");
            }
            List<double[]> points = new ArrayList<>();
            for (JsonNode item : root) {
                if (!item.isArray() || item.size() < 2) {
                    throw new IllegalArgumentException("polygon JSON 元素必须是 [lng,lat]");
                }
                double lng = item.get(0).asDouble(Double.NaN);
                double lat = item.get(1).asDouble(Double.NaN);
                if (!Double.isFinite(lng) || !Double.isFinite(lat)) {
                    throw new IllegalArgumentException("polygon JSON 包含非法坐标");
                }
                points.add(new double[]{lng, lat});
            }
            return points;
        } catch (IOException ex) {
            throw new IllegalArgumentException("polygon格式不正确，应为 lng,lat;... 或 [[lng,lat],...]");
        }
    }

    private List<String> parseTypeCodes(String rawTypes) {
        if (!StringUtils.hasText(rawTypes)) {
            return null;
        }
        LinkedHashSet<String> parsed = new LinkedHashSet<>();
        Arrays.stream(rawTypes.split("[/|,;\\s]+"))
                .map(code -> code == null ? "" : code.trim())
                .filter(StringUtils::hasText)
                .forEach(code -> {
                    parsed.add(code);
                    expandTypeCodeAliases(code).forEach(parsed::add);
                });
        return parsed.isEmpty() ? null : new ArrayList<>(parsed);
    }

    private List<String> expandTypeCodeAliases(String code) {
        if (!StringUtils.hasText(code)) {
            return Collections.emptyList();
        }
        String normalized = code.trim();
        if (!normalized.matches("\\d+")) {
            return Collections.emptyList();
        }
        if (normalized.length() == 6 && normalized.startsWith("0")) {
            return Collections.singletonList(normalized.substring(1));
        }
        if (normalized.length() == 5) {
            return Collections.singletonList("0" + normalized);
        }
        return Collections.emptyList();
    }

    private List<Region> dedupePolygonRegions(List<Region> regions) {
        if (regions == null || regions.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> exactSeen = new HashSet<>();
        List<Region> exactDeduped = new ArrayList<>();
        for (Region region : regions) {
            String key = buildRegionExactKey(region);
            if (exactSeen.contains(key)) {
                continue;
            }
            exactSeen.add(key);
            exactDeduped.add(region);
        }

        List<Region> kept = new ArrayList<>();
        List<ParkingAnchor> parkingAnchors = new ArrayList<>();
        for (Region region : exactDeduped) {
            if (!isParkingLike(region)) {
                kept.add(region);
                continue;
            }

            Double lon = region.getMarlon();
            Double lat = region.getMarlat();
            if (lon == null || lat == null) {
                kept.add(region);
                continue;
            }

            String canonical = canonicalParkingName(region.getName());
            if (!StringUtils.hasText(canonical)) {
                kept.add(region);
                continue;
            }

            boolean duplicated = false;
            for (ParkingAnchor anchor : parkingAnchors) {
                if (!canonical.equals(anchor.canonicalName)) {
                    continue;
                }
                if (haversineMeters(lon, lat, anchor.lon, anchor.lat) <= PARKING_DEDUP_DISTANCE_M) {
                    duplicated = true;
                    break;
                }
            }
            if (duplicated) {
                continue;
            }

            kept.add(region);
            parkingAnchors.add(new ParkingAnchor(canonical, lon, lat));
        }

        return kept;
    }

    private boolean samePoint(double[] a, double[] b) {
        final double eps = 1e-9;
        return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
    }

    private String buildRegionExactKey(Region region) {
        String id = region.getId();
        if (StringUtils.hasText(id)) {
            return "id:" + id.trim();
        }
        String name = normalizeText(region.getName());
        Double lon = region.getMarlon();
        Double lat = region.getMarlat();
        String typecode = normalizeText(region.getTypecode());
        if (lon != null && lat != null) {
            return String.format(
                    Locale.US,
                    "name_loc:%s|%.6f,%.6f|%s",
                    name,
                    lon,
                    lat,
                    typecode
            );
        }
        return "name_only:" + name + "|" + typecode;
    }

    private boolean isParkingLike(Region region) {
        String typecode = normalizeText(region.getTypecode());
        if (typecode.startsWith("1509")) {
            return true;
        }
        String name = region.getName();
        return StringUtils.hasText(name) && name.contains("停车");
    }

    private String canonicalParkingName(String rawName) {
        String name = normalizeText(rawName);
        if (!StringUtils.hasText(name)) {
            return name;
        }
        name = PARKING_SUFFIX_PATTERN.matcher(name).replaceAll("");
        name = name.replace("停车场出入口", "停车场")
                .replace("停车场入口", "停车场")
                .replace("停车场出口", "停车场");
        return name;
    }

    private String normalizeText(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replaceAll("\\s+", "").trim();
    }

    private double haversineMeters(double lon1, double lat1, double lon2, double lat2) {
        return LocationUtils.haversineMeters(lon1, lat1, lon2, lat2);
    }

    private static final class ParkingAnchor {
        private final String canonicalName;
        private final double lon;
        private final double lat;

        private ParkingAnchor(String canonicalName, double lon, double lat) {
            this.canonicalName = canonicalName;
            this.lon = lon;
            this.lat = lat;
        }
    }
}
