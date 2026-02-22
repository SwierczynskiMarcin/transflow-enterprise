package com.transflow.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;      // np. Warszawa
    private String address;   // np. ul. Logistyczna 1
    private Double latitude;  // szerokość geograficzna
    private Double longitude; // długość geograficzna
}