import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";

import { GoogleMapsService } from "./google-maps.service";
import { PricingEngineService } from "./pricing-engine.service";
import { DriverJobFeedService } from "./driver-job-feed.service";
import { DeliveryLifecycleService } from "./delivery-lifecycle.service";
import { DeliveryRequestOrchestratorService } from "./delivery-request-orchestrator.service";
import { DeliveryExpiryScheduler } from "./delivery-expiry.scheduler";

import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";

import { EmailVerificationService } from "src/auth/email-verification/email-verification.service";
import { MailService } from "src/common/mail/mail.service";
import { PasswordService } from "../auth/password.service";
import { DeliveryComplianceEngine } from "src/domain/deliveryCompliance/deliveryCompliance.engine";
import { DeliveryEvidenceEngine } from "src/domain/deliveryEvidence/deliveryEvidence.engine";
import { PaymentPayoutEngine } from "src/domain/deliveryRequest/paymentPayout.engine";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    GoogleMapsService,
    PricingEngineService,
    DriverJobFeedService,
    DeliveryLifecycleService,
    DeliveryRequestOrchestratorService,
    DeliveryExpiryScheduler,
    NotificationEventEngine,
    EmailVerificationService,
    MailService,
    PasswordService,
    DeliveryComplianceEngine,
    DeliveryEvidenceEngine,
    PaymentPayoutEngine
  ],
  exports: [
    GoogleMapsService,
    PricingEngineService,
    DriverJobFeedService,
    DeliveryLifecycleService,
    DeliveryRequestOrchestratorService,
    NotificationEventEngine,
    DeliveryComplianceEngine,
    DeliveryEvidenceEngine,
    PaymentPayoutEngine
  ],
})
export class DeliveryLogisticsModule {}