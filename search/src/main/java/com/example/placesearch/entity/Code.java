package com.example.placesearch.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "code")
public class Code {
    @Id
    @Column(name = "adcode")
    private String adcode;
    private String cityname;
    private String citycode;
}
