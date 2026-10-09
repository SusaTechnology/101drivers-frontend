/**
 * useRequestDelivery — the single behavior behind every public
 * "Request a Delivery" CTA (navbar, right hemisphere nav, privacy/terms
 * pages).
 *
 * Contract (product spec):
 *  • Logged-in CUSTOMER → open the delivery request page directly
 *    ("/dealer-create-delivery") — skip any signup step.
 *  • Logged-in DRIVER / ADMIN → they cannot place deliveries; land them on
 *    their own dashboard instead of a page that would error out.
 *  • Logged-out → the landing page's delivery-type chooser (#quote) IS the
 *    gate. If the chooser is on the current page, smooth-scroll to it (same
 *    idiom the landing page uses internally); from any other page, go to
 *    "/home#quote". Addresses live on the landing page, so nothing can be
 *    "carried" from here — the chooser + quoteDraft flow handles carry-over.
 *  • Never navigates back to a generic home state, never burns a quote.
 */
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getUser, isAuthenticated } from "@/lib/tanstack/dataQuery";

export const CUSTOMER_ROLES = ["BUSINESS_CUSTOMER", "PRIVATE_CUSTOMER"];

function scrollToQuoteChooser() {
  document
    .getElementById("quote")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function useRequestDelivery() {
  const navigate = useNavigate();

  const requestDelivery = useCallback(() => {
    if (isAuthenticated()) {
      const roles = getUser()?.roles ?? [];
      if (roles.some((role) => CUSTOMER_ROLES.includes(role))) {
        navigate({ to: "/dealer-create-delivery" });
      } else if (roles.includes("DRIVER")) {
        navigate({ to: "/driver/dashboard" });
      } else if (roles.includes("ADMIN")) {
        navigate({ to: "/admin-dashboard" });
      } else {
        // Unknown role combination — the chooser is a safe fallback.
        scrollToQuoteChooser();
        navigate({ to: "/home#quote" });
      }
      return;
    }
    // Logged out — the chooser on the landing page is step 1 of the gate.
    if (document.getElementById("quote")) {
      scrollToQuoteChooser();
      return;
    }
    navigate({ to: "/home#quote" });
  }, [navigate]);

  return { requestDelivery };
}
