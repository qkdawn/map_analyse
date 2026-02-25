package com.example.placesearch.dto.response;

import lombok.Data;

import java.util.List;

@Data
public class SearchResponse {
    private String infocode = "10000";
    private List<PoiResponse> pois;
    private String status = "1";
    private String info = "OK";

    public void setError(String errorCode, String errorMessage) {
        this.infocode = errorCode;
        this.status = "0";
        this.info = errorMessage;
        this.pois = null;
    }
}