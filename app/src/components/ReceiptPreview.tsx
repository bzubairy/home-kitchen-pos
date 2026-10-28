import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { customerCode } from '../lib/orders'
import { getPaperWidth } from '../lib/receipt'
import { receiptToFile, shareReceipt } from '../lib/receiptImage'
import type { Order } from '../lib/types'
import ErrorMessage from './ErrorMessage'
import Receipt from './Receipt'
import brand from '../brand'

/**
 * Shows the receipt on screen with Print and Share-as-image buttons. Printing hides
 * the app and prints only the receipt, sized to the paper width chosen in Settings.
 */
export default function ReceiptPreview({ order, onClose }: { order: Order; onClose: () => void }) {
  const [paper] = useState(getPaperWidth)
  const [ready, setReady] = useState(false)
  const markReady = useCallback(() => setReady(true), [])
  const receiptRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  // Make the image as soon as the receipt is ready, so Share can open the share menu
  // instantly on tap (phones block sharing that happens after a delay).
  useEffect(() => {
    if (!ready || !receiptRef.current) return
    let cancelled = false
    receiptToFile(receiptRef.current, customerCode(order))
      .then((file) => !cancelled && setImage(file))
      .catch((err: Error) => !cancelled && setShareError(err.message))
    return () => {
      cancelled = true
    }
  }, [ready, order])

  async function share() {
    if (!image) return
    setShareError(null)
    setShareMessage(null)
    try {
      const result = await shareReceipt(image, `${brand.name} · Order ${customerCode(order)}`)
      if (result === 'saved') setShareMessage('Image saved. Attach it in the customer’s WhatsApp chat.')
    } catch (err) {
      setShareError((err as Error).message)
    }
  }

  // While open, mark the page so print CSS hides the app.
  useEffect(() => {
    document.body.classList.add('printing-receipt')
    return () => document.body.classList.remove('printing-receipt')
  }, [])

  // Paper rolls have no fixed length, so the printed page is made exactly as tall as the receipt.
  useEffect(() => {
    if (!ready || !receiptRef.current) return
    const style = document.createElement('style')
    const apply = () => {
      const heightMm = Math.ceil((receiptRef.current!.offsetHeight * 25.4) / 96) + 6
      style.textContent = `@page { size: ${paper}mm ${heightMm}mm; margin: 3mm ${paper === 58 ? 5 : 4}mm; }`
    }
    apply()
    document.head.appendChild(style)
    // Images (logo, QR) may finish loading after this; re-measure when they do.
    const images = [...receiptRef.current.querySelectorAll('img')]
    images.forEach((img) => img.addEventListener('load', apply))
    return () => {
      images.forEach((img) => img.removeEventListener('load', apply))
      style.remove()
    }
  }, [ready, paper])

  return createPortal(
    <div className="receipt-preview fixed inset-0 z-50 flex flex-col bg-stone-900/80">
      <div className="flex-1 overflow-y-auto p-4">
        <div ref={receiptRef} className="mx-auto w-fit rounded bg-white p-3 text-black shadow-lg">
          <Receipt order={order} paper={paper} onReady={markReady} />
        </div>
      </div>
      <div className="space-y-3 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:bg-stone-900">
        <ErrorMessage message={shareError} />
        {shareMessage && <p className="text-sm text-stone-600 dark:text-stone-400">{shareMessage}</p>}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onClose} className="btn-secondary px-2">Close</button>
          <button onClick={share} disabled={!image} className="btn-secondary px-2">{image ? '📤 Share' : '…'}</button>
          <button onClick={() => window.print()} disabled={!ready} className="btn-primary px-2">🖨️ Print</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
