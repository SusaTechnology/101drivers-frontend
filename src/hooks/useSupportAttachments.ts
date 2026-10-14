// Shared attachment uploader for support conversations.
//
// Why this exists: support attachments used to ride the delivery-scoped
// /uploads/delivery-evidence endpoint, which stores files under
// delivery-evidence/{deliveryId}/ on the CDN. That made photos impossible
// unless the form was opened FROM an active delivery — hence the cryptic
// "Delivery context required" toast dealers and drivers kept hitting.
//
// The new /uploads/support-attachment endpoint is USER-scoped (the owning
// folder comes from the JWT, not the request body), so photos work from
// any context: driver issue report, dealer contact form — with or without
// a related delivery. This hook encapsulates the whole flow (compress →
// upload → thumbnail list → [Attachments] message block) so the two forms
// stay behaviorally identical.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFileUpload } from '@/lib/tanstack/dataQuery'
import { compressPhoto } from '@/lib/image-compress'

const SUPPORT_ATTACHMENT_ENDPOINT = `${import.meta.env.VITE_API_URL}/api/uploads/support-attachment`

export function useSupportAttachments() {
  const [attachments, setAttachments] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogSrc, setDialogSrc] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const uploadMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    SUPPORT_ATTACHMENT_ENDPOINT,
    {
      onSuccess: (data) => {
        setIsUploading(false)
        const url = data?.files?.[0]?.url
        if (!url) {
          toast.error('Upload failed', {
            description: 'The server did not return a file URL. Please try again.',
          })
          return
        }
        setAttachments((prev) => [...prev, url])
        toast.success('Photo attached')
      },
      onError: (error: any) => {
        setIsUploading(false)
        toast.error('Upload failed', {
          description: error?.message || 'Please try again.',
        })
      },
    }
  )

  const openPicker = () => {
    inputRef.current?.click()
  }

  const handleChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset the input so picking the SAME file again still fires onChange.
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    try {
      // Phone cameras produce multi-MB photos; the endpoint rejects >5MB.
      const compressed = await compressPhoto(file)
      const formData = new FormData()
      formData.append('files', compressed)
      uploadMutation.mutate(formData)
    } catch (error: any) {
      setIsUploading(false)
      toast.error('Could not process image', {
        description: error?.message || 'Please try a different photo.',
      })
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const openPreview = (url: string) => {
    setDialogSrc(url)
    setDialogOpen(true)
  }

  /**
   * SupportRequest has no attachments column — the CDN URLs are embedded
   * into the message text as an [Attachments] block, where Operations (and
   * every chat surface, via SupportMessageBody) can open them.
   */
  const buildAttachmentBlock = (): string => {
    if (attachments.length === 0) return ''
    return `\n\n[Attachments]\n${attachments
      .map((url, i) => `Photo ${i + 1}: ${url}`)
      .join('\n')}`
  }

  return {
    attachments,
    isUploading,
    inputRef,
    dialogOpen,
    dialogSrc,
    openPicker,
    handleChosen,
    removeAttachment,
    openPreview,
    setDialogOpen,
    buildAttachmentBlock,
  }
}
