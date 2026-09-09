import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoDefault from '@/assets/logo-tc.jpg?inline'
import type {
  BusinessSettings,
  Customer,
  DocKind,
  Payment,
  Quotation,
  Service,
  ServicePart,
} from '@/types'
import { formatAmount, formatDateLong, formatDateShort } from '@/utils/format'

/**
 * PDF generation for Service / Installation Reports (Delivery Challan format),
 * Invoices, Receipts, Customer History and Quotations.
 *
 * Uses jsPDF + autotable with a hand-built layout so output is print ready A4,
 * with no external assets (works fully offline).
 */

const BRAND: [number, number, number] = [26, 55, 181] // #1a37b5
const INK: [number, number, number] = [34, 38, 47]
const MUTED: [number, number, number] = [102, 117, 149]
const LINE: [number, number, number] = [213, 218, 227]
const LIGHT: [number, number, number] = [246, 247, 249]

const M = 14 // page margin
const PAGE_W = 210
const CONTENT_W = PAGE_W - M * 2

export interface DocInput {
  kind: DocKind
  service: Service
  customer: Customer
  parts: ServicePart[]
  payments?: Payment[]
  settings: BusinessSettings
}

export interface QuotationDocInput {
  quotation: Quotation
  customer: Customer
  settings: BusinessSettings
}

const TITLES: Record<DocKind, string> = {
  report: 'SERVICE / INSTALLATION REPORT',
  invoice: 'TAX INVOICE',
  receipt: 'PAYMENT RECEIPT',
  history: 'CUSTOMER HISTORY',
  quotation: 'QUOTATION',
}

/** jsPDF's built-in fonts are Latin-1 only — ₹ renders as a blank box, so use "Rs." */
function money(n: number): string {
  return `Rs. ${formatAmount(n)}`
}

function clean(text?: string | null): string {
  if (!text) return ''
  // Replace characters outside WinAnsi with safe equivalents
  return String(text)
    .replace(/₹/g, 'Rs.')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

function docTitle(kind: DocKind, service: Service, settings: BusinessSettings): string {
  if (kind === 'invoice') return `${settings.invoicePrefix || 'TC-INV-'}${service.code.replace(/^TC-SRV-/, '')}`
  return service.code
}

/* ------------------------------------------------------------------ */
/* Logo resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * The business logo: the one uploaded in Settings, falling back to the TC
 * logo bundled with the app, then a drawn placeholder as a last resort.
 */
function resolveLogo(settings: BusinessSettings): { data: string; format: 'PNG' | 'JPEG' } | null {
  const src = settings.logoDataUrl || logoDefault
  if (!src) return null
  const fmt = src.includes('image/png') ? ('PNG' as const) : ('JPEG' as const)
  return { data: src, format: fmt }
}

/* ------------------------------------------------------------------ */
/* Shared letterhead / footer                                          */
/* ------------------------------------------------------------------ */

/** Company block (logo + name + tagline + contact lines). Returns the y below it. */
function drawCompanyBlock(doc: jsPDF, settings: BusinessSettings, y: number): number {
  const logo = resolveLogo(settings)
  const logoSize = 17
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, M, y, logoSize, logoSize, undefined, 'FAST')
    } catch {
      drawLogoPlaceholder(doc, M, y, logoSize)
    }
  } else {
    drawLogoPlaceholder(doc, M, y, logoSize)
  }

  const textX = M + logoSize + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...BRAND)
  doc.text(clean(settings.name || 'TECH CITY TECHNOLOGY'), textX, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(clean(settings.tagline), textX, y + 11)

  const contactLines = [
    clean(settings.address),
    [settings.phone, settings.altPhone].filter(Boolean).map(clean).join('  |  '),
    [settings.email, settings.website].filter(Boolean).map(clean).join('  |  '),
  ].filter(Boolean)

  doc.setFontSize(7.8)
  let cy = y + 15.5
  for (const line of contactLines) {
    const wrapped = doc.splitTextToSize(line, CONTENT_W - logoSize - 5 - 46)
    for (const w of wrapped) {
      doc.text(w, textX, cy)
      cy += 3.4
    }
  }

  if (settings.gstEnabled && settings.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(`GSTIN: ${clean(settings.gstNumber)}`, textX, cy + 0.4)
    cy += 4
  }
  return cy
}

