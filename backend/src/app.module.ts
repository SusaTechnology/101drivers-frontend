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
import { AppSettingModule } from "./appSetting/appSetting.module";
import { DealerLeadModule } from "./dealerLead/dealerLead.module";
import { InvestorLeadModule } from "./investorLead/investorLead.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SecretsManagerModule } from "./providers/secrets/secretsManager.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ServeStaticOptionsService } from "./serveStaticOptions.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
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
@Module({
  controllers: [],
  imports: [
    ACLModule,
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
    UploadModule,
    AdminDashboardModule,
    ReportsModule,
    EmailVerificationModule,
    SupportRequestModule,
    SupportRequestNoteModule,
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
  providers: [],
})
export class AppModule {}
