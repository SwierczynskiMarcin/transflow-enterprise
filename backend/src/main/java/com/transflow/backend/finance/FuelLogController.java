package com.transflow.backend.finance;

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