/** Modern document header — company block left, document label right. */
function drawHeader(doc: jsPDF, input: DocInput): number {
  const { settings, service, kind } = input
  let y = M

  // Top brand bar
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_W, 3, 'F')
  y = 12

  const cy = drawCompanyBlock(doc, settings, y)

  // Document label block (right aligned)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(TITLES[kind], PAGE_W - M, y + 5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`No: ${docTitle(kind, service, input.settings)}`, PAGE_W - M, y + 10.5, { align: 'right' })
  doc.text(`Date: ${formatDateShort(service.serviceDate)}`, PAGE_W - M, y + 15, { align: 'right' })
  if (kind !== 'receipt') {
    doc.text(`Status: ${clean(service.status)}`, PAGE_W - M, y + 19.5, { align: 'right' })
  }

  const headerBottom = Math.max(cy, y + 23)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.4)
  doc.line(M, headerBottom, PAGE_W - M, headerBottom)
  return headerBottom + 6
}

function drawLogoPlaceholder(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(...BRAND)
  doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('TCT', x + size / 2, y + size / 2 + 3, { align: 'center' })
}

function drawFooter(doc: jsPDF, input: DocInput) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()

    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.line(M, h - 16, PAGE_W - M, h - 16)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND)
    doc.text(clean(input.settings.footerText || 'Thank you for choosing TECH CITY TECHNOLOGY'), PAGE_W / 2, h - 11, {
      align: 'center',
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(
      `${clean(input.settings.phone)}  |  ${clean(input.settings.email)}`,
      PAGE_W / 2,
      h - 7,
      { align: 'center' },
    )
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - M, h - 7, { align: 'right' })
    doc.text('Computer generated document', M, h - 7)
  }
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...BRAND)
  doc.rect(M, y - 3.6, 1.6, 4.6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(title.toUpperCase(), M + 4, y)
  return y + 4.5
}

/** Full-width dark bar used for the challan's section headings. */
function bandTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...BRAND)
  doc.rect(M, y - 4.2, CONTENT_W, 6.4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(clean(title).toUpperCase(), PAGE_W / 2, y + 0.4, { align: 'center' })
  return y + 5.6
}

/** Two-column key/value grid inside a light panel. */
function infoPanel(
  doc: jsPDF,
  y: number,
  rows: [string, string][],
  columns = 2,
): number {
  const visible = rows.filter(([, v]) => v && v !== '—')
  if (!visible.length) return y
  const colW = CONTENT_W / columns
  const lineH = 5
  const perCol = Math.ceil(visible.length / columns)
  const boxH = perCol * lineH + 5

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)
  doc.roundedRect(M, y, CONTENT_W, boxH, 1.6, 1.6, 'FD')

  visible.forEach((row, idx) => {
    const col = Math.floor(idx / perCol)
    const rowIdx = idx % perCol
    const x = M + col * colW + 3.5
    const ty = y + 5.5 + rowIdx * lineH

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(...MUTED)
    doc.text(clean(row[0]), x, ty)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.6)
    doc.setTextColor(...INK)
    const value = doc.splitTextToSize(clean(row[1]), colW - 32)[0] ?? ''
    doc.text(value, x + 30, ty)
  })

  return y + boxH + 5
}

