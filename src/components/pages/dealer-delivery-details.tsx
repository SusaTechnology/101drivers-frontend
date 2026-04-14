// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJsApiLoader } from '@react-google-maps/api'
import RouteMap from '@/components/map/RouteMap'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import {
  ArrowLeft,
  Plus,
  Menu,
  X,
  Truck,
  Car,
  MapPin,
  Ruler,
  Clock,
  Home,
  Wrench,
  Navigation,
  CheckCircle,
  Hourglass,
  Package,
  CheckSquare,
  Download,
  Edit,
  Phone,
  MessageCircle,
  Star,
  Shield,
  QrCode,
  Gauge,
  Camera,
  Map,
  Mail,
  MessageSquare,
  Send,
  Settings,
  AlertCircle,
  User,
  ShieldCheck,
  FileText,
  Calendar,
  CreditCard,
  Headphones,
  Flag,
  Target,
  Award,
  ChevronRight,
  DollarSign,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate, authFetch } from '@/lib/tanstack/dataQuery'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Helper to format date
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return ''
  return `${formatDate(dateString)} ${formatTime(dateString)}`
}

// Map service type to icon and label
const serviceTypeMap: Record<string, { icon: React.ReactNode; label: string }> = {
  BETWEEN_LOCATIONS: { icon: <Car className="h-4 w-4" />, label: 'Car Transfer' },
  HOME_DELIVERY: { icon: <Car className="h-4 w-4" />, label: 'Car Transfer' },
  SERVICE_PICKUP_RETURN: { icon: <Car className="h-4 w-4" />, label: 'Car Transfer' },
  default: { icon: <Car className="h-4 w-4" />, label: 'Car Transfer' },
}

// Tip payload type
interface TipPayload {
  amount: number
  delivery: { id: string }
  provider: 'STRIPE' | 'MANUAL' | 'OTHER'
  providerRef: string
  status: 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'
}

interface DealerDeliveryDetailsProps {
  deliveryId?: string
}

