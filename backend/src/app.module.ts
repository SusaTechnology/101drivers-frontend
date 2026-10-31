import { Module } from "@nestjs/common";
import { UserModule } from "./user/user.module";
import { CustomerModule } from "./customer/customer.module";
import { DriverModule } from "./driver/driver.module";
import { SavedAddressModule } from "./savedAddress/savedAddress.module";
import { SavedVehicleModule } from "./savedVehicle/savedVehicle.module";
import { PricingConfigModule } from "./pricingConfig/pricingConfig.module";
import { PricingTierModule } from "./pricingTier/pricingTier.module";
import { PricingCategoryRuleModule } from "./pricingCategoryRule/pricingCategoryRule.module";
import { QuoteModule } from "./quote/quote.module";
import { SchedulingPolicyModule } from "./schedulingPolicy/schedulingPolicy.module";
import { OperatingHourModule } from "./operatingHour/operatingHour.module";
import { TimeSlotTemplateModule } from "./timeSlotTemplate/timeSlotTemplate.module";
import { DeliveryRequestModule } from "./deliveryRequest/deliveryRequest.module";
import { DeliveryAssignmentModule } from "./deliveryAssignment/deliveryAssignment.module";
import { TrackingSessionModule } from "./trackingSession/trackingSession.module";
import { TrackingPointModule } from "./trackingPoint/trackingPoint.module";
import { DeliveryEvidenceModule } from "./deliveryEvidence/deliveryEvidence.module";
import { DeliveryComplianceModule } from "./deliveryCompliance/deliveryCompliance.module";
import { EvidenceExportModule } from "./evidenceExport/evidenceExport.module";
import { DeliveryStatusHistoryModule } from "./deliveryStatusHistory/deliveryStatusHistory.module";
import { ScheduleChangeRequestModule } from "./scheduleChangeRequest/scheduleChangeRequest.module";
import { PaymentModule } from "./payment/payment.module";
import { PaymentEventModule } from "./paymentEvent/paymentEvent.module";
import { DriverPayoutModule } from "./driverPayout/driverPayout.module";
import { DriverPreferenceModule } from "./driverPreference/driverPreference.module";
import { DriverLocationModule } from "./driverLocation/driverLocation.module";

import { ServiceDistrictModule } from "./serviceDistrict/serviceDistrict.module";
import { DriverDistrictPreferenceModule } from "./driverDistrictPreference/driverDistrictPreference.module";
import { DriverAlertPreferenceModule } from "./driverAlertPreference/driverAlertPreference.module";
import { DisputeCaseModule } from "./disputeCase/disputeCase.module";
import { DisputeNoteModule } from "./disputeNote/disputeNote.module";
import { DeliveryRatingModule } from "./deliveryRating/deliveryRating.module";
import { TipModule } from "./tip/tip.module";
import { NotificationEventModule } from "./notificationEvent/notificationEvent.module";
import { AdminAuditLogModule } from "./adminAuditLog/adminAuditLog.module";
import { AdminGateModule } from "./admin-gate/admin-gate.module";
import { AppSettingModule } from "./appSetting/appSetting.module";
import { DealerLeadModule } from "./dealerLead/dealerLead.module";
import { InvestorLeadModule } from "./investorLead/investorLead.module";
import { GatewayModule } from "./gateways/gateway.module";
import { AppEventsModule } from "./common/appEvents/appEvents.module";
import { RateLimitModule } from "./common/rate-limit/rate-limit.service";
import { AnalyticsModule } from "./analytics/analytics.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SecretsManagerModule } from "./providers/secrets/secretsManager.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ServeStaticOptionsService } from "./serveStaticOptions.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";

