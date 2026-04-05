import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Agent } from "undici";

type GoogleGeocodeAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodeResultItem = {
  formatted_address?: string;
  place_id?: string;
  address_components?: GoogleGeocodeAddressComponent[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResultItem[];
  error_message?: string;
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: unknown;
};

export type GeocodeResult = {
  formattedAddress: string;
  placeId?: string | null;
  lat: number;
  lng: number;
  stateCode?: string | null;
  stateName?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  city?: string | null;
  isCalifornia: boolean;
};

export type RouteMetrics = {
  distanceMeters: number;
  distanceMiles: number;
  durationSeconds: number;
  durationMinutes: number;
  polyline?: string | null;
};

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  private readonly googleDispatcher = new Agent({
    connectTimeout: 20_000,
    connect: {
      family: 4,
    },
  });

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>("GOOGLE_MAPS_API_KEY");

    this.logger.debug(
      `GOOGLE_MAPS_API_KEY present: ${Boolean(key)}${
        key ? `, length=${key.length}` : ""
      }`
    );

    if (!key) {
      throw new InternalServerErrorException(
        "GOOGLE_MAPS_API_KEY is not configured"
      );
    }

    return key;
  }

  private maskUrl(value: string): string {
    try {
      const url = new URL(value);
      if (url.searchParams.has("key")) {
        url.searchParams.set("key", "***MASKED***");
      }
      return url.toString();
    } catch {
      return value.replace(/key=[^&]+/gi, "key=***MASKED***");
    }
  }

  private serializeError(error: any) {
    return {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      cause:
        error?.cause && typeof error.cause === "object"
          ? {
              name: error.cause?.name,
              message: error.cause?.message,
              code: error.cause?.code,
              errno: error.cause?.errno,
              syscall: error.cause?.syscall,
              hostname: error.cause?.hostname,
              address: error.cause?.address,
              port: error.cause?.port,
            }
          : error?.cause,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      hostname: error?.hostname,
      address: error?.address,
      port: error?.port,
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 20_000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        dispatcher: this.googleDispatcher as any,
      } as any);
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocodeAddressOrThrow(address: string): Promise<GeocodeResult> {
    const clean = (address ?? "").trim();
    if (!clean) {
      throw new BadRequestException("Address is required");
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", clean);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("region", "us");
    url.searchParams.set("components", "country:US");

    const maskedUrl = this.maskUrl(url.toString());

    this.logger.debug(
      `Geocode request starting. address="${clean}", url="${maskedUrl}"`
    );

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        url.toString(),
        {
          method: "GET",
          redirect: "manual",
        },
        20_000
      );
    } catch (error: any) {
      this.logger.error(
        `Geocode fetch failed. address="${clean}", url="${maskedUrl}", error=${JSON.stringify(
          this.serializeError(error)
        )}`
      );

      throw new InternalServerErrorException(
        `Unable to reach Google Geocoding API: ${
          error?.cause?.code || error?.code || error?.message || "unknown error"
        }`
      );
    }

    this.logger.debug(
      `Geocode response received. status=${response.status}, ok=${response.ok}, statusText="${response.statusText}"`
    );

    const rawBody = await response.text();
    this.logger.debug(`Geocode raw response body: ${rawBody}`);

    if (!response.ok) {
      this.logger.error(
        `Geocode failed with HTTP status ${response.status}. Body: ${rawBody}`
      );
      throw new InternalServerErrorException("Unable to geocode address");
    }

    let data: GoogleGeocodeResponse;
    try {
      data = JSON.parse(rawBody) as GoogleGeocodeResponse;
    } catch (error: any) {
      this.logger.error(
        `Failed to parse geocode response JSON. error=${JSON.stringify(
          this.serializeError(error)
        )}, body=${rawBody}`
      );
      throw new InternalServerErrorException(
        "Invalid response from Google Geocoding API"
      );
    }

    this.logger.debug(
      `Parsed geocode response summary: status="${data.status}", resultsCount=${
        Array.isArray(data.results) ? data.results.length : 0
      }, errorMessage="${data.error_message ?? ""}"`
    );

    if (
      data.status !== "OK" ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      this.logger.warn(
        `Address could not be resolved by Google. address="${clean}", status="${
          data.status
        }", errorMessage="${data.error_message ?? ""}", body=${rawBody}`
      );
      throw new BadRequestException("Address could not be resolved");
    }

    const first = data.results[0];
    const components = Array.isArray(first.address_components)
      ? first.address_components
      : [];

    const getByType = (type: string) =>
      components.find(
        (component) =>
          Array.isArray(component.types) && component.types.includes(type)
      );

    const state = getByType("administrative_area_level_1");
    const city =
      getByType("locality") ??
      getByType("postal_town") ??
      getByType("administrative_area_level_2");
    const country = getByType("country");
    const postalCode = getByType("postal_code");

    const stateCode = state?.short_name ?? null;
    const countryCode = country?.short_name ?? null;
    const lat = first.geometry?.location?.lat;
    const lng = first.geometry?.location?.lng;

    this.logger.debug(
      `Geocode resolved. formattedAddress="${
        first.formatted_address ?? ""
      }", placeId="${first.place_id ?? ""}", stateCode="${
        stateCode ?? ""
      }", countryCode="${countryCode ?? ""}", city="${
        city?.long_name ?? ""
      }", postalCode="${postalCode?.long_name ?? ""}", lat=${lat}, lng=${lng}`
    );

    if (
      typeof first.formatted_address !== "string" ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      this.logger.error(
        `Resolved address missing required geo fields. formatted_address="${first.formatted_address}", lat=${lat}, lng=${lng}`
      );
      throw new BadRequestException("Resolved address is missing geo coordinates");
    }

    const isCalifornia = stateCode === "CA" && countryCode === "US";

    this.logger.debug(
      `California validation computed. isCalifornia=${isCalifornia}`
    );

    return {
      formattedAddress: first.formatted_address,
      placeId: first.place_id ?? null,
      lat,
      lng,
      stateCode,
      stateName: state?.long_name ?? null,
      countryCode,
      postalCode: postalCode?.long_name ?? null,
      city: city?.long_name ?? null,
      isCalifornia,
    };
  }

  async validateCaliforniaAddressOrThrow(
    address: string
  ): Promise<GeocodeResult> {
    this.logger.debug(
      `validateCaliforniaAddressOrThrow called. address="${address}"`
    );

    const geo = await this.geocodeAddressOrThrow(address);

    if (!geo.isCalifornia) {
      this.logger.warn(
        `Address resolved outside California. formattedAddress="${geo.formattedAddress}", stateCode="${geo.stateCode}", countryCode="${geo.countryCode}"`
      );
      throw new BadRequestException(
        "Only California pickup and drop-off addresses are allowed"
      );
    }

    this.logger.debug(
      `Address passed California validation. formattedAddress="${geo.formattedAddress}"`
    );

    return geo;
  }

  async computeRouteMetrics(input: {
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
  }): Promise<RouteMetrics> {
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: input.originLat,
            longitude: input.originLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: input.destinationLat,
            longitude: input.destinationLng,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "IMPERIAL",
    };

    this.logger.debug(
      `Routes request starting. origin=(${input.originLat}, ${input.originLng}), destination=(${input.destinationLat}, ${input.destinationLng}), apiKeyPresent=${Boolean(
        this.configService.get("GOOGLE_MAPS_API_KEY")
      )}, body=${JSON.stringify(requestBody)}`
    );

    let response: Response;

    try {
      response = await this.fetchWithTimeout(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask":
              "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline",
          },
          body: JSON.stringify(requestBody),
          redirect: "manual",
        },
        20_000
      );
    } catch (error: any) {
      this.logger.error(
        `Routes fetch failed. error=${JSON.stringify(
          this.serializeError(error)
        )}, origin=(${input.originLat}, ${input.originLng}), destination=(${input.destinationLat}, ${input.destinationLng})`
      );

      throw new InternalServerErrorException(
        `Unable to reach Google Routes API: ${
          error?.cause?.code || error?.code || error?.message || "unknown error"
        }`
      );
    }

    this.logger.debug(
      `Routes response received. status=${response.status}, ok=${response.ok}, statusText="${response.statusText}"`
    );

    const rawBody = await response.text();
    this.logger.debug(`Routes raw response body: ${rawBody}`);

    if (!response.ok) {
      this.logger.error(
        `Routes API failed with HTTP status ${response.status}: ${rawBody}`
      );
      throw new InternalServerErrorException("Unable to calculate route");
    }

    let data: GoogleRoutesResponse;
    try {
      data = JSON.parse(rawBody) as GoogleRoutesResponse;
    } catch (error: any) {
      this.logger.error(
        `Failed to parse routes response JSON. error=${JSON.stringify(
          this.serializeError(error)
        )}, body=${rawBody}`
      );
      throw new InternalServerErrorException(
        "Invalid response from Google Routes API"
      );
    }

    const route = data.routes?.[0];

    this.logger.debug(`Routes parsed response: ${JSON.stringify(data)}`);
    this.logger.debug(`Routes first route: ${JSON.stringify(route)}`);

    if (!route || typeof route.distanceMeters !== "number") {
      this.logger.error(
        `Route result incomplete. First route: ${JSON.stringify(route)}`
      );
      throw new InternalServerErrorException("Route result is incomplete");
    }

    const durationRaw =
      typeof route.duration === "string"
        ? route.duration
        : typeof route.staticDuration === "string"
          ? route.staticDuration
          : null;

    if (!durationRaw) {
      this.logger.error(
        `Route duration missing. Route payload: ${JSON.stringify(route)}`
      );
      throw new InternalServerErrorException("Route duration is missing");
    }

    const distanceMeters = route.distanceMeters;
    const durationSeconds = this.parseGoogleDurationToSeconds(durationRaw);

    this.logger.debug(
      `Route metrics computed. distanceMeters=${distanceMeters}, distanceMiles=${this.metersToMiles(
        distanceMeters
      )}, durationRaw="${durationRaw}", durationSeconds=${durationSeconds}, durationMinutes=${Math.ceil(
        durationSeconds / 60
      )}, polylinePresent=${Boolean(route.polyline?.encodedPolyline)}`
    );

    return {
      distanceMeters,
      distanceMiles: this.metersToMiles(distanceMeters),
      durationSeconds,
      durationMinutes: Math.ceil(durationSeconds / 60),
      polyline: route.polyline?.encodedPolyline ?? null,
    };
  }

  private metersToMiles(value: number): number {
    return Number((value / 1609.344).toFixed(2));
  }

  private parseGoogleDurationToSeconds(raw: string): number {
    if (!raw.endsWith("s")) {
      this.logger.warn(`Unexpected Google duration format: "${raw}"`);
      return 0;
    }

    const numeric = Number(raw.slice(0, -1));

    if (!Number.isFinite(numeric)) {
      this.logger.warn(`Invalid numeric duration from Google: "${raw}"`);
      return 0;
    }

    return numeric;
  }
}