/**
 * Reusable hook for dealer pages that need real-time delivery status updates.
 *
 * Joins the dealer's socket room so this page receives `delivery:status-changed`
 * events for ALL of the dealer's deliveries. When a status change is received,
 * the delivery detail query is invalidated to trigger a refetch — making the
 * StatusBadge, Driver Identity card, and map tracking update automatically.
 *
 * Also exposes socketConnected so callers don't need a separate useSocketConnected().
 *
 * Usage in any dealer page:
 *   const { socketConnected } = useDealerDeliverySocket({ dealerId, deliveryId })
 */
import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketJoinDealer, socketLeaveDealer } from '@/lib/socket'
import { useSocketEvent, useSocketConnected } from '@/hooks/useSocket'

interface UseDealerDeliverySocketOptions {
  dealerId: string | undefined
  /** If provided, only invalidates when the event's deliveryId matches. */
  deliveryId?: string | undefined
}

export function useDealerDeliverySocket({ dealerId, deliveryId }: UseDealerDeliverySocketOptions) {
  const socketConnected = useSocketConnected()
  const queryClient = useQueryClient()

  // Join dealer room — receives all status-changed events for this dealer's deliveries
  useEffect(() => {
    if (dealerId) socketJoinDealer(dealerId)
    return () => { if (dealerId) socketLeaveDealer(dealerId) }
  }, [dealerId])

  // Listen for delivery status changes and invalidate the relevant query
  const handleStatusChanged = useCallback((data: any) => {
    if (!data?.deliveryId) return
    // If a specific deliveryId is provided, only react to that delivery's changes
    if (deliveryId && data.deliveryId !== deliveryId) return

    // Invalidate the single-delivery detail query (used on detail page)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey as string[]
        // Match queries like ["http://...api/deliveryRequests/xxx", ...]
        return key.some(k => typeof k === 'string' && k.includes('/deliveryRequests/'))
      },
    })

    // Also invalidate the dealer's delivery list (used on dashboard)
    if (dealerId) {
      queryClient.invalidateQueries({ queryKey: ['deliveries', dealerId] })
    }
  }, [dealerId, deliveryId, queryClient])

  useSocketEvent('delivery:status-changed', handleStatusChanged)

  return { socketConnected }
}