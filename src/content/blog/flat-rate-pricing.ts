import type { BlogPost } from "../types";

/**
 * "How our flat-rate pricing works" — content preserved verbatim from the
 * sample posts the owner pushed; only the card metadata (slug, date,
 * excerpt, cover) was added when the blog moved to the registry pattern.
 */
export const flatRatePricing: BlogPost = {
  slug: "how-flat-rate-pricing-works",
  title: "How our flat-rate pricing works",
  date: "2026-09-05",
  excerpt:
    "The price you see is the price you pay — how a flat-rate quote is built from pickup and drop-off zones, vehicle type, and service level, and why nobody renegotiates mid-delivery.",
  image: "/assets/angle-1-left-front.jpeg",
  imageAlt: "Vehicle ready for pickup — front-left inspection angle",
  body: [
    {
      type: "p",
      text: "Every quote on 101 Drivers is flat-rate: the price you see is the price you pay, regardless of the traffic, the route the driver takes, or how many tolls show up on the way.",
    },
    {
      type: "p",
      text: "The rate is built from the pickup and drop-off zones, the vehicle type, and the service level you choose. Because drivers see the full route and payout before accepting a job, nobody renegotiates mid-delivery — that is the whole point.",
    },
    {
      type: "p",
      text: "If anything about your quote looks off, contact us before confirming. Changing a booked delivery later can change the price; changing it before booking never does.",
    },
  ],
};
