package com.transflow.backend.finance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FuelLogRepository extends JpaRepository<FuelLog, Long> {}