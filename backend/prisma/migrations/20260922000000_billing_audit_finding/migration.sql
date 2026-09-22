-- BillingAuditFinding — findings from the nightly billing reconciliation
-- audit (subscription/default-PM/attachment consistency of Stripe objects
-- vs our DB). AUTO_REPAIRED findings record what the job fixed itself;
-- WARNING/CRITICAL ones are surfaced to admins (Billing Health).
CREATE TABLE "BillingAuditFinding" (
  "id"            TEXT        NOT NULL,
  "customerId"    TEXT        NOT NULL,
  "check"         TEXT        NOT NULL,
  "severity"      TEXT        NOT NULL,
  "detail"        TEXT        NOT NULL,
  "expectedValue" TEXT,
  "actualValue"   TEXT,
  "repairedAt"    TIMESTAMP(3),
  "resolvedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY ("id"),
  CONSTRAINT "BillingAuditFinding_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BillingAuditFinding_customerId_idx" ON "BillingAuditFinding"("customerId");
CREATE INDEX "BillingAuditFinding_check_idx" ON "BillingAuditFinding"("check");
CREATE INDEX "BillingAuditFinding_createdAt_idx" ON "BillingAuditFinding"("createdAt");
