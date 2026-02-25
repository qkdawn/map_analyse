package com.example.placesearch.repository;

import com.example.placesearch.entity.Region;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface RegionRepository extends JpaRepository<Region, String> {

    @Query(
            // 使用了mysql原生计算距离函数，
            value = "SELECT r.* FROM regions r " +
                    "WHERE (6371000 * 2 * ATAN2(" +
                    "SQRT(" +
                    "POWER(SIN(RADIANS(r.marlat - :lat) / 2), 2) + " +
                    "COS(RADIANS(:lat)) * COS(RADIANS(r.marlat)) * " +
                    "POWER(SIN(RADIANS(r.marlon - :lon) / 2), 2)" +
                    "), " +
                    "SQRT(1 - (" +
                    "POWER(SIN(RADIANS(r.marlat - :lat) / 2), 2) + " +
                    "COS(RADIANS(:lat)) * COS(RADIANS(r.marlat)) * " +
                    "POWER(SIN(RADIANS(r.marlon - :lon) / 2), 2)" +
                    "))" +
                    ")) <= :radius " +
                    "AND (:yearStart IS NULL OR (r.timestamp >= :yearStart AND r.timestamp < :yearEnd)) " +
                    "AND (:typeCodesEmpty = true OR r.typecode IN (:typeCodes))",
            nativeQuery = true
    )
    List<Region> findAround(
            @Param("lon") double lon,
            @Param("lat") double lat,
            @Param("radius") double radius,
            @Param("yearStart") LocalDateTime yearStart,
            @Param("yearEnd") LocalDateTime yearEnd,
            @Param("typeCodes") List<String> typeCodes,
            @Param("typeCodesEmpty") boolean typeCodesEmpty,
            Pageable pageable
    );

    @Query("SELECT r FROM Region r " +
            "WHERE r.cityname = :cityname " +
            "AND (:yearStart IS NULL OR (r.timestamp >= :yearStart AND r.timestamp < :yearEnd)) " +
            "AND (:typeCodes IS NULL OR r.typecode IN :typeCodes)")
    List<Region> findByCityAndFilters(
            @Param("cityname") String cityname,
            @Param("yearStart") LocalDateTime yearStart,
            @Param("yearEnd") LocalDateTime yearEnd,
            @Param("typeCodes") List<String> typeCodes,
            Pageable pageable
    );

    @Query(
            value = "SELECT r.* FROM regions r " +
                    "WHERE r.marlon IS NOT NULL AND r.marlat IS NOT NULL " +
                    "AND r.marlon BETWEEN :minLon AND :maxLon " +
                    "AND r.marlat BETWEEN :minLat AND :maxLat " +
                    "AND (:yearStart IS NULL OR (r.timestamp >= :yearStart AND r.timestamp < :yearEnd)) " +
                    "AND (:typeCodesEmpty = true OR r.typecode IN (:typeCodes)) " +
                    "AND ST_Intersects(" +
                    "ST_GeomFromText(:polygonWkt), " +
                    "ST_GeomFromText(CONCAT('POINT(', r.marlon, ' ', r.marlat, ')'))" +
                    ")",
            nativeQuery = true
    )
    List<Region> findByPolygon(
            @Param("polygonWkt") String polygonWkt,
            @Param("minLon") double minLon,
            @Param("maxLon") double maxLon,
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("yearStart") LocalDateTime yearStart,
            @Param("yearEnd") LocalDateTime yearEnd,
            @Param("typeCodes") List<String> typeCodes,
            @Param("typeCodesEmpty") boolean typeCodesEmpty,
            Pageable pageable
    );

    @Query(
            value = "SELECT r.* FROM regions r " +
                    "WHERE r.marlon IS NOT NULL AND r.marlat IS NOT NULL " +
                    "AND r.marlon BETWEEN :minLon AND :maxLon " +
                    "AND r.marlat BETWEEN :minLat AND :maxLat " +
                    "AND (:yearStart IS NULL OR (r.timestamp >= :yearStart AND r.timestamp < :yearEnd)) " +
                    "AND (:typeCodesEmpty = true OR r.typecode IN (:typeCodes))",
            nativeQuery = true
    )
    List<Region> findByBoundingBox(
            @Param("minLon") double minLon,
            @Param("maxLon") double maxLon,
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("yearStart") LocalDateTime yearStart,
            @Param("yearEnd") LocalDateTime yearEnd,
            @Param("typeCodes") List<String> typeCodes,
            @Param("typeCodesEmpty") boolean typeCodesEmpty,
            Pageable pageable
    );
}
