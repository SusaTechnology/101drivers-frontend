/**
 * Tiny date formatter for public content (blog / news). ISO dates are
 * stored in the content registries; this renders them for humans.
 * Pinned to UTC so the displayed day never shifts with the viewer's
 * timezone.
 */
const formatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatContentDate(isoDate: string): string {
  return formatter.format(new Date(`${isoDate}T00:00:00Z`));
}
