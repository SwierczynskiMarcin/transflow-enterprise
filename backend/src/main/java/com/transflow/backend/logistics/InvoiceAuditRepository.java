package com.transflow.backend.logistics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InvoiceAuditRepository extends JpaRepository<InvoiceAudit, Long> {}