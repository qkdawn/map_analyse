package com.example.placesearch.dto.request;

import lombok.Data;

@Data
public class AroundSearchRequest {
    private String location; // 经度,纬度
    private Double radius;   // 搜索半径(米)
    private Integer year;    // 搜索年份
    private String types;    // 类型编码，支持"|"分隔多个类型
    private Integer pageSize; // 每页条数
    private Integer pageNum;  // 页码，从1开始
}
