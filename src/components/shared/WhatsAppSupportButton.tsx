import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * WhatsApp click-to-chat link for the operations team.
 *
 * This is a wa.me short link — on mobile it opens the WhatsApp app
 * directly into a chat with 101 Drivers Support; on desktop it opens
 * WhatsApp Web. No phone number is exposed in the markup (the link is
 * issued by WhatsApp Business and can be rotated from the Meta portal
 * without a code change).
 */
export const WHATSAPP_SUPPORT_URL = 'https://wa.me/message/YQXTDFV6STKUP1';

/**
 * Official WhatsApp glyph (simple-icons path). lucide-react does not
 * ship brand icons, so this is an inline SVG that inherits currentColor.
 */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

interface WhatsAppSupportButtonProps {
  /** Button label. Defaults to the clearest call-to-action. */
  label?: string;
  /** Extra classes for the wrapper anchor. */
  className?: string;
  /** Extra classes for the inner Button. */
  buttonClassName?: string;
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Green-on-light WhatsApp CTA that opens a chat with 101 Drivers Support.
 *
 * Contrast-corrected per product feedback: the label and icon are GREEN
 * (emerald-700 on the white button in light mode = 5:1 contrast; brand
 * #25D366 on slate-900 in dark mode = ~10:1) instead of white — white
 * text washed out on bright backgrounds. The green border + icon keep
 * the WhatsApp identity in both modes.
 *
 * Rendered as a real <a target="_blank"> so middle-click / long-press
 * "open in new tab" still works. rel="noopener noreferrer" because the
 * href leaves the origin.
 */
export function WhatsAppSupportButton({
  label = 'Message us on WhatsApp',
  className,
  buttonClassName,
  size = 'default',
}: WhatsAppSupportButtonProps) {
  return (
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens WhatsApp in a new tab. On a phone it opens the app; on a PC or iPad it opens WhatsApp Web in your browser."
      aria-label={`${label} — opens WhatsApp in a new tab`}
      className={cn('inline-flex', className)}
    >
      <Button
        type="button"
        size={size}
        className={cn(
          'bg-white dark:bg-slate-900 border border-[#25D366] text-emerald-700 dark:text-[#25D366]',
          'hover:bg-[#25D366]/10 hover:border-[#25D366]',
          'font-bold rounded-xl',
          buttonClassName,
        )}
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0" />
        {label}
      </Button>
    </a>
  );
}

/**
 * Help text for people on devices where WhatsApp has no installable app
 * (PCs, laptops, iPads). wa.me short links on those devices route into
 * WhatsApp's browser flow (WhatsApp Web), which needs the visitor's own
 * WhatsApp account linked via a one-time QR scan — that is a WhatsApp
 * product constraint, not a broken link. Ops reported a user spending
 * 15 minutes stuck on exactly this, so the callout now explains it
 * up front instead of letting people guess.
 */
export const WHATSAPP_DEVICE_HINT =
  'Best on a phone with WhatsApp installed. On a PC or iPad the chat opens in your browser (WhatsApp Web) — the first time, WhatsApp asks you to link it by scanning a QR code with your phone.';

/**
 * Green call-out banner for pages where users might be stuck with an
 * urgent problem (driver issue reports, support flows). Explains WHEN
 * to use WhatsApp and what to expect, per the ops team's request:
 * "if it is urgent, use our WhatsApp and write to us."
 */
export function WhatsAppUrgentCallout({
  title = 'Urgent? Message us on WhatsApp',
  description = 'If you need help right now, skip the wait — open WhatsApp, write to us, and our operations team will reply directly. Best for live issues: delays, access problems, or anything time-sensitive.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl bg-[#25D366]/10 dark:bg-[#25D366]/10 border border-[#25D366]/40',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0">
          <WhatsAppIcon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
            {description}
          </p>
          <WhatsAppSupportButton
            size="sm"
            label="Open WhatsApp Chat"
            className="mt-3"
            buttonClassName="text-xs"
          />
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 mt-2">
            {WHATSAPP_DEVICE_HINT}
          </p>
        </div>
      </div>
    </div>
  );
}