export default function DealerDeliveryDetails({ deliveryId }: DealerDeliveryDetailsProps) {
  const id = deliveryId
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)

  // Rating state
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingComment, setRatingComment] = useState('')

  // Tip state
  const [tipAmount, setTipAmount] = useState<number | ''>('')
  const [customTipInput, setCustomTipInput] = useState('')

  const user = getUser()
  const dealerId = user?.profileId

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Fetch delivery details
  const {
    data: deliveryData,
    isLoading,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${id}`,
    noFilter: true,
    enabled: !!dealerId && !!id,
  })

  // Fetch existing rating for this delivery
  const {
    data: existingRatings,
    isLoading: ratingLoading,
    refetch: refetchRating,
  } = useDataQuery<any[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRatings?where[delivery][id]=${id}&where[target]=DRIVER`,
    noFilter: true,
    enabled: !!id && deliveryData?.status === 'COMPLETED',
  })

  // Get the existing rating if any (customer can only rate once per delivery)
  const existingRating = existingRatings?.[0]

  // Fetch existing tips for this delivery
  const {
    data: existingTips,
    isLoading: tipsLoading,
    refetch: refetchTips,
  } = useDataQuery<any[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/tips?where[delivery][id]=${id}`,
    noFilter: true,
    enabled: !!id && deliveryData?.status === 'COMPLETED',
  })

  // Get the existing tip if any
  const existingTip = existingTips?.[0]

  // Rating mutation
  const ratingMutation = useCreate<any, any>(`${import.meta.env.VITE_API_URL}/api/deliveryRatings`, {
    onSuccess: () => {
      toast.success('Rating submitted', { description: 'Thank you for your feedback!' })
      setRatingStars(0)
      setRatingComment('')
      refetchRating()
    },
    onError: (error) => {
      toast.error('Failed to submit rating', { description: error.message })
    }
  })

  // Tip mutation
  const tipMutation = useCreate<TipPayload, TipPayload>(`${import.meta.env.VITE_API_URL}/api/tips`, {
    onSuccess: () => {
      toast.success('Tip sent', { description: 'Thank you for your generosity!' })
      // Reset form
      setTipAmount('')
      setCustomTipInput('')
      refetchTips()
    },
    onError: (error) => {
      toast.error('Failed to send tip', { description: error.message })
    }
  })

  // Release to marketplace mutation
  const queryClient = useQueryClient()
  const releaseToMarketMutation = useMutation({
    mutationFn: async () => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${id}/release-to-marketplace`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    },
    onSuccess: () => {
      toast.success('Released to market', { 
        description: 'Your delivery is now visible to drivers. You will be notified when a driver books it.' 
      })
      queryClient.invalidateQueries({ queryKey: ['delivery', id] })
      refetch() // Refresh delivery data
    },
    onError: (error: Error) => {
      toast.error('Failed to release to market', { description: error.message })
    }
  })

  // Geocode addresses when data is loaded
  useEffect(() => {
    if (!isLoaded || !deliveryData) return

    const geocoder = new google.maps.Geocoder()

    if (deliveryData.pickupAddress) {
      geocoder.geocode({ address: deliveryData.pickupAddress }, (results, status) => {
        if (status === 'OK' && results && results[0].geometry.location) {
          const location = results[0].geometry.location
          setPickupCoords({ lat: location.lat(), lng: location.lng() })
        } else {
          console.error('Geocode failed for pickup address')
        }
      })
    }

    if (deliveryData.dropoffAddress) {
      geocoder.geocode({ address: deliveryData.dropoffAddress }, (results, status) => {
        if (status === 'OK' && results && results[0].geometry.location) {
          const location = results[0].geometry.location
          setDropoffCoords({ lat: location.lat(), lng: location.lng() })
        } else {
          console.error('Geocode failed for dropoff address')
        }
      })
    }
  }, [isLoaded, deliveryData])

  // Derive schedule display based on customerChose
  const scheduleDisplay = (() => {
    if (!deliveryData) return { date: '—', time: '—' }
    if (deliveryData.customerChose === 'PICKUP_WINDOW' && deliveryData.pickupWindowStart && deliveryData.pickupWindowEnd) {
      return {
        date: formatDate(deliveryData.pickupWindowStart),
        time: `Pickup: ${formatTime(deliveryData.pickupWindowStart)} – ${formatTime(deliveryData.pickupWindowEnd)}`
      }
    } else if (deliveryData.customerChose === 'DROPOFF_WINDOW' && deliveryData.dropoffWindowStart && deliveryData.dropoffWindowEnd) {
      return {
        date: formatDate(deliveryData.dropoffWindowStart),
        time: `Drop-off: ${formatTime(deliveryData.dropoffWindowStart)} – ${formatTime(deliveryData.dropoffWindowEnd)}`
      }
    } else {
      return { date: '—', time: '—' }
    }
  })()

  // Build vehicle string
  const vehicleString = deliveryData
    ? [deliveryData.vehicleYear, deliveryData.vehicleMake, deliveryData.vehicleModel, deliveryData.vehicleColor]
        .filter(Boolean).join(' ') || 'Not provided'
    : '—'

  // Price and distance
  const price = deliveryData?.payment?.amount || deliveryData?.quote?.estimatedPrice
  const miles = deliveryData?.quote?.distanceMiles
  const priceType = deliveryData?.payment ? 'Final' : (deliveryData?.quote ? 'Est.' : '—')

  // Driver info from assignments
  const assignment = deliveryData?.assignments?.[0]
  const driver = assignment?.driver ? {
    id: assignment.driver.id,
    name: assignment.driver.user?.fullName || 'Driver',
    rating: assignment.driver.rating || '—',
    deliveries: assignment.driver.deliveryCount || '—',
    verified: assignment.driver.status === 'APPROVED',
    phone: assignment.driver.phone || '—',
  } : null

  // Timeline based on real timestamps
  const timelineItems = [
    {
      status: 'Request submitted',
      time: deliveryData?.createdAt ? formatDateTime(deliveryData.createdAt) : '—',
      completed: !!deliveryData?.createdAt,
      icon: CheckCircle,
    },
    {
      status: 'Booked (driver assigned)',
      time: assignment?.assignedAt ? formatDateTime(assignment.assignedAt) : (deliveryData?.status !== 'LISTED' ? 'Pending' : '—'),
      completed: !!assignment,
      icon: Hourglass,
    },
    {
      status: 'Active (pickup → in transit)',
      time: deliveryData?.trackingSession?.startedAt ? formatDateTime(deliveryData.trackingSession.startedAt) : (deliveryData?.status === 'ACTIVE' || deliveryData?.status === 'COMPLETED' ? 'In progress' : '—'),
      completed: !!deliveryData?.trackingSession?.startedAt,
      icon: Package,
    },
    {
      status: 'Completed',
      time: deliveryData?.compliance?.dropoffCompletedAt ? formatDateTime(deliveryData.compliance.dropoffCompletedAt) : (deliveryData?.status === 'COMPLETED' ? 'Completed' : '—'),
      completed: deliveryData?.status === 'COMPLETED',
      icon: CheckSquare,
    },
  ]

  // Proofs data
  const proofs = {
    vin: deliveryData?.vinVerificationCode || '—',
    odometerStart: deliveryData?.compliance?.odometerStart || '—',
    odometerEnd: deliveryData?.compliance?.odometerEnd || '—',
    trackingStatus: deliveryData?.status === 'COMPLETED'
      ? 'Completed'
      : deliveryData?.status === 'CANCELLED'
        ? 'Cancelled'
        : (deliveryData?.trackingSession?.status || 'Not started'),
    trackingStart: deliveryData?.trackingSession?.startedAt ? formatDateTime(deliveryData.trackingSession.startedAt) : '—',
    trackingEnd: deliveryData?.trackingSession?.stoppedAt ? formatDateTime(deliveryData.trackingSession.stoppedAt) : '—',
  }

  // Filter evidence photos
  const pickupPhotos = deliveryData?.evidence?.filter(
    (e: any) => e.phase === 'PICKUP' && e.type === 'PICKUP_PHOTO' && e.imageUrl
  ) || []
  const dropoffPhotos = deliveryData?.evidence?.filter(
    (e: any) => e.phase === 'DROPOFF' && e.type === 'DROPOFF_PHOTO' && e.imageUrl
  ) || []

  // Submit rating
  const handleSubmitRating = () => {
    if (!driver) {
      toast.error('No driver assigned yet')
      return
    }
    if (ratingStars === 0) {
      toast.error('Please select a star rating')
      return
    }
    const payload = {
      comment: ratingComment,
      customer: { id: deliveryData.customer.id },
      delivery: { id: deliveryData.id },
      driver: { id: driver.id },
      stars: ratingStars,
      target: 'DRIVER',
    }
    ratingMutation.mutate(payload)
  }

  // Submit tip
  const handleTipSubmit = () => {
    if (!driver) {
      toast.error('No driver assigned yet')
      return
    }
    if (deliveryData.status !== 'COMPLETED') {
      toast.error('Tips can only be given after delivery is completed')
      return
    }
    let amount = tipAmount
    if (amount === '' && customTipInput) {
      amount = parseFloat(customTipInput)
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid tip amount')
      return
    }
    const payload: TipPayload = {
      amount,
      delivery: { id: deliveryData.id },
      provider: 'STRIPE', // Default to Stripe for production
      providerRef: '', // Will be populated by payment processor
      status: 'CAPTURED', // Will be set by payment processor
    }
    tipMutation.mutate(payload)
  }

  // Preset tip handler
  const handlePresetTip = (amount: number) => {
    setTipAmount(amount)
    setCustomTipInput('')
  }

  // Download report handler
  const handleDownloadReport = () => {
    if (!deliveryData) {
      toast.error('No delivery data available')
      return
    }

    const deliveryRef = deliveryData.id?.slice(-6).toUpperCase() || 'UNKNOWN'
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Build timeline HTML
    const timelineHTML = timelineItems.map((item, index) => {
      const Icon = item.icon
      return `
        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; ${index > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${item.completed ? '#a3e635' : '#e2e8f0'}; display: flex; align-items: center; justify-content: center;">
            <span style="color: ${item.completed ? '#365314' : '#64748b'}; font-size: 12px; font-weight: bold;">${index + 1}</span>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: 600; color: #0f172a;">${item.status}</span>
              <span style="font-size: 12px; color: #64748b;">${item.time}</span>
            </div>
          </div>
        </div>
      `
    }).join('')

    // Build photos HTML
    const pickupPhotosHTML = pickupPhotos.map((photo: any, index: number) => `
      <div style="display: inline-block; margin: 4px;">
        <a href="${photo.imageUrl}" target="_blank" style="color: #65a30d; text-decoration: none;">Photo ${index + 1}</a>
      </div>
    `).join('') || '<span style="color: #94a3b8;">No photos</span>'

    const dropoffPhotosHTML = dropoffPhotos.map((photo: any, index: number) => `
      <div style="display: inline-block; margin: 4px;">
        <a href="${photo.imageUrl}" target="_blank" style="color: #65a30d; text-decoration: none;">Photo ${index + 1}</a>
      </div>
    `).join('') || '<span style="color: #94a3b8;">No photos</span>'

    // Create report HTML
    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Report #${deliveryRef} - 101 Drivers</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background: #f8fafc;
      padding: 40px;
    }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 32px; }
    .logo { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .logo-text { font-size: 24px; font-weight: 800; }
    .title { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
    .subtitle { opacity: 0.8; font-size: 14px; }
    .content { padding: 32px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #a3e635; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
    .card-value { font-size: 16px; font-weight: 600; color: #0f172a; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .status-completed { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .status-active { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
    .status-booked { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .status-listed { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
    .timeline { margin-top: 16px; }
    .price { font-size: 28px; font-weight: 800; color: #65a30d; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; }
    .footer-text { font-size: 12px; color: #64748b; }
    .photo-links { display: flex; flex-wrap: wrap; gap: 8px; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div style="width: 48px; height: 48px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <span style="color: #0f172a; font-weight: 800; font-size: 20px;">101</span>
        </div>
        <div class="logo-text">101 Drivers</div>
      </div>
      <div class="title">Delivery Report #${deliveryRef}</div>
      <div class="subtitle">Generated on ${reportDate}</div>
    </div>
    
    <div class="content">
      <!-- Status & Service -->
      <div class="section">
        <div class="section-title">Delivery Overview</div>
        <div class="grid">
          <div class="card">
            <div class="card-label">Status</div>
            <div class="card-value">
              <span class="status-badge status-${deliveryData.status?.toLowerCase()}">${deliveryData.status || 'Unknown'}</span>
            </div>
          </div>
          <div class="card">
            <div class="card-label">Service Type</div>
            <div class="card-value">${serviceTypeMap[deliveryData.serviceType]?.label || deliveryData.serviceType || 'Standard Delivery'}</div>
          </div>
          <div class="card">
            <div class="card-label">Created</div>
            <div class="card-value">${deliveryData.createdAt ? formatDateTime(deliveryData.createdAt) : '—'}</div>
          </div>
          <div class="card">
            <div class="card-label">Schedule</div>
            <div class="card-value">${scheduleDisplay.date} ${scheduleDisplay.time}</div>
          </div>
        </div>
      </div>

      <!-- Route -->
      <div class="section">
        <div class="section-title">Route Details</div>
        <div class="grid">
          <div class="card">
            <div class="card-label">Pickup Address</div>
            <div class="card-value">${deliveryData.pickupAddress || '—'}</div>
          </div>
          <div class="card">
            <div class="card-label">Drop-off Address</div>
            <div class="card-value">${deliveryData.dropoffAddress || '—'}</div>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div class="card-label">Estimated Price</div>
                <div class="price">${price ? `$${price.toFixed(2)}` : '—'}</div>
                <div style="font-size: 12px; color: #64748b;">${priceType} price</div>
              </div>
              ${deliveryData.etaMinutes ? `<div style="text-align: right;"><div class="card-label">Est. Duration</div><div class="card-value">${deliveryData.etaMinutes} min</div></div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicle -->
      <div class="section">
        <div class="section-title">Vehicle Information</div>
        <div class="grid">
          <div class="card">
            <div class="card-label">Vehicle</div>
            <div class="card-value">${vehicleString}</div>
          </div>
          <div class="card">
            <div class="card-label">License Plate</div>
            <div class="card-value">${deliveryData.licensePlate || '—'}</div>
          </div>
          <div class="card">
            <div class="card-label">VIN Last 4</div>
            <div class="card-value">${deliveryData.vinVerificationCode || '—'}</div>
          </div>
          <div class="card">
            <div class="card-label">Transmission</div>
            <div class="card-value">${deliveryData.vehicleTransmission || '—'}</div>
          </div>
        </div>
      </div>

      ${driver ? `
      <!-- Driver -->
      <div class="section">
        <div class="section-title">Driver Information</div>
        <div class="grid">
          <div class="card">
            <div class="card-label">Driver Name</div>
            <div class="card-value">${driver.name}</div>
          </div>
          <div class="card">
            <div class="card-label">Rating</div>
            <div class="card-value">${driver.rating} ★</div>
          </div>
          <div class="card">
            <div class="card-label">Total Deliveries</div>
            <div class="card-value">${driver.deliveries}</div>
          </div>
          <div class="card">
            <div class="card-label">Verified</div>
            <div class="card-value">${driver.verified ? 'Yes ✓' : 'Pending'}</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Timeline -->
      <div class="section">
        <div class="section-title">Status Timeline</div>
        <div class="timeline">
          ${timelineHTML}
        </div>
      </div>

      <!-- Proofs -->
      <div class="section">
        <div class="section-title">Compliance Proofs</div>
        <div class="grid">
          <div class="card">
            <div class="card-label">Odometer Start</div>
            <div class="card-value">${proofs.odometerStart}</div>
          </div>
          <div class="card">
            <div class="card-label">Odometer End</div>
            <div class="card-value">${proofs.odometerEnd}</div>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <div class="card">
            <div class="card-label">Pickup Photos (${pickupPhotos.length})</div>
            <div class="photo-links">${pickupPhotosHTML}</div>
          </div>
        </div>
        <div style="margin-top: 8px;">
          <div class="card">
            <div class="card-label">Drop-off Photos (${dropoffPhotos.length})</div>
            <div class="photo-links">${dropoffPhotosHTML}</div>
          </div>
        </div>
      </div>

      ${deliveryData.specialInstructions ? `
      <!-- Instructions -->
      <div class="section">
        <div class="section-title">Special Instructions</div>
        <div class="card">
          <div class="card-value">${deliveryData.specialInstructions}</div>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <div class="footer-text">© ${new Date().getFullYear()} 101 Drivers Inc. All rights reserved.</div>
      <div class="footer-text">California-only operations • Email-first notifications</div>
      <div class="footer-text" style="margin-top: 8px;">This report was generated from the 101 Drivers Dealer Portal</div>
    </div>
  </div>
  
  <script>
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
      window.print();
    }, 500);
  </script>
</body>
</html>
    `

    // Open report in new window
    const reportWindow = window.open('', '_blank')
    if (reportWindow) {
      reportWindow.document.write(reportHTML)
      reportWindow.document.close()
      toast.success('Report generated', { description: 'Use Print to save as PDF' })
    } else {
      toast.error('Pop-up blocked', { description: 'Please allow pop-ups to download the report' })
    }
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'QUOTED':
          return {
            label: 'Quoted',
            icon: FileText,
            variant: 'secondary' as const,
            className: 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-900/10 dark:text-purple-200 dark:border-purple-900/30',
          }
        case 'BOOKED':
          return {
            label: 'Booked',
            icon: Hourglass,
            variant: 'secondary' as const,
            className: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/10 dark:text-amber-200 dark:border-amber-900/30',
          }
        case 'ACTIVE':
          return {
            label: 'Active',
            icon: Navigation,
            variant: 'default' as const,
            className: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-900/30',
          }
        case 'COMPLETED':
          return {
            label: 'Completed',
            icon: CheckSquare,
            variant: 'default' as const,
            className: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-200 dark:border-emerald-900/30',
          }
        case 'LISTED':
          return {
            label: 'Listed',
            icon: Package,
            variant: 'outline' as const,
            className: '',
          }
        default:
          return {
            label: status,
            icon: Package,
            variant: 'outline' as const,
            className: '',
          }
      }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={cn("gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest border", config.className)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  // Header component (unchanged)
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
            <Link
              // to="/dealer/notifications"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Notifications
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/dealer-dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deliveries
          </Link>

          <Link
            to="/dealer-create-delivery"
            className="inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-6 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-lime-500/20 transition-all font-extrabold"
          >
            New Delivery
            <Plus className="h-4 w-4" />
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
            <Link
              // to="/dealer/notifications"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Notifications
            </Link>
            <Separator className="my-2" />
            <Link
              to="/dealer-dashboard"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              Back to Deliveries
            </Link>
          </div>
        </div>
      )}
    </header>
  )

  // Footer (unchanged)
  const Footer = () => (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers logo"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">© 2024 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading delivery details...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Error state
  if (isError || !deliveryData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load delivery</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
            <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />
      
      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center mt-1">
              <Truck className="h-6 w-6 text-lime-500" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Delivery #{deliveryData.id?.slice(-6).toUpperCase() || id?.slice(-6).toUpperCase()}
                </h1>

                <StatusBadge status={deliveryData.status} />

                <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
                  <MapPin className="h-3 w-3" />
                  CA Only
                </Badge>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Track status, view driver identity (after booking), and review compliance proofs.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {/* Release to Market button - shown for QUOTED status */}
            {deliveryData.status === 'QUOTED' && (
              <Button
                onClick={() => releaseToMarketMutation.mutate({})}
                disabled={releaseToMarketMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-lime-500 text-slate-950 font-extrabold hover:bg-lime-600"
              >
                {releaseToMarketMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950"></div>
                    Releasing...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Release to Market
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/dealer-edit-delivery', state: { id: deliveryData.id } })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-extrabold"
            >
              <Calendar className="h-4 w-4 text-lime-500" />
              Edit Schedule
            </Button>
    {(deliveryData.status === 'BOOKED' || deliveryData.status === 'ACTIVE') && (
      <Button
        onClick={() => navigate({ to: `/live-track?deliveryId=${deliveryData.id}` })}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-lime-500 text-slate-950 font-extrabold hover:bg-lime-600"
      >
        <Navigation className="h-4 w-4" />
        Live track the driver
      </Button>
    )}
            <Button
              onClick={() => navigate({ to: '/dealer-support-request', state: { deliveryId: deliveryData.id } })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90"
            >
              <Headphones className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </section>

        {/* Prominent Schedule Section */}
        <section className="mt-6 mb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pickup Time Card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-2xl bg-lime-50 dark:bg-lime-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Pickup Window</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {deliveryData.pickupWindowStart && deliveryData.pickupWindowEnd
                        ? `${formatDate(deliveryData.pickupWindowStart)} • ${formatTime(deliveryData.pickupWindowStart)} – ${formatTime(deliveryData.pickupWindowEnd)}`
                        : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dropoff Time Card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-2xl bg-blue-50 dark:bg-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Flag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Drop-off Window</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {deliveryData.dropoffWindowStart && deliveryData.dropoffWindowEnd
                        ? `${formatDate(deliveryData.dropoffWindowStart)} • ${formatTime(deliveryData.dropoffWindowStart)} – ${formatTime(deliveryData.dropoffWindowEnd)}`
                        : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Main layout */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Map + route + tabs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Map section */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[360px] bg-slate-50 dark:bg-slate-950">
                  {isLoaded && pickupCoords && dropoffCoords ? (
                    <RouteMap
                      pickup={pickupCoords}
                      dropoff={dropoffCoords}
                      isLoaded={isLoaded}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                      <p className="text-sm text-slate-500">Map loading or addresses not geocoded</p>
                    </div>
                  )}

                  {/* Overlay badges */}
                  <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 z-10">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Map className="h-4 w-4 text-lime-500" />
                      Route Map
                    </div>

                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-lime-500" />
                      {deliveryData.etaMinutes ? `${deliveryData.etaMinutes} min` : '—'}
                    </div>

                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-lime-500" />
                      {scheduleDisplay.time}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 sm:p-8 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Route</Label>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-lime-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Pickup</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {deliveryData.pickupAddress || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Flag className="h-5 w-5 text-rose-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Drop-off</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {deliveryData.dropoffAddress || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Estimated Price</div>
                          <div className="text-3xl font-black text-lime-500 mt-1">
                            {price ? `$${price.toFixed(2)}` : '—'}
                          </div>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Distance</div>
                          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                            {miles ? `${miles.toFixed(1)} mi` : '—'}
                          </div>
                        </div>
                      </div>
                      <Link
                        // to="/dealer/payment"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                      >
                        <CreditCard className="h-4 w-4 text-lime-500" />
                        Payment
                      </Link>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      {priceType} price based on category and mileage.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="proofs" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Proofs
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6 mt-6">
                {/* Timeline */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Status timeline</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Track delivery status end-to-end (Requested → Booked → Active → Completed).
                      </p>
                    </div>

                    <Badge variant="secondary" className="gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Email-first</span>
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-6 space-y-4">
                      {timelineItems.map((item, index) => {
                        const Icon = item.icon
                        return (
                          <div key={index}>
                            {index > 0 && <Separator className="my-4" />}
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center",
                                item.completed 
                                  ? "bg-lime-500/15" 
                                  : "bg-slate-100 dark:bg-slate-800/60"
                              )}>
                                <Icon className={cn(
                                  "h-5 w-5",
                                  item.completed 
                                    ? "text-lime-500" 
                                    : "text-slate-500 dark:text-slate-300"
                                )} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-black text-slate-900 dark:text-white">{item.status}</div>
                                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.time}</div>
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {index === 0 && 'Confirmation email sent to dealer contact.'}
                                  {index === 1 && 'Driver identity is visible after booking (name + photo + profile).'}
                                  {index === 2 && 'Tracking begins when driver taps Start and ends on completion.'}
                                  {index === 3 && 'Post-trip report available with photos and odometer evidence.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                      <Button 
                        onClick={handleDownloadReport}
                        className="flex-1 py-4 rounded-2xl gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Report
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 py-4 rounded-2xl gap-2"
                        onClick={() => navigate({ to: '/dealer-edit-delivery', state: { id: deliveryData.id } })}
                      >
                        <Edit className="h-4 w-4 text-lime-500" />
                        Edit Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Vehicle summary */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Vehicle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-5">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Vehicle</div>
                          <div className="font-black text-slate-900 dark:text-white mt-2">{vehicleString}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Plate: {deliveryData.licensePlate || '—'}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-5">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Verification</div>
                          <div className="font-black text-slate-900 dark:text-white mt-2">VIN last-4: {deliveryData.vinVerificationCode || '—'}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Used at pickup for verification (101 Standard).
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Proofs Tab */}
              <TabsContent value="proofs" className="space-y-6 mt-6">
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Compliance proofs</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        VIN last-4, pickup/drop-off photos, odometer start/end, and tracking records.
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-2">
                      <Shield className="h-3 w-3" />
                      <span className="text-[11px] font-black uppercase tracking-widest">101 Standard</span>
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* VIN */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <QrCode className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">VIN last-4 verification</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">Required at pickup</div>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                            Verified value: <span className="font-black">{proofs.vin}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Odometer */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Gauge className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Odometer start/end</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">Photos at both ends</div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Start</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.odometerStart}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">End</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.odometerEnd}</div>
                              </CardContent>
                            </Card>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Pickup Photos */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 md:col-span-2">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Camera className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Pickup photos</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {pickupPhotos.length} photo{pickupPhotos.length !== 1 ? 's' : ''} captured
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            {pickupPhotos.map((photo) => (
                              <a
                                key={photo.imageUrl}
                                href={photo.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 overflow-hidden hover:opacity-90 transition"
                              >
                                <img
                                  src={photo.imageUrl}
                                  alt={`Pickup ${photo.slotIndex}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                            {pickupPhotos.length === 0 && (
                              <div className="col-span-full text-center py-8 text-slate-500">
                                No pickup photos uploaded yet.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dropoff Photos */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 md:col-span-2">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Camera className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Drop-off photos</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {dropoffPhotos.length} photo{dropoffPhotos.length !== 1 ? 's' : ''} captured
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            {dropoffPhotos.map((photo) => (
                              <a
                                key={photo.imageUrl}
                                href={photo.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 overflow-hidden hover:opacity-90 transition"
                              >
                                <img
                                  src={photo.imageUrl}
                                  alt={`Dropoff ${photo.slotIndex}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                            {dropoffPhotos.length === 0 && (
                              <div className="col-span-full text-center py-8 text-slate-500">
                                No drop-off photos uploaded yet.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tracking */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 md:col-span-2">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Navigation className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Start/stop tracking</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Tracking starts when driver taps Start; ends at completion.
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingStatus}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Start time</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingStart}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">End time</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingEnd}</div>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {deliveryData.trackingSession ? 'Live GPS tracking available in real app.' : 'Tracking not yet started.'}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* Post-trip report */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardContent className="p-6 sm:p-8">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Post-trip report</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Final report becomes available after completion.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6 gap-2 py-4 w-full sm:w-auto"
                      disabled={deliveryData.status !== 'COMPLETED'}
                    >
                      <Download className="h-4 w-4 text-lime-500" />
                      {deliveryData.status === 'COMPLETED' ? 'Download Report' : 'Report not ready'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-6 mt-6">
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Messages</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        In-app chat with your driver (coming soon).
                      </p>
                    </div>
                    {driver && driver.phone && driver.phone !== '—' && (
                      <Button
                        className="gap-2"
                        onClick={() => window.location.href = `tel:${driver.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                        Call Driver
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Coming Soon placeholder */}
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                        <MessageSquare className="h-10 w-10 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        In-App Messaging Coming Soon
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6">
                        We're working on real-time messaging between dealers and drivers. For now, you can contact your driver by phone if needed.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {driver && driver.phone && driver.phone !== '—' ? (
                          <Button
                            className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600"
                            onClick={() => window.location.href = `tel:${driver.phone}`}
                          >
                            <Phone className="h-4 w-4" />
                            Call {driver.name}
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="gap-2 py-2 px-4">
                            <AlertCircle className="h-4 w-4" />
                            Driver phone not available
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => setActiveTab('details')}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Details
                        </Button>
                      </div>
                    </div>

                    {/* Info note */}
                    <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <span className="font-bold">Primary communication:</span> Email notifications are sent automatically for all delivery status updates. SMS is optional if enabled by Admin policy.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Driver card + contact + rating + tip */}
          <div className="lg:col-span-5 space-y-6">
            {/* Driver identity */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Assigned driver</div>
                  <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">Driver identity</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Visible after booking (name, photo, profile).
                  </p>
                </div>

                <Badge variant="secondary" className="gap-2">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {deliveryData.status !== 'LISTED' ? 'Booked' : 'Listed'}
                  </span>
                </Badge>
              </CardHeader>
              <CardContent>
                {/* Driver info only visible after booking (BOOKED, ACTIVE, COMPLETED) */}
                {driver && !['LISTED', 'DRAFT', 'EXPIRED', 'CANCELLED'].includes(deliveryData.status) ? (
                  <>
                    <div className="mt-6 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                        <User className="h-8 w-8 text-slate-600 dark:text-slate-300" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black text-slate-900 dark:text-white text-lg">{driver.name}</div>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="h-4 w-4 fill-amber-500" />
                            <span className="text-sm font-black text-slate-900 dark:text-white">{driver.rating}</span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {driver.deliveries} deliveries • {driver.verified ? 'ID verified' : 'Pending verification'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        className="gap-2"
                        onClick={() => {
                          if (driver.phone && driver.phone !== '—') {
                            window.location.href = `tel:${driver.phone}`
                          } else {
                            toast.error('Phone number not available')
                          }
                        }}
                      >
                        <Phone className="h-4 w-4" />
                        Call Driver
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setActiveTab('messages')}
                      >
                        <MessageCircle className="h-4 w-4 text-lime-500" />
                        Message
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 p-6 text-center text-slate-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium">
                      {deliveryData.status === 'LISTED' ? 'Waiting for driver to book' :
                       deliveryData.status === 'DRAFT' ? 'Draft - not yet submitted' :
                       ['EXPIRED', 'CANCELLED'].includes(deliveryData.status) ? 'Delivery not active' :
                       'Driver not yet assigned'}
                    </p>
                    <p className="text-xs mt-1">
                      {deliveryData.status === 'LISTED' ? 'Driver details will appear once a driver accepts this delivery.' :
                       deliveryData.status === 'DRAFT' ? 'Submit this delivery to make it available for drivers.' :
                       ['EXPIRED', 'CANCELLED'].includes(deliveryData.status) ? 'This delivery is no longer active.' :
                       'Driver details appear after the delivery is booked.'}
                    </p>
                  </div>
                )}

                <div className="mt-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    {driver && !['LISTED', 'DRAFT', 'EXPIRED', 'CANCELLED'].includes(deliveryData.status)
                      ? 'Driver profile from onboarding approval. Contact via phone or in-app messaging.'
                      : 'Driver identity is revealed only after booking for privacy.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notifications & contact */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Notifications & contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-lime-500 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">Email-first updates</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Status updates sent to <span className="font-semibold">{deliveryData?.customer?.contactEmail || 'your contact email'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-lime-500 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">SMS optional</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Only used if enabled by Admin policy and user opts in.
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/dealer-settings"
                    className="mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-extrabold hover:opacity-90 transition border border-slate-200 dark:border-slate-700 w-full"
                  >
                    <Settings className="h-4 w-4 text-lime-500" />
                    Account Settings
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Rating card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                  {existingRating ? 'Your rating' : 'Rate driver (after completion)'}
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {existingRating
                    ? 'You have already rated this delivery.'
                    : 'Available when the delivery is marked Completed.'}
                </p>
              </CardHeader>
              <CardContent>
                <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    {existingRating ? (
                      /* Display existing rating */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-black text-slate-900 dark:text-white">Your rating</div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-6 w-6",
                                  star <= existingRating.stars
                                    ? "fill-amber-500 text-amber-500"
                                    : "text-slate-300 dark:text-slate-600"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        {existingRating.comment && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Your comment</div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">{existingRating.comment}</div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          Rating submitted on {formatDate(existingRating.createdAt)}
                        </div>
                      </div>
                    ) : (
                      /* Rating form */
                      <>
                        {/* Star rating */}
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-black text-slate-900 dark:text-white">Your rating</div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingStars(star)}
                                disabled={deliveryData.status !== 'COMPLETED' || !driver}
                                className="focus:outline-none"
                              >
                                <Star
                                  className={cn(
                                    "h-6 w-6 transition-colors",
                                    star <= ratingStars
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-slate-300 dark:text-slate-600"
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Comment */}
                        <div className="mt-4">
                          <Textarea
                            placeholder="Leave a comment (optional)"
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            disabled={deliveryData.status !== 'COMPLETED' || !driver}
                            className="rounded-2xl border-slate-200 dark:border-slate-700"
                          />
                        </div>

                        {/* Submit button */}
                        <Button
                          className="mt-4 w-full py-4 gap-2"
                          disabled={deliveryData.status !== 'COMPLETED' || !driver || ratingStars === 0 || ratingMutation.isPending}
                          onClick={handleSubmitRating}
                        >
                          {ratingMutation.isPending ? 'Submitting...' : 'Submit Rating'}
                          <ChevronRight className="h-4 w-4" />
                        </Button>

                        {!driver && deliveryData.status === 'COMPLETED' && (
                          <p className="text-xs text-amber-600 mt-2">Driver information missing – cannot rate.</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Tip Card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                  {existingTip ? 'Tip sent' : 'Tip driver'}
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {existingTip
                    ? 'You have already sent a tip for this delivery.'
                    : 'Show your appreciation with a tip (optional). Available after completion.'}
                </p>
              </CardHeader>
              <CardContent>
                <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5 space-y-4">
                    {existingTip ? (
                      /* Display existing tip */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30">
                          <div>
                            <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">Tip Amount</div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">${existingTip.amount?.toFixed(2)}</div>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-emerald-500" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          Tip sent on {formatDate(existingTip.createdAt)} via {existingTip.provider || 'payment'}
                        </div>
                      </div>
                    ) : (
                      /* Tip form */
                      <>
                        {/* Preset amounts */}
                        <div>
                          <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Quick tip</Label>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePresetTip(5)}
                              disabled={deliveryData.status !== 'COMPLETED' || !driver}
                              className={cn("py-5", tipAmount === 5 && "border-lime-500 bg-lime-50 text-lime-700")}
                            >
                              $5
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePresetTip(10)}
                              disabled={deliveryData.status !== 'COMPLETED' || !driver}
                              className={cn("py-5", tipAmount === 10 && "border-lime-500 bg-lime-50 text-lime-700")}
                            >
                              $10
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePresetTip(20)}
                              disabled={deliveryData.status !== 'COMPLETED' || !driver}
                              className={cn("py-5", tipAmount === 20 && "border-lime-500 bg-lime-50 text-lime-700")}
                            >
                              $20
                            </Button>
                          </div>
                        </div>

                        {/* Custom amount */}
                        <div>
                          <Label htmlFor="custom-tip" className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Or enter custom amount ($)
                          </Label>
                          <Input
                            id="custom-tip"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={customTipInput}
                            onChange={(e) => {
                              setCustomTipInput(e.target.value)
                              setTipAmount('') // clear preset selection when typing
                            }}
                            disabled={deliveryData.status !== 'COMPLETED' || !driver}
                            className="mt-2 rounded-2xl"
                          />
                        </div>

                        {/* Submit button */}
                        <Button
                          className="w-full py-4 gap-2 mt-2 bg-lime-500 text-slate-950 hover:bg-lime-600"
                          disabled={
                            deliveryData.status !== 'COMPLETED' ||
                            !driver ||
                            tipMutation.isPending ||
                            (tipAmount === '' && !customTipInput)
                          }
                          onClick={handleTipSubmit}
                        >
                          {tipMutation.isPending ? 'Processing...' : 'Send Tip'}
                          <DollarSign className="h-4 w-4" />
                        </Button>

                        {!driver && deliveryData.status === 'COMPLETED' && (
                          <p className="text-xs text-amber-600">Driver information missing – cannot tip.</p>
                        )}

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                          Tips are processed securely through our payment provider.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card className="bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Need help?</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Contact our operations team for any issues with this delivery.
                    </p>
                  </div>
                  <Link
                    to="/dealer-support-request"
                    state={{ deliveryId: deliveryData.id }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-lime-500 text-slate-950 font-extrabold hover:bg-lime-600 transition"
                  >
                    <Headphones className="h-4 w-4" />
                    Contact Operations
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  )
}