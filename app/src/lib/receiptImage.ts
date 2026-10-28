import { toBlob } from 'html-to-image'
import brand from '../brand'

/** Turns the on-screen receipt into a sharp PNG file. */
export async function receiptToFile(element: HTMLElement, orderCode: string): Promise<File> {
  // The logo and QR code must be fully loaded, or they'd be missing from the picture.
  await Promise.all(
    [...element.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))),
  )
  const blob = await toBlob(element, { pixelRatio: 4, backgroundColor: '#ffffff' })
  if (!blob) throw new Error('Could not create the receipt image.')
  return new File([blob], `${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${orderCode.replace(/[^A-Za-z0-9-]/g, '')}.png`, { type: 'image/png' })
}

/**
 * Opens the phone's share menu with the image (pick WhatsApp, then the customer).
 * Where sharing files isn't supported, downloads the image instead.
 * Must be called straight from a tap: phones block sharing that isn't.
 */
export async function shareReceipt(file: File, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
