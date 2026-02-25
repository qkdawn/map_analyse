package com.example.placesearch.dto.response;

import lombok.Data;

@Data
public class PoiResponse {
    private String address;
    private String distance;
    private String pname;
    private String cityname;
    private String type;
    private String typecode;
    private String adname;
    private String year;
    private String adcode;
    private String name;
    private String location;
    private String id;
}