/** Long-form text block (complaint, diagnosis, work performed). */
function textBlock(doc: jsPDF, y: number, label: string, value?: string): number {
  if (!value?.trim()) return y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(clean(label).toUpperCase(), M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(clean(value), CONTENT_W)
  doc.text(lines, M, y + 4.2)
  return y + 4.2 + lines.length * 4.1 + 3
}

function pageBreakIfNeeded(doc: jsPDF, y: number, needed = 40): number {
  const h = doc.internal.pageSize.getHeight()
  if (y + needed > h - 22) {
    doc.addPage()
    return M + 4
  }
  return y
}

/** Draws a labelled checkbox at (x, yBaseline). Returns the x after the label. */
function checkbox(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  checked: boolean,
): number {
  const size = 3
  const gap = 1.4
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.3)
  doc.rect(x, y - size + 0.5, size, size, 'S')
  if (checked) {
    doc.setFillColor(...BRAND)
    doc.rect(x + 0.4, y - size + 0.9, size - 0.8, size - 0.8, 'F')
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text(clean(label), x + size + gap, y)
  return x + size + gap + doc.getTextWidth(clean(label)) + 4.5
}

/** Field row: label left, then an underline (or the value) running to width. */
function fieldRow(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  opts: { labelW?: number; valueWidth?: number; boldValue?: boolean } = {},
): void {
  const labelW = opts.labelW ?? 46
  const valueWidth = opts.valueWidth ?? CONTENT_W - labelW
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(clean(label), M, y)

  doc.setFont('helvetica', opts.boldValue ? 'bold' : 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const v = clean(value)
  const lineX = M + labelW
  if (v) {
    doc.text(v, lineX, y)
  } else {
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.25)
    doc.line(lineX, y + 0.5, lineX + valueWidth, y + 0.5)
  }
}

/* ------------------------------------------------------------------ */
/* Delivery Challan (Service / Installation Report)                    */
/* ------------------------------------------------------------------ */

/**
 * Builds the Service Report in the shop's Delivery Challan format — the same
 * form the business prints: customer block, service nature + equipment type
 * checkboxes, product information, complaint / action taken, and a work
 * completion certificate with signatures.
 */
export function buildChallanDocument(input: DocInput): jsPDF {
  const { service, customer, parts, settings } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: `SERVICE / INSTALLATION REPORT ${service.code}`,
    subject: `${service.serviceType} - ${customer.name}`,
    author: settings.name,
    creator: settings.name,
  })

  // ---- Letterhead -------------------------------------------------
  let y = 13
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_W, 3, 'F')
  const cy = drawCompanyBlock(doc, settings, y)

  // Right-aligned document identity
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('SERVICE / INSTALLATION REPORT', PAGE_W - M, y + 5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`S. No: ${clean(service.code)}`, PAGE_W - M, y + 10.5, { align: 'right' })
  doc.text(`Date: ${formatDateShort(service.serviceDate)}`, PAGE_W - M, y + 15, { align: 'right' })
  doc.text(`Status: ${clean(service.status)}`, PAGE_W - M, y + 19.5, { align: 'right' })

  const headerBottom = Math.max(cy, y + 23)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.4)
  doc.line(M, headerBottom, PAGE_W - M, headerBottom)
  y = headerBottom + 5

  // ---- Customer + service details panel ---------------------------
  const product = service.product ? clean(service.product) : ''

  const isNewInstallation = /install/i.test(service.serviceType)
  const isWarranty = /warrant/i.test(service.serviceType)
  const isAmc = /amc/i.test(service.serviceType)
  const isOnCall = !isNewInstallation && !isWarranty && !isAmc

  const p = product.toLowerCase()
  const isCctv = /cctv|camera|dvr|nvr/i.test(p)
  const isLaptop = /laptop|notebook/i.test(p)
  const isDesktop = /desktop|pc|computer|cpu/i.test(p)
  const equipmentTicked = isCctv ? 'CCTV Analog / IP' : isLaptop ? 'Laptop' : isDesktop ? 'Desktop' : 'Others'

  // Plain detail rows (full width)
  const rows: [string, string][] = [
    ['Customer Name', customer.name],
    ['Address', [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')],
    ['Contact Person', ''],
    ['Landline / Mobile No', [customer.phone, customer.altPhone].filter(Boolean).join(' / ')],
  ]

  const rowH = 7.2
  const labelW = 56
  const available = CONTENT_W - labelW - 4

  // Pre-wrap the detail values so long addresses fold instead of overflowing
  const prepped = rows.map(([label, value]) => {
    const full = clean(value)
    const wrapped = full ? doc.splitTextToSize(full, available) : []
    return {
      label: `${label} :`,
      first: (wrapped[0] as string | undefined) ?? full,
      extra: (wrapped.slice(1, 3) as string[]) ?? [],
    }
  })

  const detailH = prepped.reduce((sum, r) => sum + rowH + r.extra.length * 3.4, 0)
  const panelH = detailH + rowH * 2 + 5 // + 2 checkbox rows + padding
  const boxTop = y

  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, boxTop, CONTENT_W, panelH, 1.2, 1.2, 'S')

  let ry = boxTop + 5.4
  prepped.forEach((r) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(clean(r.label), M, ry)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    if (r.first) {
      doc.text(r.first, M + labelW, ry)
    } else {
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.25)
      doc.line(M + labelW, ry + 0.5, M + labelW + available, ry + 0.5)
    }
    if (r.extra.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.2)
      doc.setTextColor(...INK)
      doc.text(r.extra, M + labelW, ry + 3.6)
    }
    ry += rowH + r.extra.length * 3.4
  })

  // Service Type checkboxes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Service Type :', M, ry)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let cx = M + labelW
  cx = checkbox(doc, cx, ry, 'New Installation', isNewInstallation)
  cx = checkbox(doc, cx, ry, 'Warranty', isWarranty)
  cx = checkbox(doc, cx, ry, 'AMC', isAmc)
  checkbox(doc, cx, ry, 'On Call Charges', isOnCall)
  ry += rowH

  // Equipment Type checkboxes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Equipment Type :', M, ry)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  cx = M + labelW
  cx = checkbox(doc, cx, ry, 'CCTV Analog / IP', equipmentTicked === 'CCTV Analog / IP')
  cx = checkbox(doc, cx, ry, 'Laptop', equipmentTicked === 'Laptop')
  cx = checkbox(doc, cx, ry, 'Desktop', equipmentTicked === 'Desktop')
  checkbox(doc, cx, ry, 'Others', equipmentTicked === 'Others')

  y = boxTop + panelH + 7

  // ---- Installation / Service product information -----------------
  y = pageBreakIfNeeded(doc, y, 55)
  y = bandTitle(doc, 'Installation / Service Product Information', y) + 1

  const descLines: string[] = []
  if (service.product) {
    const extra = [service.brand, service.model].filter(Boolean).join(' ')
    const withSerial = service.serialNumber
      ? `${service.product}${extra ? ` (${extra})` : ''} — SN: ${service.serialNumber}`
      : `${service.product}${extra ? ` (${extra})` : ''}`
    descLines.push(withSerial)
  }
  parts.forEach((p2) => {
    descLines.push(
      `${p2.name}${p2.quantity > 1 ? `  x${p2.quantity}` : ''}${
        p2.unitPrice > 0 ? `  @ Rs. ${formatAmount(p2.unitPrice)}` : ''
      }`,
    )
  })
  if (!descLines.length) descLines.push('—')

  const body = descLines.map((d, i) => [String(i + 1), clean(d)])
  autoTable(doc, {
    startY: y,
    head: [['S No', 'Product Description']],
    body,
    theme: 'grid',
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
    headStyles: { fillColor: [235, 238, 243], textColor: INK, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 'auto' } },
  })
  // @ts-expect-error - lastAutoTable is added by jspdf-autotable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 4

  // ---- Remaining job-sheet fields ---------------------------------
  y = pageBreakIfNeeded(doc, y, 62)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  const replaced = parts.length > 0
  fieldRow(doc, y, 'Wiring Measurement in Mtrs :', '', { labelW: 60 })
  fieldRow(doc, y + 8, 'Person got Trained (Name, Designation, Contact No) :', '', { labelW: 88 })

  // Product replaced: Yes / No checkboxes, then "Specify"
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text('Whether Product replaced :', M, y + 16)
  let bx = M + 50
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  bx = checkbox(doc, bx, y + 16, 'Yes', replaced)
  bx = checkbox(doc, bx, y + 16, 'No', !replaced)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(`Specify : ${parts.map((p2) => clean(p2.name)).join(', ') || 'N/A'}`, bx + 2, y + 16)

  y += 29

  // Compact labelled blocks for complaint / action / remarks
  function jobBlock(doc: jsPDF, y: number, label: string, value?: string): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(clean(label).toUpperCase(), M, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.6)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(clean(value) || '—', CONTENT_W)
    doc.text(lines, M, y + 3.6)
    return y + 3.6 + lines.length * 4 + 4.5
  }

  y = jobBlock(doc, y, 'Nature of Complaint', service.complaint)
  y = jobBlock(doc, y, 'Action Taken', [service.diagnosis, service.workPerformed].filter(Boolean).join('  •  '))
  y = jobBlock(doc, y, 'Customer Remarks / Feed Back', service.notes)

  // ---- Work completion certificate --------------------------------
  y = pageBreakIfNeeded(doc, y, 64)
  y = bandTitle(doc, 'Work Completion Certificate', y) + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.4)
  doc.setTextColor(...INK)
  const installOf = product
    ? `Installation of "${product}"`
    : 'Installation'
  const certSentence = service.serviceType
    ? `${installOf} (Service: ${clean(service.serviceType)}) for "${clean(
        customer.name,
      )}" has been successfully completed on ${formatDateShort(service.serviceDate)}.`
    : `${installOf} for "${clean(
        customer.name,
      )}" has been successfully completed on ${formatDateShort(service.serviceDate)}.`
  const certText = doc.splitTextToSize(certSentence, CONTENT_W - 6)
  doc.text(certText, M + 2, y + 1.5)
  y += 2.5 + certText.length * 4.2

  // Dates + time row
  const halfW = (CONTENT_W - 8) / 2
  fieldRow(doc, y, 'Installation Commenced Date', service.serviceDate, { labelW: 52, valueWidth: halfW - 40, boldValue: true })
  fieldRow(doc, y, 'Completed Date', '', { labelW: 38, valueWidth: halfW - 8 })
  y += 7.5
  fieldRow(doc, y, 'TIME IN :', '', { labelW: 30, valueWidth: halfW - 14 })
  fieldRow(doc, y, 'TIME OUT :', '', { labelW: 30, valueWidth: halfW - 14 })
  y += 14

  // Signatures
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(M, y, M + 60, y)
  doc.line(PAGE_W - M - 60, y, PAGE_W - M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Customer Representative Sign', M, y + 4.5)
  doc.text('Company Seal and Date', M, y + 9)
  doc.text(`For ${clean(settings.name)}`, PAGE_W - M, y + 4.5, { align: 'right' })
  doc.text(
    service.technician ? `Service Engineer Sign (${clean(service.technician)})` : 'Service Engineer Sign',
    PAGE_W - M,
    y + 9,
    { align: 'right' },
  )

  return doc
}

