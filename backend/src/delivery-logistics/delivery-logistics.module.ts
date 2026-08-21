import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { GatewayModule } from "../gateways/gateway.module";
import { PostpaidBillingModule } from "../postpaidBilling/postpaidBilling.module";
import { ReferralModule } from "../referral/referral.module";

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
import { DeliveryClosePenaltyEngine } from "src/domain/deliveryRequest/deliveryClosePenalty.engine";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => GatewayModule),
    // PostpaidBillingModule is imported so DeliveryLifecycleService can
    // inject PostpaidBillingService and call reportUsageToStripe() at
    // delivery completion. The service is @Optional-injected so the
    // lifecycle still works if the module is removed (e.g. tests).
    forwardRef(() => PostpaidBillingModule),
    // ReferralModule provides ReferralTriggerService — needed by
    // DeliveryLifecycleService to fire the ON_DELIVERIES_COMPLETED
    // trigger when a referred driver completes their Nth delivery.
    // forwardRef breaks the circular chain (ReferralModule imports
    // DriverPayoutModule which imports DeliveryLogisticsModule).
    forwardRef(() => ReferralModule),
  ],
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
    PaymentPayoutEngine,
    DeliveryClosePenaltyEngine
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
    PaymentPayoutEngine,
    DeliveryClosePenaltyEngine
  ],
})
export class DeliveryLogisticsModule {}