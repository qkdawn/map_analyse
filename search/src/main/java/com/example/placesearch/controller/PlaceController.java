package com.example.placesearch.controller;

import com.example.placesearch.dto.request.AroundSearchRequest;
import com.example.placesearch.dto.request.CitySearchRequest;
import com.example.placesearch.dto.request.PolygonSearchRequest;
import com.example.placesearch.dto.response.SearchResponse;
import com.example.placesearch.service.PlaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/place")
@RequiredArgsConstructor
public class PlaceController {
    private final PlaceService placeService;

    @GetMapping("/around")
    public SearchResponse aroundSearch(
            @RequestParam String location,
            @RequestParam Double radius,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String types,
            @RequestParam(name = "page_size", required = false) Integer pageSize,
            @RequestParam(name = "page_num", required = false) Integer pageNum) {

        AroundSearchRequest request = new AroundSearchRequest();
        request.setLocation(location);
        request.setRadius(radius);
        request.setYear(year);
        request.setTypes(types);
        request.setPageSize(pageSize);
        request.setPageNum(pageNum);

        return placeService.searchAround(request);
    }

    @GetMapping("/city")
    public SearchResponse citySearch(
            @RequestParam(required = false) String cityName,
            @RequestParam(required = false) String cityCode,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String types,
            @RequestParam(name = "page_size", required = false) Integer pageSize,
            @RequestParam(name = "page_num", required = false) Integer pageNum) {

        CitySearchRequest request = new CitySearchRequest();
        request.setCityName(cityName);
        request.setCityCode(cityCode);
        request.setYear(year);
        request.setTypes(types);
        request.setPageSize(pageSize);
        request.setPageNum(pageNum);

        return placeService.searchByCity(request);
    }

    @GetMapping("/polygon")
    public SearchResponse polygonSearch(
            @RequestParam String polygon,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String types,
            @RequestParam(name = "page_size", required = false) Integer pageSize,
            @RequestParam(name = "page_num", required = false) Integer pageNum) {

        PolygonSearchRequest request = new PolygonSearchRequest();
        request.setPolygon(polygon);
        request.setYear(year);
        request.setTypes(types);
        request.setPageSize(pageSize);
        request.setPageNum(pageNum);

        return placeService.searchByPolygon(request);
    }

    @PostMapping("/polygon")
    public SearchResponse polygonSearchPost(@RequestBody PolygonSearchRequest request) {
        return placeService.searchByPolygon(request);
    }
}