/* ------------------------------------------------------------------ */
/* Quotation                                                           */
/* ------------------------------------------------------------------ */

export function buildQuotationDocument(input: QuotationDocInput): jsPDF {
  const { quotation, customer, settings } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: `Quotation ${quotation.code}`,
    subject: `${customer.name} - ${customer.code}`,
    author: settings.name,
    creator: settings.name,
  })

  let y = 13
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_W, 3, 'F')
  const cy = drawCompanyBlock(doc, settings, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('QUOTATION', PAGE_W - M, y + 5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`No: ${clean(quotation.code)}`, PAGE_W - M, y + 10.5, { align: 'right' })
  doc.text(`Date: ${formatDateShort(quotation.date)}`, PAGE_W - M, y + 15, { align: 'right' })
  if (quotation.validUntil) {
    doc.text(`Valid until: ${formatDateShort(quotation.validUntil)}`, PAGE_W - M, y + 19.5, { align: 'right' })
  }
  doc.text(`Status: ${clean(quotation.status)}`, PAGE_W - M, quotation.validUntil ? y + 24 : y + 19.5, {
    align: 'right',
  })

  const headerBottom = Math.max(cy, quotation.validUntil ? y + 26 : y + 22)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.4)
  doc.line(M, headerBottom, PAGE_W - M, headerBottom)
  y = headerBottom + 6

  // Bill to
  y = sectionTitle(doc, 'Quotation To', y)
  const custRows: [string, string][] = [
    ['Name', customer.name],
    ['Customer ID', customer.code],
    ['Phone', [customer.phone, customer.altPhone].filter(Boolean).join(' / ')],
    ['Email', customer.email ?? ''],
    ['Address', [customer.address, customer.city].filter(Boolean).join(', ')],
  ]
  if (customer.gstNumber) custRows.push(['GST Number', customer.gstNumber])
  y = infoPanel(doc, y, custRows)

  // Items
  y = pageBreakIfNeeded(doc, y, 55)
  y = sectionTitle(doc, 'Items', y)
  const rows = quotation.items.map((it, i) => [
    String(i + 1),
    clean(it.name),
    String(it.quantity),
    formatAmount(it.unitPrice),
    formatAmount(it.amount),
  ])
  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
    body: rows,
    theme: 'grid',
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 2.6, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.4 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  })
  // @ts-expect-error - lastAutoTable is added by jspdf-autotable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  // Totals
  const summary: [string, string][] = [
    ['Subtotal', money(quotation.subtotal)],
    ['Discount', quotation.discount > 0 ? `- ${money(quotation.discount)}` : money(0)],
    [`Tax / GST (${quotation.taxPercent}%)`, money(quotation.taxAmount)],
  ]
  const boxW = 82
  const boxX = PAGE_W - M - boxW
  const rowH = 5.8
  const boxH = summary.length * rowH + 9

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.roundedRect(boxX, y, boxW, boxH, 1.6, 1.6, 'FD')

  let ty = y + 6
  summary.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.6)
    doc.setTextColor(...MUTED)
    doc.text(clean(label), boxX + 3, ty)
    doc.setTextColor(...INK)
    doc.text(clean(value), boxX + boxW - 3, ty, { align: 'right' })
    ty += rowH
  })
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.line(boxX + 3, ty - 3.2, boxX + boxW - 3, ty - 3.2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND)
  doc.text('Grand Total', boxX + 3, ty + 1.2)
  doc.text(money(quotation.totalAmount), boxX + boxW - 3, ty + 1.2, { align: 'right' })

  y += boxH + 6

  // Notes / terms
  if (quotation.notes?.trim()) {
    y = pageBreakIfNeeded(doc, y, 25)
    y = textBlock(doc, y, 'Notes', quotation.notes)
  }
  if (settings.terms?.trim()) {
    y = pageBreakIfNeeded(doc, y, 30)
    y = sectionTitle(doc, 'Terms & Conditions', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.6)
    doc.setTextColor(...MUTED)
    const lines = settings.terms
      .split('\n')
      .flatMap((line) => doc.splitTextToSize(clean(line), CONTENT_W) as string[])
    doc.text(lines, M, y)
    y += lines.length * 3.3 + 6
  }

  // Signatures
  y = pageBreakIfNeeded(doc, y, 26)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(M, y + 10, M + 55, y + 10)
  doc.line(PAGE_W - M - 55, y + 10, PAGE_W - M, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.setTextColor(...MUTED)
  doc.text('Customer Acceptance (Sign & Date)', M, y + 14)
  doc.text(`For ${clean(settings.name)}`, PAGE_W - M, y + 14, { align: 'right' })

  return doc
}