import { ACLModule } from "./auth/acl.module";
import { AuthModule } from "./auth/auth.module";
import { EmailVerificationModule } from "./auth/email-verification/email-verification.module";
import { UploadModule } from "./upload/upload.module";
import { AdminDashboardModule } from "./adminDashboard/adminDashboard.module";
import { ReportsModule } from "./reports/reports.module";
import { EmailVerificationTokenModule } from "./emailVerificationToken/emailVerificationToken.module";
import { SupportRequestModule } from "./supportRequest/supportRequest.module";
import { SupportRequestNoteModule } from "./supportRequestNote/supportRequestNote.module";
import { StripeModule } from "./providers/stripe/stripe.module";
import { ReferralModule } from "./referral/referral.module";
import { StripeWebhookController } from "./payment/stripe-webhook.controller";
import { RefundSyncService } from "./payment/refund-sync.service";
import { RefundReconciliationService } from "./payment/refund-reconciliation.service";
import { InsurancePortalController } from "./insurance-portal/insurance-portal.controller";
import { ContentController } from "./content/content.controller";
import { CmsController } from "./cms/cms.controller";
import { CmsService } from "./cms/cms.service";
import { NotificationEventEngine } from "./domain/notificationEvent/notificationEvent.engine";
import { MailModule } from "./common/mail/mail.module";
import { PostpaidBillingModule } from "./postpaidBilling/postpaidBilling.module";
import { GeoModule } from "./geo/geo.module";
@Module({
  controllers: [StripeWebhookController, InsurancePortalController, ContentController, CmsController],
  imports: [
    ACLModule,
    // Global leaf pub/sub bus (see common/appEvents) — registered once so
    // AuthService/UserService/TrackingGateway can all inject it without
    // any of them importing each other.
    AppEventsModule,
    // Global leaf rate limiter (see common/rate-limit) — per-email and
    // per-IP budgets for every public endpoint that sends an email.
    RateLimitModule,
    // Product analytics (Task 72) — event ledger + admin metrics API.
    // Leaf module; business modules import it for recordSafe() hooks.
    AnalyticsModule,
    GeoModule,
    // Shared-secret door in front of the admin UI (?key= links → signed
    // 30-day cookie; see src/admin-gate). Leaf module, no dependencies.
    AdminGateModule,
    AuthModule,
    UserModule,
    CustomerModule,
    DriverModule,
    SavedAddressModule,
    SavedVehicleModule,
    PricingConfigModule,
    PricingTierModule,
    PricingCategoryRuleModule,
    QuoteModule,
    SchedulingPolicyModule,
    OperatingHourModule,
    TimeSlotTemplateModule,
    DeliveryRequestModule,
    DeliveryAssignmentModule,
    TrackingSessionModule,
    TrackingPointModule,
    DeliveryEvidenceModule,
    DeliveryComplianceModule,
    EvidenceExportModule,
    DeliveryStatusHistoryModule,
    ScheduleChangeRequestModule,
    PaymentModule,
    PaymentEventModule,    
    DriverLocationModule,
    DriverPayoutModule,
    DriverPreferenceModule,
    ServiceDistrictModule,
    DriverDistrictPreferenceModule,
    DriverAlertPreferenceModule,
    DisputeCaseModule,
    DisputeNoteModule,
    DeliveryRatingModule,
    TipModule,
    NotificationEventModule,
    AdminAuditLogModule,
    AppSettingModule,
    DealerLeadModule,
    InvestorLeadModule,
    HealthModule,
    PrismaModule,
    SecretsManagerModule,
    StripeModule,
    UploadModule,
    ReferralModule,
    AdminDashboardModule,
    ReportsModule,
    EmailVerificationModule,
    // MailModule supplies the shared MailService for the root
    // NotificationEventEngine and CmsService — a locally-registered
    // MailService would crash DI (MailService requires AdminGateService,
    // invisible from the root providers list).
    MailModule,
    SupportRequestModule,
    SupportRequestNoteModule,
    GatewayModule,
    PostpaidBillingModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRootAsync({
      useClass: ServeStaticOptionsService,
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => {
        const playground = configService.get("GRAPHQL_PLAYGROUND");
        const introspection = configService.get("GRAPHQL_INTROSPECTION");
        return {
          autoSchemaFile: "schema.graphql",
          sortSchema: true,
          playground,
          introspection: playground || introspection,
        };
      },
      inject: [ConfigService],
      imports: [ConfigModule],
    }),
    EmailVerificationModule
  ],
  providers: [
    NotificationEventEngine,
    CmsService,
    // Task 19: shared refund state-transition (webhook + reconciler) and
    // the self-healing sweep for refunds whose charge.refunded webhook
    // never landed.
    RefundSyncService,
    RefundReconciliationService,
  ],
})
export class AppModule {}
