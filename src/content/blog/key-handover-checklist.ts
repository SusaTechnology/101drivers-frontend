import type { BlogPost } from "../types";

/** "5 things to check before handing over your keys" — sample post. */
export const keyHandoverChecklist: BlogPost = {
  slug: "key-handover-checklist",
  title: "5 things to check before handing over your keys",
  date: "2026-08-14",
  excerpt:
    "A five-point pre-pickup checklist: personal belongings, registration and insurance documents, fuel and odometer notes, a working key or fob, and who holds the delivery PIN.",
  image: "/assets/angle-3-passenger-side.jpeg",
  imageAlt: "Vehicle interior check — passenger-side inspection angle",
  body: [
    "First: remove personal belongings from the cabin and trunk. Drivers photograph the interior state at pickup, but loose items cannot be insured.",
    "Second: have the registration and insurance documents accessible. Third: note your fuel and odometer readings — the driver records them too, and matching records make any later dispute trivial.",
    "Fourth: ensure there is a working key or fob for the car — rekeying delays are the most common cause of same-day cancellations. Fifth: if someone else is at the pickup location, share the delivery PIN with them in advance so the driver can verify authorization.",
  ],
};