/* ------------------------------------------------------------------ */
/* Modern documents (invoice / receipt / history)                      */
/* ------------------------------------------------------------------ */

function buildModernDocument(input: DocInput): jsPDF {
  const { service, customer, parts, settings, kind } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: `${TITLES[kind]} ${docTitle(kind, service, settings)}`,
    subject: `${service.serviceType} - ${customer.name}`,
    author: settings.name,
    creator: settings.name,
  })

  let y = drawHeader(doc, input)

  /* Customer + service summary */
  y = sectionTitle(doc, kind === 'invoice' ? 'Bill To' : 'Customer Details', y)
  const customerRows: [string, string][] = [
    ['Name', customer.name],
    ['Customer ID', customer.code],
    ['Phone', [customer.phone, customer.altPhone].filter(Boolean).join(' / ')],
    ['Email', customer.email ?? ''],
  ]
  if (customer.gstNumber) customerRows.push(['GST Number', customer.gstNumber])
  customerRows.push(['Address', [customer.address, customer.city].filter(Boolean).join(', ')])
  customerRows.push(['Pincode', customer.pincode ?? ''])
  y = infoPanel(doc, y, customerRows)

  y = pageBreakIfNeeded(doc, y, 45)
  y = sectionTitle(doc, 'Service Details', y)
  y = infoPanel(doc, y, [
    ['Service ID', service.code],
    ['Service Date', formatDateLong(service.serviceDate)],
    ['Service Type', service.serviceType],
    ['Status', service.status],
    ['Service Mode', service.serviceMode],
    ['Device / Product', service.product ?? ''],
    ['Brand', service.brand ?? ''],
    ['Model', service.model ?? ''],
    ['Serial Number', service.serialNumber ?? ''],
    ['Technician', service.technician ?? ''],
  ])

  if (kind !== 'receipt') {
    y = pageBreakIfNeeded(doc, y, 30)
    y = textBlock(doc, y, 'Complaint / Problem Reported', service.complaint)
    y = pageBreakIfNeeded(doc, y, 25)
    y = textBlock(doc, y, 'Diagnosis', service.diagnosis)
    y = pageBreakIfNeeded(doc, y, 25)
    y = textBlock(doc, y, 'Work Performed', service.workPerformed)
    y += 1
  }

  /* Parts / charges table */
  y = pageBreakIfNeeded(doc, y, 50)
  y = sectionTitle(doc, kind === 'invoice' ? 'Items & Charges' : 'Parts Replaced & Charges', y)

  const body: (string | number)[][] = []
  parts.forEach((p, i) => {
    body.push([
      String(i + 1),
      clean(p.name),
      String(p.quantity),
      formatAmount(p.unitPrice),
      formatAmount(p.total),
    ])
  })

  const partsListed = parts.reduce((s, p) => s + p.total, 0)
  // If parts cost was entered without itemised rows, show a single summary line.
  if (!parts.length && service.partsCost > 0) {
    body.push([String(body.length + 1), 'Parts / materials used', '1', formatAmount(service.partsCost), formatAmount(service.partsCost)])
  } else if (parts.length && Math.abs(partsListed - service.partsCost) > 0.5) {
    body.push([
      String(body.length + 1),
      'Other parts / materials',
      '1',
      formatAmount(service.partsCost - partsListed),
      formatAmount(service.partsCost - partsListed),
    ])
  }
  if (service.serviceCharge > 0) {
    body.push([
      String(body.length + 1),
      `Service charge - ${clean(service.serviceType)}`,
      '1',
      formatAmount(service.serviceCharge),
      formatAmount(service.serviceCharge),
    ])
  }
  if ((service.deliveryCharge ?? 0) > 0) {
    body.push([
      String(body.length + 1),
      'Delivery / travel charge',
      '1',
      formatAmount(service.deliveryCharge ?? 0),
      formatAmount(service.deliveryCharge ?? 0),
    ])
  }
  if (!body.length) {
    body.push([String(1), `${clean(service.serviceType)} (no charge)`, '1', '0.00', '0.00'])
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
    body,
    theme: 'grid',
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica',
      fontSize: 8.6,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.4,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
  })

  // @ts-expect-error - lastAutoTable is added by jspdf-autotable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  /* Financial summary */
  y = pageBreakIfNeeded(doc, y, 55)
  const gross = service.serviceCharge + service.partsCost + (service.deliveryCharge ?? 0)
  const subtotal = Math.max(0, gross - service.discount)
  const taxAmount = Math.round(subtotal * ((service.taxPercent || 0) / 100) * 100) / 100

  const summary: [string, string, boolean?][] = [
    ['Service Charge', money(service.serviceCharge)],
    ['Parts Cost', money(service.partsCost)],
  ]
  if ((service.deliveryCharge ?? 0) > 0)
    summary.push(['Delivery / Travel', money(service.deliveryCharge ?? 0)])
  if (service.discount > 0) summary.push(['Discount', `- ${money(service.discount)}`])
  if (settings.gstEnabled && (service.taxPercent || 0) > 0) {
    summary.push(['Subtotal', money(subtotal)])
    summary.push([`Tax / GST (${service.taxPercent}%)`, money(taxAmount)])
  }
  summary.push(['Total Amount', money(service.totalAmount), true])
  summary.push(['Amount Paid', money(service.amountPaid)])
  summary.push(['Balance Due', money(service.balance), true])

  const boxW = 82
  const boxX = PAGE_W - M - boxW
  const rowH = 5.6
  const boxH = summary.length * rowH + 4

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.roundedRect(boxX, y, boxW, boxH, 1.6, 1.6, 'FD')

  summary.forEach((row, i) => {
    const ty = y + 6 + i * rowH - 1.2
    const emphasise = Boolean(row[2])
    if (emphasise) {
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.2)
      doc.line(boxX + 2.5, ty - 3.8, boxX + boxW - 2.5, ty - 3.8)
    }
    doc.setFont('helvetica', emphasise ? 'bold' : 'normal')
    doc.setFontSize(emphasise ? 9.2 : 8.6)
    doc.setTextColor(...(emphasise ? INK : MUTED))
    doc.text(clean(row[0]), boxX + 3, ty)
    doc.setTextColor(...INK)
    doc.text(clean(row[1]), boxX + boxW - 3, ty, { align: 'right' })
  })

  // Payment status stamp + method on the left of the summary box
  const stampY = y + 2
  const paid = service.paymentStatus === 'Paid'
  const stampColor: [number, number, number] = paid
    ? [16, 133, 90]
    : service.paymentStatus === 'Partially Paid'
      ? [180, 120, 10]
      : [190, 45, 45]
  doc.setDrawColor(...stampColor)
  doc.setLineWidth(0.7)
  doc.roundedRect(M, stampY, 46, 12, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...stampColor)
  doc.text(service.paymentStatus.toUpperCase(), M + 23, stampY + 7.6, { align: 'center' })

  if (service.paymentMethod) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(...MUTED)
    doc.text(`Payment Method: ${clean(service.paymentMethod)}`, M, stampY + 18)
  }

  y = y + boxH + 6

  /* Payment history (receipts / partially paid invoices) */
  const payments = input.payments ?? []
  if (payments.length > 1 || kind === 'receipt') {
    if (payments.length) {
      y = pageBreakIfNeeded(doc, y, 40)
      y = sectionTitle(doc, 'Payment History', y)
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Method', 'Note', 'Amount']],
        body: payments.map((p) => [
          formatDateShort(p.date),
          clean(p.method),
          clean(p.note ?? ''),
          formatAmount(p.amount),
        ]),
        theme: 'grid',
        margin: { left: M, right: M },
        styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
        headStyles: { fillColor: [235, 238, 243], textColor: INK, fontStyle: 'bold', fontSize: 8.2 },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 30 }, 3: { cellWidth: 30, halign: 'right' } },
      })
      // @ts-expect-error - runtime property
      y = (doc.lastAutoTable?.finalY ?? y) + 6
    }
  }

  /* Warranty + next service */
  if (kind !== 'receipt') {
    const warrantyRows: [string, string][] = [
      ['Warranty Period', service.warrantyPeriod ?? 'Not applicable'],
      ['Warranty Expiry', service.warrantyExpiry ? formatDateLong(service.warrantyExpiry) : 'Not applicable'],
      ['Next Service Due', service.nextServiceDate ? formatDateLong(service.nextServiceDate) : 'Not scheduled'],
    ]
    y = pageBreakIfNeeded(doc, y, 30)
    y = sectionTitle(doc, 'Warranty & Next Service', y)
    y = infoPanel(doc, y, warrantyRows, 3)
  }

  if (service.notes?.trim()) {
    y = pageBreakIfNeeded(doc, y, 25)
    y = textBlock(doc, y, 'Additional Notes', service.notes)
  }

  /* Terms */
  if (settings.terms?.trim()) {
    y = pageBreakIfNeeded(doc, y, 34)
    y = sectionTitle(doc, 'Terms & Conditions', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.6)
    doc.setTextColor(...MUTED)
    const termLines = settings.terms
      .split('\n')
      .flatMap((line) => doc.splitTextToSize(clean(line), CONTENT_W) as string[])
    doc.text(termLines, M, y)
    y += termLines.length * 3.3 + 6
  }

  /* Signatures */
  y = pageBreakIfNeeded(doc, y, 26)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(M, y + 12, M + 55, y + 12)
  doc.line(PAGE_W - M - 55, y + 12, PAGE_W - M, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.setTextColor(...MUTED)
  doc.text('Customer Signature', M, y + 16)
  doc.text(`For ${clean(settings.name)}`, PAGE_W - M, y + 16, { align: 'right' })

  drawFooter(doc, input)
  return doc
}

