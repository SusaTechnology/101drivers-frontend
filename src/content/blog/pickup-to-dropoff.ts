import type { BlogPost } from "../types";

/** "What happens between pickup and drop-off" — sample post. */
export const pickupToDropoff: BlogPost = {
  slug: "pickup-to-dropoff",
  title: "What happens between pickup and drop-off",
  date: "2026-07-09",
  excerpt:
    "Live tracking starts the moment the driver verifies the VIN. What gets GPS-stamped between pickup and drop-off, and when the full inspection report lands in your inbox.",
  image: "/assets/angle-6-driver-side.jpeg",
  imageAlt: "Vehicle en route — driver-side inspection angle",
  body: [
    "Once the driver enters the last four digits of the VIN, live tracking starts. Every material event — inspection photos, route progress, arrival — is stamped with GPS coordinates and time.",
    "You can follow the delivery from the public tracking link or your dashboard. If a delivery is ever late, the tracking page is the first place the new ETA appears.",
    "At drop-off the driver repeats the inspection: photos of the car, final odometer reading, and keys handed to the authorized person. You receive the full report by email within minutes.",
  ],
};
