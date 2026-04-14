import { Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import {
  EnumCustomerCustomerType,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumQuoteServiceType,
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyDefaultMode,
  EnumSchedulingPolicyServiceType,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";
import { SchedulePreviewResponseBody } from "src/deliveryRequest/dto/deliveryRequestLogistics.dto";
import { GoogleMapsService } from "../../delivery-logistics/google-maps.service";

type EffectivePolicyInput = {
  customerType: EnumCustomerCustomerType;
  serviceType?: EnumDeliveryRequestServiceType | null;
};

type SchedulePreviewInput = {
  customerType: EnumCustomerCustomerType;
  serviceType?: EnumDeliveryRequestServiceType | null;
  requestCreatedAt?: Date;
  distanceMiles?: number | null;
  etaMinutes?: number | null;
  customerChose: EnumDeliveryRequestCustomerChose;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
  afterHoursRequested?: boolean;
};

type TimeRange = {
  start: Date;
  end: Date;
};

type SlotCandidate = {
  label: string;
  start: Date;
  end: Date;
};

type DeliverySchedulePreviewInput = {
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  customerId?: string | null;
  customerType?: EnumCustomerCustomerType | null;
  customerChose: EnumDeliveryRequestCustomerChose;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
  afterHoursRequested?: boolean;
};

type QuotePreviewRow = {
  id: string;
  serviceType: EnumQuoteServiceType;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
};

type RouteMetricsLite = {
  distanceMiles: number | null;
  durationMinutes: number | null;
};

@Injectable()
export class SchedulingPolicyEngine {
  private readonly businessTimeZone = "America/Los_Angeles";

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService
  ) {}

  private businessNow(): DateTime {
    return DateTime.now().setZone(this.businessTimeZone);
  }

  private toBusinessDateTime(value: Date | string): DateTime {
    if (value instanceof Date) {
      return DateTime.fromJSDate(value).setZone(this.businessTimeZone);
    }

    return DateTime.fromISO(value, { zone: this.businessTimeZone });
  }

  async resolveEffectivePolicy(input: EffectivePolicyInput) {
    const customerType = this.mapCustomerType(input.customerType);
    const serviceType = this.mapServiceType(input.serviceType);

    const exact = await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType,
        serviceType,
      },
      orderBy: { createdAt: "desc" },
    });

    if (exact) {
      return exact;
    }

    const fallback = await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType,
        serviceType: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!fallback) {
      throw new AppException(
        "No active scheduling policy found for this customer type/service type",
        ErrorCodes.NOT_FOUND
      );
    }

    return fallback;
  }

  async previewDeliverySchedule(
    input: DeliverySchedulePreviewInput
  ): Promise<SchedulePreviewResponseBody> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        serviceType: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
      },
    });

    if (!quote) {
      throw new AppException("Quote not found", ErrorCodes.NOT_FOUND);
    }

    this.assertQuoteMatchesDeliveryServiceType(
      quote.serviceType,
      input.serviceType
    );

    this.validatePreviewWindowPair(
      input.pickupWindowStart ?? null,
      input.pickupWindowEnd ?? null,
      "pickup window"
    );

    this.validatePreviewWindowPair(
      input.dropoffWindowStart ?? null,
      input.dropoffWindowEnd ?? null,
      "dropoff window"
    );

    const resolvedCustomerType = await this.resolvePreviewCustomerType({
      customerId: input.customerId ?? null,
      customerType: input.customerType ?? null,
    });

    const routeMetrics = await this.resolveQuoteRouteMetrics(quote);

    const preview = await this.previewSchedule({
      customerType: resolvedCustomerType,
      serviceType: input.serviceType,
      requestCreatedAt: this.businessNow().toJSDate(),
      distanceMiles: routeMetrics.distanceMiles,
      etaMinutes: routeMetrics.durationMinutes,
      customerChose: input.customerChose,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
      afterHoursRequested: input.afterHoursRequested ?? false,
    });
    return this.mapPreviewToResponse(preview, routeMetrics.durationMinutes);
  }

  async previewSchedule(input: SchedulePreviewInput) {
    const requestCreatedAt = (
      input.requestCreatedAt
        ? this.toBusinessDateTime(input.requestCreatedAt)
        : this.businessNow()
    ).startOf("minute");

    const policy = await this.resolveEffectivePolicy({
      customerType: input.customerType,
      serviceType: input.serviceType ?? null,
    });

    const operatingHours = await this.prisma.operatingHour.findMany({
      where: { active: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const slotTemplates = await this.prisma.timeSlotTemplate.findMany({
      where: { active: true },
      orderBy: { startTime: "asc" },
    });

    if (operatingHours.length === 0) {
      throw new AppException(
        "No active operating hours configured",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (slotTemplates.length === 0) {
      throw new AppException(
        "No active time slot templates configured",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    const reasons: string[] = [];
    const warnings: string[] = [];

    const distanceMiles = input.distanceMiles ?? null;
    const etaMinutes = input.etaMinutes ?? null;
    const bufferMinutes = policy.bufferMinutes ?? 30;
    const totalTravelMinutes = (etaMinutes ?? 0) + bufferMinutes;

    let sameDayEligible =
      policy.defaultMode === EnumSchedulingPolicyDefaultMode.SAME_DAY;

    if (
      distanceMiles !== null &&
      policy.maxSameDayMiles !== null &&
      distanceMiles > policy.maxSameDayMiles
    ) {
      sameDayEligible = false;
      reasons.push("DISTANCE_EXCEEDS_SAME_DAY_LIMIT");
    }

    if (!this.isWithinCutoff(requestCreatedAt.toJSDate(), policy.sameDayCutoffTime)) {
      sameDayEligible = false;
      reasons.push("CUT_OFF_PASSED");
    }

    const afterHoursRequested = !!input.afterHoursRequested;
    let requiresOpsConfirmation = !!policy.requiresOpsConfirmation;
    let afterHours = afterHoursRequested;

    if (afterHoursRequested && !policy.afterHoursEnabled) {
      requiresOpsConfirmation = true;
      reasons.push("AFTER_HOURS_REQUIRES_OPS_CONFIRMATION");
    }

    const baseDate = this.getBaseScheduleDate(
      requestCreatedAt.toJSDate(),
      policy.defaultMode,
      sameDayEligible
    );

    // Try up to 7 days forward to find a day with operating hours + available slots
    const suggestedPickupSlots = this.buildSuggestedSlotsMultiDay(
      baseDate,
      slotTemplates,
      operatingHours,
      7
    );

    const actualSlotDate = this.resolveSlotDate(
      baseDate,
      slotTemplates,
      operatingHours,
      7
    );

    const sameDayStatus =
      policy.defaultMode === EnumSchedulingPolicyDefaultMode.SAME_DAY &&
      sameDayEligible &&
      actualSlotDate &&
      this.toBusinessDateTime(actualSlotDate).hasSame(
        this.toBusinessDateTime(requestCreatedAt.toJSDate()),
        "day"
      )
        ? "SAME_DAY"
        : "NEXT_DAY";

    const chosenDirection = input.customerChose;

    const hasPickupWindow = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoffWindow =
      !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    const suggestedDropoffSlots = suggestedPickupSlots.map((slot) => ({
      ...slot,
      start: this.addMinutes(slot.start, totalTravelMinutes),
      end: this.addMinutes(slot.end, totalTravelMinutes),
    }));

    if (
      (chosenDirection === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW &&
        !hasPickupWindow) ||
      (chosenDirection === EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW &&
        !hasDropoffWindow)
    ) {
      return {
        feasible: true,
        message: null,
        policy,
        sameDayStatus,
        sameDayEligible,
        afterHours,
        requiresOpsConfirmation,
        totalTravelMinutes,
        bufferMinutes,
        reasons,
        warnings,
        requested: {
          customerChose: chosenDirection,
          pickupWindowStart: input.pickupWindowStart ?? null,
          pickupWindowEnd: input.pickupWindowEnd ?? null,
          dropoffWindowStart: input.dropoffWindowStart ?? null,
          dropoffWindowEnd: input.dropoffWindowEnd ?? null,
          requestCreatedAt: requestCreatedAt.toJSDate(),
          distanceMiles,
          etaMinutes,
        },
        resolved: {
          pickupWindowStart: null,
          pickupWindowEnd: null,
          dropoffWindowStart: null,
          dropoffWindowEnd: null,
        },
        matchedSlots: {
          pickup: null,
          dropoff: null,
        },
        suggestedSlots: {
          pickup: suggestedPickupSlots,
          dropoff: suggestedDropoffSlots,
        },
      };
    }

    let resolvedPickup: TimeRange;
    let resolvedDropoff: TimeRange;

    if (chosenDirection === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW) {
      if (!input.pickupWindowStart || !input.pickupWindowEnd) {
        throw new AppException(
          "pickupWindowStart and pickupWindowEnd are required when customerChose is PICKUP_WINDOW",
          ErrorCodes.INVALID_PARAMS
        );
      }

      resolvedPickup = {
        start: new Date(input.pickupWindowStart),
        end: new Date(input.pickupWindowEnd),
      };

      resolvedDropoff = {
        start: this.addMinutes(resolvedPickup.start, totalTravelMinutes),
        end: this.addMinutes(resolvedPickup.end, totalTravelMinutes),
      };
    } else {
      if (!input.dropoffWindowStart || !input.dropoffWindowEnd) {
        throw new AppException(
          "dropoffWindowStart and dropoffWindowEnd are required when customerChose is DROPOFF_WINDOW",
          ErrorCodes.INVALID_PARAMS
        );
      }

      resolvedDropoff = {
        start: new Date(input.dropoffWindowStart),
        end: new Date(input.dropoffWindowEnd),
      };

      resolvedPickup = {
        start: this.addMinutes(resolvedDropoff.start, -totalTravelMinutes),
        end: this.addMinutes(resolvedDropoff.end, -totalTravelMinutes),
      };
    }

    const pickupCheck = this.checkWindowAgainstOperatingHours(
      resolvedPickup,
      operatingHours
    );
    const dropoffCheck = this.checkWindowAgainstOperatingHours(
      resolvedDropoff,
      operatingHours
    );

    if (!pickupCheck.withinHours) {
      afterHours = true;
      reasons.push("PICKUP_OUTSIDE_OPERATING_HOURS");
      if (!policy.afterHoursEnabled) {
        requiresOpsConfirmation = true;
      }
    }

    if (!dropoffCheck.withinHours) {
      afterHours = true;
      reasons.push("DROPOFF_OUTSIDE_OPERATING_HOURS");
      if (!policy.afterHoursEnabled) {
        requiresOpsConfirmation = true;
      }
    }

    const pickupSlotMatch = this.findMatchingSlot(resolvedPickup, slotTemplates);
    const dropoffSlotMatch = this.findMatchingSlot(
      resolvedDropoff,
      slotTemplates
    );

    if (!pickupSlotMatch) {
      warnings.push("PICKUP_WINDOW_DOES_NOT_MATCH_CONFIGURED_SLOT_TEMPLATE");
    }

    if (!dropoffSlotMatch) {
      warnings.push("DROPOFF_WINDOW_DOES_NOT_MATCH_CONFIGURED_SLOT_TEMPLATE");
    }

    return {
      feasible: true,
      message: null,
      policy,
      sameDayStatus,
      sameDayEligible,
      afterHours,
      requiresOpsConfirmation,
      totalTravelMinutes,
      bufferMinutes,
      reasons,
      warnings,
      requested: {
        customerChose: chosenDirection,
        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,
        requestCreatedAt: requestCreatedAt.toJSDate(),
        distanceMiles,
        etaMinutes,
      },
      resolved: {
        pickupWindowStart: resolvedPickup.start,
        pickupWindowEnd: resolvedPickup.end,
        dropoffWindowStart: resolvedDropoff.start,
        dropoffWindowEnd: resolvedDropoff.end,
      },
      matchedSlots: {
        pickup: pickupSlotMatch,
        dropoff: dropoffSlotMatch,
      },
      suggestedSlots: {
        pickup: suggestedPickupSlots,
        dropoff: suggestedDropoffSlots,
      },
    };
  }

  private mapCustomerType(
    value: EnumCustomerCustomerType
  ): EnumSchedulingPolicyCustomerType {
    return value === EnumCustomerCustomerType.BUSINESS
      ? EnumSchedulingPolicyCustomerType.BUSINESS
      : EnumSchedulingPolicyCustomerType.PRIVATE;
  }

  private mapServiceType(
    value?: EnumDeliveryRequestServiceType | null
  ): EnumSchedulingPolicyServiceType | null {
    if (!value) return null;

    switch (value) {
      case EnumDeliveryRequestServiceType.HOME_DELIVERY:
        return EnumSchedulingPolicyServiceType.HOME_DELIVERY;
      case EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS:
        return EnumSchedulingPolicyServiceType.BETWEEN_LOCATIONS;
      case EnumDeliveryRequestServiceType.SERVICE_PICKUP_RETURN:
        return EnumSchedulingPolicyServiceType.SERVICE_PICKUP_RETURN;
      default:
        return null;
    }
  }

  private parseHHmm(
    value?: string | null
  ): { hour: number; minute: number } | null {
    if (!value) return null;
    const trimmed = value.trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!match) return null;

    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
    };
  }

  private isWithinCutoff(date: Date, cutoff?: string | null): boolean {
    if (!cutoff) return true;
    const parsed = this.parseHHmm(cutoff);
    if (!parsed) return false;

    const businessDate = this.toBusinessDateTime(date);
    const compare = businessDate.set({
      hour: parsed.hour,
      minute: parsed.minute,
      second: 0,
      millisecond: 0,
    });

    return businessDate.toMillis() <= compare.toMillis();
  }

  private getBaseScheduleDate(
    requestCreatedAt: Date,
    defaultMode: EnumSchedulingPolicyDefaultMode,
    sameDayEligible: boolean
  ): Date {
    const businessDate = this.toBusinessDateTime(requestCreatedAt);

    const shouldUseSameDay =
      defaultMode === EnumSchedulingPolicyDefaultMode.SAME_DAY &&
      sameDayEligible;

    return (shouldUseSameDay
      ? businessDate.startOf("day")
      : businessDate.plus({ days: 1 }).startOf("day")
    ).toJSDate();
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private checkWindowAgainstOperatingHours(
    window: TimeRange,
    operatingHours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  ) {
    const day = this.toPolicyDayOfWeek(window.start);
    const hours = operatingHours.filter((row) => row.dayOfWeek === day);

    if (hours.length === 0) {
      return { withinHours: false };
    }

    for (const hour of hours) {
      const start = this.applyTime(window.start, hour.startTime);
      const end = this.applyTime(window.start, hour.endTime);

      if (
        window.start.getTime() >= start.getTime() &&
        window.end.getTime() <= end.getTime()
      ) {
        return { withinHours: true };
      }
    }

    return { withinHours: false };
  }

  private findMatchingSlot(
    window: TimeRange,
    slotTemplates: Array<{ label: string; startTime: string; endTime: string }>
  ) {
    
    const startHHmm = this.toHHmm(window.start);
    const endHHmm = this.toHHmm(window.end);

    const slot = slotTemplates.find(
      (row) => row.startTime === startHHmm && row.endTime === endHHmm
    );

    if (!slot) return null;

    return {
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  }

  /**
   * Try building slots across multiple consecutive days (up to maxDays).
   * Returns slots for the FIRST day that has at least one valid slot.
   * This prevents "no slots" when the target day has no operating hours
   * but other days in the week do.
   */
  private buildSuggestedSlotsMultiDay(
    baseDate: Date,
    slotTemplates: Array<{ label: string; startTime: string; endTime: string }>,
    operatingHours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  >,
    maxDays: number = 7
  ): SlotCandidate[] {
    for (let d = 0; d < maxDays; d++) {
      const candidateDate = this.addMinutes(baseDate, d * 24 * 60);
      const slots = this.buildSuggestedSlots(
        candidateDate,
        slotTemplates,
        operatingHours
      );
      if (slots.length > 0) {
        return slots;
      }
    }
    return [];
  }

  /**
   * Find the first date (within maxDays of baseDate) that yields
   * at least one valid slot. Used to determine sameDay vs nextDay status.
   */
  private resolveSlotDate(
    baseDate: Date,
    slotTemplates: Array<{ label: string; startTime: string; endTime: string }>,
    operatingHours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  >,
    maxDays: number = 7
  ): Date | null {
    for (let d = 0; d < maxDays; d++) {
      const candidateDate = this.addMinutes(baseDate, d * 24 * 60);
      const slots = this.buildSuggestedSlots(
        candidateDate,
        slotTemplates,
        operatingHours
      );
      if (slots.length > 0) {
        return candidateDate;
      }
    }
    return null;
  }

  private buildSuggestedSlots(
    baseDate: Date,
    slotTemplates: Array<{ label: string; startTime: string; endTime: string }>,
    operatingHours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  ): SlotCandidate[] {
    return slotTemplates
      .map((slot) => ({
        label: slot.label,
        start: this.applyTime(baseDate, slot.startTime),
        end: this.applyTime(baseDate, slot.endTime),
      }))
      .filter(
        (slot) =>
          this.checkWindowAgainstOperatingHours(slot, operatingHours).withinHours
      );
  }

  private applyTime(date: Date, hhmm: string): Date {
    const parsed = this.parseHHmm(hhmm);
    if (!parsed) {
      throw new AppException(
        `Invalid HH:mm value '${hhmm}'`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    return this.toBusinessDateTime(date)
      .set({
        hour: parsed.hour,
        minute: parsed.minute,
        second: 0,
        millisecond: 0,
      })
      .toJSDate();
  }

  private toHHmm(date: Date): string {
    return this.toBusinessDateTime(date).toFormat("HH:mm");
  }

  /**
   * Schema uses Int dayOfWeek on OperatingHour.
   * This implementation assumes 1=Monday ... 7=Sunday.
   * If your seed uses 0=Sunday ... 6=Saturday, adjust this one method only.
   */
  private toPolicyDayOfWeek(date: Date): number {
    return this.toBusinessDateTime(date).weekday;
  }

  private async resolvePreviewCustomerType(input: {
    customerId?: string | null;
    customerType?: EnumCustomerCustomerType | null;
  }): Promise<EnumCustomerCustomerType> {
    if (input.customerType) {
      return input.customerType;
    }

    if (!input.customerId) {
      return EnumCustomerCustomerType.BUSINESS;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
      },
    });

    if (!customer) {
      throw new AppException("Customer not found", ErrorCodes.NOT_FOUND);
    }

    return customer.customerType;
  }

  private async resolveQuoteRouteMetrics(
    quote: QuotePreviewRow
  ): Promise<RouteMetricsLite> {
    if (
      quote.pickupLat == null ||
      quote.pickupLng == null ||
      quote.dropoffLat == null ||
      quote.dropoffLng == null
    ) {
      return {
        distanceMiles: null,
        durationMinutes: null,
      };
    }

    const routeMetrics = await this.googleMapsService.computeRouteMetrics({
      originLat: quote.pickupLat,
      originLng: quote.pickupLng,
      destinationLat: quote.dropoffLat,
      destinationLng: quote.dropoffLng,
    });

    return {
      distanceMiles: routeMetrics.distanceMiles ?? null,
      durationMinutes: routeMetrics.durationMinutes ?? null,
    };
  }

  private validatePreviewWindowPair(
    start: Date | null,
    end: Date | null,
    label: string
  ): void {
    if (!start && !end) {
      return;
    }

    if (!start || !end) {
      throw new AppException(
        `${label} start and end must both be provided`,
        ErrorCodes.INVALID_PARAMS
      );
    }

    if (start.getTime() >= end.getTime()) {
      throw new AppException(
        `${label} start must be before end`,
        ErrorCodes.INVALID_PARAMS
      );
    }
  }

  private mapDeliveryServiceTypeToQuoteServiceType(
    value: EnumDeliveryRequestServiceType
  ): EnumQuoteServiceType {
    if (value === EnumDeliveryRequestServiceType.HOME_DELIVERY) {
      return EnumQuoteServiceType.HOME_DELIVERY;
    }

    if (value === EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS) {
      return EnumQuoteServiceType.BETWEEN_LOCATIONS;
    }

    return EnumQuoteServiceType.SERVICE_PICKUP_RETURN;
  }

  private assertQuoteMatchesDeliveryServiceType(
    quoteServiceType: EnumQuoteServiceType,
    deliveryServiceType: EnumDeliveryRequestServiceType
  ): void {
    const expected = this.mapDeliveryServiceTypeToQuoteServiceType(
      deliveryServiceType
    );

    if (quoteServiceType !== expected) {
      throw new AppException(
        "Selected service type does not match the quote",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private mapPreviewToResponse(
    preview: any,
    etaMinutes: number | null
  ): SchedulePreviewResponseBody {
    return {
      feasible: preview.feasible,
      message: preview.message ?? null,

      pickupWindowStart: preview.resolved?.pickupWindowStart ?? null,
      pickupWindowEnd: preview.resolved?.pickupWindowEnd ?? null,
      dropoffWindowStart: preview.resolved?.dropoffWindowStart ?? null,
      dropoffWindowEnd: preview.resolved?.dropoffWindowEnd ?? null,

      etaMinutes,
      bufferMinutes: preview.bufferMinutes ?? 0,
      sameDayEligible: preview.sameDayEligible,
      requiresOpsConfirmation: preview.requiresOpsConfirmation,
      afterHours: preview.afterHours,

      policy: preview.policy
        ? {
            id: preview.policy.id,
            serviceType: preview.policy.serviceType ?? null,
            customerType: preview.policy.customerType,
            defaultMode: preview.policy.defaultMode,
            sameDayCutoffTime: preview.policy.sameDayCutoffTime ?? null,
            maxSameDayMiles: preview.policy.maxSameDayMiles ?? null,
            bufferMinutes: preview.policy.bufferMinutes ?? 0,
            afterHoursEnabled: preview.policy.afterHoursEnabled,
            requiresOpsConfirmation: preview.policy.requiresOpsConfirmation,
          }
        : null,

      sameDay: {
        eligible: preview.sameDayEligible,
        status: preview.sameDayStatus,
        reasons: preview.reasons ?? [],
        warnings: preview.warnings ?? [],
      },

      matchedSlots: {
        pickup: preview.matchedSlots?.pickup
          ? {
              label: preview.matchedSlots.pickup.label,
              start: preview.resolved?.pickupWindowStart,
              end: preview.resolved?.pickupWindowEnd,
            }
          : null,
        dropoff: preview.matchedSlots?.dropoff
          ? {
              label: preview.matchedSlots.dropoff.label,
              start: preview.resolved?.dropoffWindowStart,
              end: preview.resolved?.dropoffWindowEnd,
            }
          : null,
      },

      suggestedSlots: {
        pickup: (preview.suggestedSlots?.pickup ?? []).map((slot: any) => ({
          label: slot.label,
          start: slot.start,
          end: slot.end,
        })),
        dropoff: (preview.suggestedSlots?.dropoff ?? []).map((slot: any) => ({
          label: slot.label,
          start: slot.start,
          end: slot.end,
        })),
      },
    };
  }
}