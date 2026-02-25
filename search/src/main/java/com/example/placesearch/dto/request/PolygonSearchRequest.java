package com.example.placesearch.dto.request;

import lombok.Data;

@Data
public class PolygonSearchRequest {
    // 多边形字符串，格式: lng,lat;lng,lat;lng,lat
    private String polygon;
    private Integer year;     // 搜索年份
    private String types;     // 类型编码，支持 "/" 分隔多个类型
    private Integer pageSize; // 每页条数
    private Integer pageNum;  // 页码，从1开始
}
