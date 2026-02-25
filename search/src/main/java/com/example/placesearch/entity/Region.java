package com.example.placesearch.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(
    name = "regions",
    indexes = {
        @Index(name = "idx_regions_cityname", columnList = "cityname")
    }
)
public class Region {

    /* ================= 主键 ================= */
    @Id
    @Column(length = 255, nullable = false)
    private String id;

    /* ================= 基础信息 ================= */
    @Column(length = 100, nullable = true)
    private String tag;

    @Column(length = 255, nullable = true)
    private String name;

    @Column(length = 50, nullable = true)
    private String dtype;

    @Column(length = 50, nullable = true)
    private String typecode;

    @Column(length = 255, nullable = true)
    private String address;

    @Column(length = 50, nullable = true)
    private String tel;

    @Column(length = 50, nullable = true)
    private String pcode;

    @Column(length = 100, nullable = true)
    private String pname;

    @Column(length = 50, nullable = true)
    private String citycode;

    @Column(length = 100, nullable = true)
    private String cityname;

    @Column(length = 50, nullable = true)
    private String adcode;

    @Column(length = 100, nullable = true)
    private String adname;

    /* ================= 业务字段 ================= */
    @Column(name = "business_area", length = 255, nullable = true)
    private String businessArea;

    @Column(
        name = "marlon",
        columnDefinition = "double",
        nullable = true
    )
    private Double marlon;

    @Column(
        name = "marlat",
        columnDefinition = "double",
        nullable = true
    )
    private Double marlat;

    @Column(
        name = "wgs84lon",
        columnDefinition = "double",
        nullable = true
    )
    private Double wgs84lon;

    @Column(
        name = "wgs84lat",
        columnDefinition = "double",
        nullable = true
    )
    private Double wgs84lat;

    /* ================= 时间字段 ================= */
    // 强烈建议不要叫 timestamp
    @Column(
        name = "timestamp",
        columnDefinition = "DATETIME",
        nullable = true
    )
    private LocalDateTime timestamp;

    /* ================= 分类字段（中文列名） ================= */
    @Column(name = "大类", length = 100, nullable = true)
    private String categoryLarge;

    @Column(name = "中类", length = 100, nullable = true)
    private String categoryMedium;

    @Column(name = "小类", length = 100, nullable = true)
    private String categorySmall;
}
