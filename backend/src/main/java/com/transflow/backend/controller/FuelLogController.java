package com.transflow.backend.controller;

import com.transflow.backend.model.FuelLog;
import com.transflow.backend.service.FuelLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fuel")
@RequiredArgsConstructor
public class FuelLogController {

    private final FuelLogService fuelLogService;

    @PostMapping
    public FuelLog addFuelLog(@RequestBody FuelLog fuelLog) {
        return fuelLogService.addFuelLog(fuelLog);
    }
}