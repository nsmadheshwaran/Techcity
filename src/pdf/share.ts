import type { BusinessSettings, Customer, Service } from '@/types'
import { formatDateShort, formatMoney, toWhatsAppNumber } from '@/utils/format'

/**
 * Sharing helpers.
 *
 * NOTE ON WHATSAPP: sending a PDF automatically to a customer requires the paid
 * WhatsApp Business Cloud API (Meta) with an approved template + hosted media URL.
 * That is NOT configured here, so we implement the safe manual workflow instead:
 *   1. wa.me deep link opens WhatsApp with a pre-filled message, and
 *   2. the PDF is downloaded / shared through the OS share sheet so the owner
 *      attaches it in one tap.
 */

export function whatsappMessage(
  customer: Customer,
  service: Service,
  settings: BusinessSettings,
): string {
  const firstName = customer.name.split(' ')[0]
  const lines = [
    `Hello ${firstName},`,
    '',
    `Thank you for choosing ${settings.name}.`,
    '',
    service.status === 'Completed' || service.status === 'Delivered'
      ? 'Your service has been completed.'
      : `Your service status: ${service.status}.`,
    '',
    `Service ID: ${service.code}`,
    `Service: ${service.serviceType}`,
    `Date: ${formatDateShort(service.serviceDate)}`,
    `Amount: ${formatMoney(service.totalAmount, settings.currency)}`,
  ]
  if (service.balance > 0)
    lines.push(`Balance Due: ${formatMoney(service.balance, settings.currency)}`)
  if (service.warrantyExpiry)
    lines.push(`Warranty valid till: ${formatDateShort(service.warrantyExpiry)}`)
  if (service.nextServiceDate)
    lines.push(`Next service due: ${formatDateShort(service.nextServiceDate)}`)
  lines.push(
    '',
    'Your service report is attached/shared separately.',
    '',
    'Thank you.',
    settings.name,
    settings.phone,
  )
  return lines.join('\n')
}

export function whatsappLink(
  customer: Customer,
  service: Service,
  settings: BusinessSettings,
): string {
  const number = toWhatsAppNumber(customer.phone)
  const text = encodeURIComponent(whatsappMessage(customer, service, settings))
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
}

export function openWhatsApp(customer: Customer, service: Service, settings: BusinessSettings) {
  window.open(whatsappLink(customer, service, settings), '_blank', 'noopener,noreferrer')
}

export function smsLink(customer: Customer, service: Service, settings: BusinessSettings): string {
  return `sms:${customer.phone}?body=${encodeURIComponent(whatsappMessage(customer, service, settings))}`
}

export function emailLink(customer: Customer, service: Service, settings: BusinessSettings): string {
  const subject = `${settings.name} — Service Report ${service.code}`
  return `mailto:${customer.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    whatsappMessage(customer, service, settings),
  )}`
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false
  try {
    const probe = new File(['probe'], 'probe.pdf', { type: 'application/pdf' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

// NOTE: the actual file-sharing implementation lives in ./documents.ts
// (sharePDFDocument) so that the heavy jsPDF bundle stays inside the
// lazily-loaded PDF chunk.

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