/* ------------------------------------------------------------------ */
/* Main builder + output helpers                                       */
/* ------------------------------------------------------------------ */

export function buildDocument(input: DocInput): jsPDF {
  if (input.kind === 'report') return buildChallanDocument(input)
  return buildModernDocument(input)
}

export function documentFilename(input: DocInput): string {
  const prefix = input.kind === 'invoice' ? 'Invoice' : input.kind === 'receipt' ? 'Receipt' : 'ServiceReport'
  const safeName = input.customer.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${prefix}-${input.service.code}-${safeName}.pdf`
}

export function downloadDocument(input: DocInput) {
  const doc = buildDocument(input)
  doc.save(documentFilename(input))
}

export function documentBlob(input: DocInput): Blob {
  return buildDocument(input).output('blob')
}

export function documentDataUri(input: DocInput): string {
  return buildDocument(input).output('datauristring')
}

export function documentObjectUrl(input: DocInput): string {
  return URL.createObjectURL(documentBlob(input))
}

/** Opens the browser print dialog with the generated PDF (hidden iframe). */
export function printDocument(input: DocInput): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = documentObjectUrl(input)
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.right = '0'
      frame.style.bottom = '0'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      frame.src = url
      frame.onload = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
          resolve()
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Print failed'))
        }
        setTimeout(() => {
          document.body.removeChild(frame)
          URL.revokeObjectURL(url)
        }, 60_000)
      }
      frame.onerror = () => reject(new Error('Could not load the PDF for printing'))
      document.body.appendChild(frame)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Print failed'))
    }
  })
}

export function pdfFile(input: DocInput): File {
  return new File([documentBlob(input)], documentFilename(input), { type: 'application/pdf' })
}

/* Quotation output helpers */

export function quotationFilename(input: QuotationDocInput): string {
  const safeName = input.customer.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `Quotation-${input.quotation.code}-${safeName}.pdf`
}

export function downloadQuotation(input: QuotationDocInput) {
  buildQuotationDocument(input).save(quotationFilename(input))
}

export function quotationBlob(input: QuotationDocInput): Blob {
  return buildQuotationDocument(input).output('blob')
}

export function quotationObjectUrl(input: QuotationDocInput): string {
  return URL.createObjectURL(quotationBlob(input))
}

/**
 * Shares the generated PDF through the OS share sheet (Web Share API).
 * Lives here rather than in share.ts so the heavy jsPDF bundle stays in this
 * lazily-loaded chunk. Returns 'unsupported' when the browser cannot share files.
 */
export async function sharePDFDocument(
  input: DocInput,
  text: string,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share)
    return 'unsupported'
  const file = pdfFile(input)
  if (!navigator.canShare({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({
      files: [file],
      title: `${input.settings.name} — ${input.service.code}`,
      text,
    })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    throw err
  }
}
