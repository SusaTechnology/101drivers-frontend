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
 *  • Logged-out → the landing page's quote form (#quote) IS the gate.
 *    On the landing page we dispatch the "101drivers:activate-quote"
 *    event and homePage owns the visible response: with a delivery type
 *    on file it smooth-scrolls to the address card and FOCUSES the
 *    "From Where" input (its lime focus ring shows the form activate);
 *    without one it glows the delivery-type chooser instead (the address
 *    fields are disabled until a type is picked, so the chooser IS the
 *    next step). A bare scrollIntoView here used to be the whole story —
 *    it moved the page with zero other feedback, which read as broken.
 *    From any other page, go to "/home#quote"; the landing page runs the
 *    same activation on arrival. Addresses live on the landing page, so
 *    nothing can be "carried" from here — the chooser + quoteDraft flow
 *    handles carry-over.
 *  • Never navigates back to a generic home state, never burns a quote.
 */
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getUser, isAuthenticated } from "@/lib/tanstack/dataQuery";

export const CUSTOMER_ROLES = ["BUSINESS_CUSTOMER", "PRIVATE_CUSTOMER"];

/** Event homePage listens for to run the type-aware form activation. */
export const ACTIVATE_QUOTE_EVENT = "101drivers:activate-quote";

/**
 * Which signup card in the #dealers section ("Choose your delivery type")
 * should show as selected. Dispatched by the navbar's Business/Personal
 * tabs — both land on the SAME section now, so the clicked tab is
 * expressed by coloring the matching card (dark + lime ring + check).
 */
export const SELECT_SIGNUP_CARD_EVENT = "101drivers:select-signup-card";

export type SignupCard = "BUSINESS" | "PERSONAL";

/**
 * The landing page is mounted (its #dealers section exists) and therefore
 * listens for this event — highlight the matching signup card.
 */
export function selectSignupCardOnLanding(card: SignupCard) {
  window.dispatchEvent(new CustomEvent(SELECT_SIGNUP_CARD_EVENT, { detail: { card } }));
}

/**
 * The landing page is mounted (its #quote section exists) and therefore
 * listens for the activation event — let IT decide what the visitor sees,
 * based on whether a delivery type is already on file.
 */
function activateQuoteFormOnLanding() {
  window.dispatchEvent(new CustomEvent(ACTIVATE_QUOTE_EVENT));
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
        if (document.getElementById("quote")) {
          activateQuoteFormOnLanding();
        } else {
          navigate({ to: "/home#quote" });
        }
      }
      return;
    }
    // Logged out — the quote form on the landing page is step 1 of the
    // gate. On the landing page, activate it (scroll + focus/glow); from
    // any other page, navigate there — the landing page runs the same
    // activation when it mounts with the #quote hash.
    if (document.getElementById("quote")) {
      activateQuoteFormOnLanding();
      return;
    }
    navigate({ to: "/home#quote" });
  }, [navigate]);

  return { requestDelivery };
}
