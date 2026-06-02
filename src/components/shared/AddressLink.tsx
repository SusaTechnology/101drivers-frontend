import { ExternalLink } from 'lucide-react'

interface AddressLinkProps {
  address?: string | null
  className?: string
}

/**
 * Clickable address link that opens the location in the user's preferred maps app.
 * - Android: Opens Google Maps app
 * - iPhone: Opens Google Maps (or Apple Maps if no Google Maps)
 * - Desktop: Opens Google Maps in browser
 */
export function AddressLink({ address, className }: AddressLinkProps) {
  if (!address) {
    return <span className={className}>{'--'}</span>
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {address}
      <ExternalLink className="inline w-3 h-3 ml-1 opacity-50" />
    </a>
  )
}
