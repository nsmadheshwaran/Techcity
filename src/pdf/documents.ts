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
import { formatAmount, formatDateShort } from '@/utils/format'

/**
 * Standard A4 PDF generation for Techcity Technology:
 * - Quotation / Purchase Order (Tally ERP style grid layout)
 * - Service / Installation Report (Authentic job card & work completion certificate)
 * - Tax Invoice (Tally ERP style with HSN/SAC breakdown & Bank Details)
 *
 * Uses the company's original logo (logo-tc.jpg) and works fully offline.
 */

const INK: [number, number, number] = [20, 20, 20]
const LINE: [number, number, number] = [60, 60, 60]
const BRAND_ORANGE: [number, number, number] = [190, 75, 20]

const M = 10 // page margin in mm
const PAGE_W = 210
const CONTENT_W = PAGE_W - M * 2 // 190 mm

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

/* ------------------------------------------------------------------ */
/* Text & Number to Words helpers                                     */
/* ------------------------------------------------------------------ */

function clean(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/₹/g, 'Rs. ')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

export function numberToWordsIndian(amount: number): string {
  if (!amount || amount === 0) return 'Zero'
  const abs = Math.abs(amount)
  const integerPart = Math.floor(abs)
  const decimalPart = Math.round((abs - integerPart) * 100)

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n]
    return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
  }

  function convertThreeDigits(n: number): string {
    if (n === 0) return ''
    if (n < 100) return convertTwoDigits(n)
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertTwoDigits(n % 100) : '')
  }

  let n = integerPart
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const remainder = n

  const parts: string[] = []
  if (crore) parts.push(convertTwoDigits(crore) + ' Crore')
  if (lakh) parts.push(convertTwoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(convertTwoDigits(thousand) + ' Thousand')
  if (remainder) parts.push(convertThreeDigits(remainder))

  const words = parts.join(' ').trim() || 'Zero'
  let result = words

  if (decimalPart > 0) {
    result += ` and ${convertTwoDigits(decimalPart)} paise`
  }
  return result
}

function resolveLogo(settings: BusinessSettings): { data: string; format: 'PNG' | 'JPEG' } | null {
  const src = settings.logoDataUrl || logoDefault
  if (!src) return null
  const fmt = src.includes('image/png') ? ('PNG' as const) : ('JPEG' as const)
  return { data: src, format: fmt }
}

function docTitle(kind: DocKind, service: Service, settings: BusinessSettings): string {
  if (kind === 'invoice') return `${settings.invoicePrefix || 'TCT/'}${service.code.replace(/^TC-SRV-/, '')}/25-26`
  return service.code
}

function drawCheckbox(doc: jsPDF, x: number, y: number, label: string, checked: boolean): number {
  const size = 3
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.25)
  doc.rect(x, y - 2.5, size, size, 'S')
  if (checked) {
    doc.setFillColor(...INK)
    doc.rect(x + 0.5, y - 2, size - 1, size - 1, 'F')
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text(clean(label), x + size + 1.5, y)
  return x + size + 1.5 + doc.getTextWidth(clean(label)) + 4
}

/* ------------------------------------------------------------------ */
/* 1. Quotation Document (PDF 1 - Purchase Order / Quotation Format)  */
/* ------------------------------------------------------------------ */

export function buildQuotationDocument(input: QuotationDocInput): jsPDF {
  const { quotation, customer, settings } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  doc.setProperties({
    title: `Quotation ${quotation.code}`,
    subject: `Quotation for ${customer.name}`,
    author: settings.name || 'TECHCITY TECHNOLOGY',
    creator: settings.name || 'TECHCITY TECHNOLOGY',
  })

  // Document Title at the very top
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Purchase Order', PAGE_W / 2, 7.5, { align: 'center' })

  const topY = 9.5
  const outerH = 277 // Height of main bordered card
  const bottomY = topY + outerH

  // Outer border box
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.28)
  doc.rect(M, topY, CONTENT_W, outerH, 'S')

  const splitX = M + 95 // Vertical divider between Left (Company) and Right (Voucher details)

  // 1. Top Header Box: Company info left, Voucher info right
  const headerH = 43
  doc.line(M, topY + headerH, M + CONTENT_W, topY + headerH)
  doc.line(splitX, topY, splitX, topY + headerH)

  // Company logo
  const logo = resolveLogo(settings)
  const logoW = 24
  const logoH = 20
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, M + 2.5, topY + 3, logoW, logoH, undefined, 'FAST')
    } catch {
      // ignore
    }
  }

  // Company details left
  const compX = M + logoW + 5
  let cy = topY + 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(clean(settings.name || 'TECHCITY TECHNOLOGY'), compX, cy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(60, 60, 60)
  cy += 4

  const addressLines = [
    clean(settings.address || '#180 E, S.N.G. NAGAR'),
    'AMMAPALAYAM, TIRUPUR',
    'Tamil Nadu - 641 652, India',
    `Contact: ${clean(settings.phone || '99423 52999')}`,
    `E-Mail: ${clean(settings.email || 'techcitytup@gmail.com')}`,
  ]
  for (const line of addressLines) {
    doc.text(line, compX, cy)
    cy += 3.3
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(`GSTIN/UIN: ${clean(settings.gstNumber || '33ATNPN0599F1ZF')}`, compX, cy)

  // Voucher details right
  const rightMidY = topY + 12
  doc.line(splitX, rightMidY, M + CONTENT_W, rightMidY)

  const vSplitX = splitX + 46
  doc.line(vSplitX, topY, vSplitX, rightMidY)

  // Voucher No.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Voucher No.:', splitX + 2, topY + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(clean(quotation.code || '4'), splitX + 2, topY + 8.5)

  // Dated
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Dated:', vSplitX + 2, topY + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(formatDateShort(quotation.date), vSplitX + 2, topY + 8.5)

  // Mode/Terms of Payment
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Mode/Terms of Payment:', splitX + 2, rightMidY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text(clean(quotation.notes || '100% advance'), splitX + 2, rightMidY + 9.5)

  // 2. Buyer (Bill to) section
  const buyerH = 34
  const buyerY = topY + headerH
  doc.line(M, buyerY + buyerH, M + CONTENT_W, buyerY + buyerH)
  doc.line(splitX, buyerY, splitX, buyerY + buyerH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  doc.text('Buyer (Bill to)', M + 2, buyerY + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8)
  doc.setTextColor(...INK)
  doc.text(clean(customer.name), M + 2, buyerY + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  let custY = buyerY + 13
  const cAddress = [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')
  const wrappedAddress = doc.splitTextToSize(clean(cAddress), splitX - M - 4) as string[]
  for (const al of wrappedAddress.slice(0, 3)) {
    doc.text(al, M + 2, custY)
    custY += 3.4
  }
  doc.text(`GSTIN/UIN: ${clean(customer.gstNumber || '33BKKPS4037G1Z3')}`, M + 2, buyerY + 28)
  doc.text('State Name: Tamil Nadu Code: 33', M + 2, buyerY + 31.8)

  // 3. Items Table
  const tableStartY = buyerY + buyerH
  const taxPct = quotation.taxPercent || 18
  const halfTaxPct = taxPct / 2

  const tableBody: (string | number)[][] = quotation.items.map((it, idx) => [
    String(idx + 1),
    clean(it.name),
    `${taxPct} %`,
    `${it.quantity} NOS`,
    formatAmount(it.unitPrice),
    'NOS',
    '',
    '',
    formatAmount(it.amount),
  ])

  // Subtotal & taxes
  const subtotal = quotation.subtotal || quotation.items.reduce((s, it) => s + it.amount, 0)
  const cgstAmount = Math.round(subtotal * (halfTaxPct / 100) * 100) / 100
  const sgstAmount = Math.round(subtotal * (halfTaxPct / 100) * 100) / 100
  const totalWithTax = subtotal + cgstAmount + sgstAmount
  const roundOff = Math.round((quotation.totalAmount - totalWithTax) * 100) / 100

  tableBody.push(['', '', '', '', '', '', '', '', formatAmount(subtotal)])
  tableBody.push(['', `CENTRAL TAX (CGST ) @ ${halfTaxPct}%`, '', '', '', '', '', '', formatAmount(cgstAmount)])
  tableBody.push(['', `STATE TAX ( SGST) @ ${halfTaxPct}%`, '', '', '', '', '', '', formatAmount(sgstAmount)])
  if (roundOff !== 0) {
    tableBody.push(['', 'ROUND OFF', '', '', '', '', '', '', formatAmount(roundOff)])
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [
      ['Sl\nNo.', 'Description of Goods', 'GST\nRate', 'Quantity', 'Rate', 'per', 'Disc. %', 'Disc Amt', 'Amount'],
    ],
    body: tableBody,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'center',
      valign: 'middle',
      lineColor: LINE,
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
    },
  })

  // Table bottom border line & Total row
  // Horizontal line for Total
  const totalRowY = bottomY - 30
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.line(M, totalRowY, M + CONTENT_W, totalRowY)
  doc.line(M, totalRowY + 6, M + CONTENT_W, totalRowY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Total', splitX - 15, totalRowY + 4.2)
  doc.text(`Rs. ${formatAmount(quotation.totalAmount)}`, M + CONTENT_W - 3, totalRowY + 4.2, { align: 'right' })

  // Amount Chargeable in words
  const wordsY = totalRowY + 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.text(`Amount Chargeable (in words): INR ${numberToWordsIndian(quotation.totalAmount)} Only`, M + 2, wordsY)
  doc.setFont('helvetica', 'bold')
  doc.text('E. & O.E', M + CONTENT_W - 3, wordsY, { align: 'right' })

  // Declaration & Signature section
  const declY = totalRowY + 13
  doc.line(M, declY, M + CONTENT_W, declY)
  doc.line(splitX + 15, declY, splitX + 15, bottomY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.text('Declaration', M + 2, declY + 4)
  doc.setFont('helvetica', 'normal')
  const defaultTerms = 'One year product warranty from the date of installation. Payment 100% advance'
  const rawTerms = settings.terms ? settings.terms.split('\n').slice(0, 2).join(' ') : defaultTerms
  const termLines = doc.splitTextToSize(`Terms & Conditions. ${clean(rawTerms)}`, splitX + 12) as string[]
  let ty = declY + 8
  for (const tl of termLines.slice(0, 2)) {
    doc.text(tl, M + 2, ty)
    ty += 3.2
  }

  // Right signature
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.text(`for ${clean(settings.name || 'TECHCITY TECHNOLOGY')}`, M + CONTENT_W - 3, declY + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Authorised Signatory', M + CONTENT_W - 3, bottomY - 3, { align: 'right' })

  // Bottom caption outside box
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  doc.text('This is a Computer Generated Quotation', PAGE_W / 2, bottomY + 4.5, { align: 'center' })

  return doc
}

/* ------------------------------------------------------------------ */
/* 2. Service / Installation Report (PDF 2 - Authentic Job Card Format)*/
/* ------------------------------------------------------------------ */

export function buildChallanDocument(input: DocInput): jsPDF {
  const { service, customer, parts, settings } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  doc.setProperties({
    title: `SERVICE / INSTALLATION REPORT ${service.code}`,
    subject: `${service.serviceType} - ${customer.name}`,
    author: settings.name || 'TECHCITY TECHNOLOGY',
    creator: settings.name || 'TECHCITY TECHNOLOGY',
  })

  const topY = 9
  const outerH = 277
  const bottomY = topY + outerH

  // Outer border
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.rect(M, topY, CONTENT_W, outerH, 'S')

  // Top header box
  const headerH = 26
  doc.line(M, topY + headerH, M + CONTENT_W, topY + headerH)
  const rBadgeX = M + CONTENT_W - 38
  doc.line(rBadgeX, topY, rBadgeX, topY + headerH)

  // Company logo
  const logo = resolveLogo(settings)
  const logoW = 22
  const logoH = 19
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, M + 3, topY + 3.5, logoW, logoH, undefined, 'FAST')
    } catch {
      // ignore
    }
  }

  // Company Details
  const cTextX = M + logoW + 6
  let hy = topY + 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(clean(settings.name || 'TECH CITY TECHNOLOGY'), cTextX, hy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.setTextColor(50, 50, 50)
  hy += 4.5
  doc.text(clean(settings.address || '#180 E, S.N.G. NAGAR, AMMAPALAYAM, TIRUPUR - 641 652'), cTextX, hy)
  hy += 3.8
  doc.text(
    `Telephone No: ${clean(settings.phone || '99423 52999')}, Website: ${clean(
      settings.website || 'www.techcity.in',
    )}, Email Id: ${clean(settings.email || 'techcitytup@gmail.com')}`,
    cTextX,
    hy,
  )
  hy += 3.8
  doc.setFont('helvetica', 'bold')
  doc.text(`GST No: ${clean(settings.gstNumber || '33ATNPN0599F1ZF')}`, cTextX, hy)

  // Right Security Association badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('ELECTRONIC SECURITY', rBadgeX + 19, topY + 9, { align: 'center' })
  doc.text('ASSOCIATION OF INDIA', rBadgeX + 19, topY + 12.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('CERTIFIED INSTALLER', rBadgeX + 19, topY + 18, { align: 'center' })

  // Document Title band
  let cy = topY + headerH
  doc.setFillColor(245, 245, 245)
  doc.rect(M, cy, CONTENT_W, 7, 'FD')
  doc.line(M, cy + 7, M + CONTENT_W, cy + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text('SERVICE / INSTALLATION REPORT', PAGE_W / 2, cy + 5, { align: 'center' })
  cy += 7

  // Customer info section grid
  const rowH = 6.2
  const gridW = CONTENT_W

  // Row 1: S. No. & DATE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('S. No. :', M + 2, cy + 4.2)
  doc.setFont('helvetica', 'normal')
  doc.text(clean(service.code), M + 16, cy + 4.2)

  doc.setFont('helvetica', 'bold')
  doc.text('DATE :', M + gridW - 55, cy + 4.2)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDateShort(service.serviceDate), M + gridW - 40, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Row 2: Customer Name
  doc.setFont('helvetica', 'normal')
  doc.text('Customer Name :', M + 2, cy + 4.2)
  doc.setFont('helvetica', 'bold')
  doc.text(clean(customer.name), M + 32, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Row 3: Address
  doc.setFont('helvetica', 'normal')
  doc.text('Address :', M + 2, cy + 4.2)
  const fullCustAddress = [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')
  doc.text(clean(fullCustAddress), M + 32, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Row 4: Contact Person
  doc.setFont('helvetica', 'normal')
  doc.text('Contact Person :', M + 2, cy + 4.2)
  doc.text('—', M + 32, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Row 5: Landline / Mobile No
  doc.setFont('helvetica', 'normal')
  doc.text('Landline / Mobile No :', M + 2, cy + 4.2)
  doc.setFont('helvetica', 'bold')
  const phones = [customer.phone, customer.altPhone].filter(Boolean).join(' / ')
  doc.text(clean(phones), M + 36, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Service Type checkboxes
  const sType = service.serviceType.toLowerCase()
  const isInstall = /install/i.test(sType)
  const isWarranty = /warrant/i.test(sType)
  const isAmc = /amc/i.test(sType)
  const isOnCall = !isInstall && !isWarranty && !isAmc

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Service Type :', M + 2, cy + 4.5)
  let bx = M + 32
  bx = drawCheckbox(doc, bx, cy + 4.5, 'New Installation', isInstall)
  bx = drawCheckbox(doc, bx, cy + 4.5, 'Warranty', isWarranty)
  bx = drawCheckbox(doc, bx, cy + 4.5, 'AMC', isAmc)
  drawCheckbox(doc, bx, cy + 4.5, 'On Call Charges', isOnCall)
  cy += rowH + 1
  doc.line(M, cy, M + CONTENT_W, cy)

  // Equipment Type checkboxes
  const prodLower = (service.product || '').toLowerCase()
  const isCctv = /cctv|camera|dvr|nvr/i.test(prodLower)
  const isAccess = /access|biometric|rfid/i.test(prodLower)
  const isAlarm = /alarm|sensor/i.test(prodLower)
  const isFire = /fire/i.test(prodLower)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Equipment Type :', M + 2, cy + 4.5)
  let eqX = M + 32
  eqX = drawCheckbox(doc, eqX, cy + 4.5, 'Intrusion Alarm', isAlarm)
  eqX = drawCheckbox(doc, eqX, cy + 4.5, 'CCTV Analog / IP', isCctv)
  eqX = drawCheckbox(doc, eqX, cy + 4.5, 'Access Control', isAccess)
  cy += rowH
  let eqX2 = M + 32
  eqX2 = drawCheckbox(doc, eqX2, cy + 3.5, 'Time Attendance', false)
  eqX2 = drawCheckbox(doc, eqX2, cy + 3.5, 'Fire Alarm', isFire)
  doc.setFont('helvetica', 'normal')
  doc.text(`Others : ${clean(service.product || 'Desktop / Laptop')}`, eqX2 + 4, cy + 3.5)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  // Section Table: Installation / Service Product Information
  doc.setFillColor(245, 245, 245)
  doc.rect(M, cy, CONTENT_W, 6, 'FD')
  doc.line(M, cy + 6, M + CONTENT_W, cy + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Installation / Service Product Information', PAGE_W / 2, cy + 4.2, { align: 'center' })
  cy += 6

  const prodRows: (string | number)[][] = []
  if (service.product || service.brand) {
    const brandModel = [service.brand, service.model].filter(Boolean).join(' ')
    const snText = service.serialNumber ? ` (SN: ${service.serialNumber})` : ''
    prodRows.push([
      '1',
      clean(`${service.product || 'Equipment'} ${brandModel}${snText}`),
      '1 NOS',
    ])
  }
  parts.forEach((p) => {
    prodRows.push([
      String(prodRows.length + 1),
      clean(p.name),
      `${p.quantity} NOS`,
    ])
  })
  if (!prodRows.length) {
    prodRows.push(['1', `${clean(service.serviceType)} — Standard Service`, '1 NOS'])
  }

  autoTable(doc, {
    startY: cy,
    head: [['S No.', 'PRODUCT DESCRIPTION', 'Qty.']],
    body: prodRows,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 1.8,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.2,
    },
    headStyles: {
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 7.8,
      lineColor: LINE,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 24, halign: 'center' },
    },
  })

  // @ts-expect-error - runtime property
  cy = doc.lastAutoTable?.finalY ?? (cy + 25)
  doc.line(M, cy, M + CONTENT_W, cy)

  // Inspection rows
  function drawPlainFieldRow(label: string, value: string, height = 6.2) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.text(label, M + 2, cy + 4.2)
    if (value) {
      doc.setFont('helvetica', 'bold')
      doc.text(clean(value), M + 65, cy + 4.2)
    }
    cy += height
    doc.line(M, cy, M + CONTENT_W, cy)
  }

  drawPlainFieldRow('Wiring Measurement in Mtrs :', '')
  drawPlainFieldRow('Person got Trained (Name, Designation, Contact No) :', '')

  // Whether Product replaced
  const replaced = parts.length > 0
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.text('Whether Product replaced :', M + 2, cy + 4.2)
  let rX = M + 50
  rX = drawCheckbox(doc, rX, cy + 4.2, 'Yes', replaced)
  rX = drawCheckbox(doc, rX, cy + 4.2, 'No', !replaced)
  doc.text(`Specify : ${parts.map((p) => clean(p.name)).join(', ') || '—'}`, rX + 4, cy + 4.2)
  cy += rowH
  doc.line(M, cy, M + CONTENT_W, cy)

  drawPlainFieldRow('Nature of Complaint :', service.complaint)
  const actionTaken = [service.diagnosis, service.workPerformed].filter(Boolean).join(' • ')
  drawPlainFieldRow('Action Taken :', actionTaken || 'Checked and resolved successfully.')
  drawPlainFieldRow('Customer Remarks / Feed Back :', service.notes || 'Satisfied with service.')

  // WORK COMPLETION CERTIFICATE
  doc.setFillColor(245, 245, 245)
  doc.rect(M, cy, CONTENT_W, 6, 'FD')
  doc.line(M, cy + 6, M + CONTENT_W, cy + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('WORK COMPLETION CERTIFICATE', PAGE_W / 2, cy + 4.2, { align: 'center' })
  cy += 6

  // Certificate text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const certText = `It is to Certify that the Installation of "${clean(
    service.product || 'Equipment',
  )}" for "${clean(customer.name)}" has been successfully completed on ${formatDateShort(service.serviceDate)}.`
  doc.text(certText, M + 2, cy + 4.5)
  cy += 7.5
  doc.line(M, cy, M + CONTENT_W, cy)

  // Commencement and completion dates
  doc.text(`Installation Commenced Date: ${formatDateShort(service.serviceDate)}`, M + 2, cy + 4.5)
  doc.text(`Completed Date: ${formatDateShort(service.finishedDate || service.serviceDate)}`, M + 105, cy + 4.5)
  cy += 7.5
  doc.line(M, cy, M + CONTENT_W, cy)

  // TIME IN / TIME ON
  doc.text('TIME IN : 10:00 AM', M + 2, cy + 4.5)
  doc.text('TIME ON : 05:00 PM', M + 105, cy + 4.5)
  cy += 7.5
  doc.line(M, cy, M + CONTENT_W, cy)

  // Signatures
  doc.line(M + 95, cy, M + 95, bottomY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.text('Customer Representative Sign', M + 2, cy + 5)
  doc.text('Company Seal and Date', M + 2, bottomY - 3)

  const techName = service.technician ? ` (${clean(service.technician)})` : ''
  doc.text(clean(settings.name || 'TECH CITY TECHNOLOGY'), M + 98, cy + 5)
  doc.text(`Service Engineer Sign${techName}`, M + 98, bottomY - 3)

  return doc
}

/* ------------------------------------------------------------------ */
/* 3. Tax Invoice (PDF 3 - Tally ERP Style Format)                     */
/* ------------------------------------------------------------------ */

export function buildInvoiceDocument(input: DocInput): jsPDF {
  const { service, customer, parts, settings } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  const invNumber = docTitle('invoice', service, settings)
  doc.setProperties({
    title: `TAX INVOICE ${invNumber}`,
    subject: `Invoice for ${customer.name}`,
    author: settings.name || 'TECHCITY TECHNOLOGY',
    creator: settings.name || 'TECHCITY TECHNOLOGY',
  })

  // Title outside box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('TAX INVOICE', PAGE_W / 2, 7.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('(ORIGINAL FOR RECIPIENT)', M + CONTENT_W, 7.5, { align: 'right' })

  const topY = 9.5
  const outerH = 277
  const bottomY = topY + outerH

  // Outer border box
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.28)
  doc.rect(M, topY, CONTENT_W, outerH, 'S')

  const splitX = M + 98 // Vertical divider

  // 1. Top Section: Company Left & Metadata Right (7 sub-rows)
  const headerH = 46
  doc.line(M, topY + headerH, M + CONTENT_W, topY + headerH)
  doc.line(splitX, topY, splitX, topY + headerH)

  // Company logo
  const logo = resolveLogo(settings)
  const logoW = 22
  const logoH = 19
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, M + 2.5, topY + 3.5, logoW, logoH, undefined, 'FAST')
    } catch {
      // ignore
    }
  }

  // Company Info Left
  const cTextX = M + logoW + 5
  let cy = topY + 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND_ORANGE)
  doc.text(clean(settings.name || 'TECHCITY TECHNOLOGY'), cTextX, cy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(50, 50, 50)
  cy += 4.2
  const cAddrs = [
    clean(settings.address || '#180 E, S.N.G. NAGAR'),
    'AMMAPALAYAM',
    'TIRUPUR',
    `Phone: ${clean(settings.phone || '99423 52999')}`,
  ]
  for (const a of cAddrs) {
    doc.text(a, cTextX, cy)
    cy += 3.2
  }
  doc.setFont('helvetica', 'bold')
  doc.text(`GSTIN: ${clean(settings.gstNumber || '33ATNPN0599F1ZF')}`, cTextX, cy)
  cy += 3.2
  doc.setFont('helvetica', 'normal')
  doc.text('State Name : Tamil Nadu, Code : 33', cTextX, cy)
  cy += 3.2
  doc.text(`E-Mail : ${clean(settings.email || 'techcitytup@gmail.com')}`, cTextX, cy)

  // Right Metadata Grid (7 rows, split vertically)
  const rRowH = headerH / 7
  const rMidX = splitX + 46

  for (let r = 1; r < 7; r++) {
    doc.line(splitX, topY + r * rRowH, M + CONTENT_W, topY + r * rRowH)
  }
  doc.line(rMidX, topY, rMidX, topY + 6 * rRowH)

  function metaCell(row: number, label1: string, val1: string, label2: string, val2: string) {
    const ry = topY + row * rRowH
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(70, 70, 70)
    doc.text(label1, splitX + 2, ry + 2.6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.setTextColor(...INK)
    doc.text(clean(val1), splitX + 2, ry + 5.8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(70, 70, 70)
    doc.text(label2, rMidX + 2, ry + 2.6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.setTextColor(...INK)
    doc.text(clean(val2), rMidX + 2, ry + 5.8)
  }

  metaCell(0, 'Invoice No.', invNumber, 'Dated', formatDateShort(service.serviceDate))
  metaCell(1, 'Delivery Note', '', 'Mode/Terms of Payment', service.paymentMethod || 'Cash')
  metaCell(2, 'Reference No. & Date.', service.code, 'Other References', '')
  metaCell(3, "Buyer's Order No.", '', 'Dated', '')
  metaCell(4, 'Dispatch Doc No.', '', 'Delivery Note Date', '')
  metaCell(5, 'Dispatched through', service.serviceMode || 'Direct', 'Destination', clean(customer.city || 'Tirupur'))

  // 7th row full width of right column
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text('Terms of Delivery', splitX + 2, topY + 6 * rRowH + 2.6)
  doc.setFont('helvetica', 'bold')
  doc.text('Delivered in Good Condition', splitX + 2, topY + 6 * rRowH + 5.8)

  // 2. Consignee (Ship to) & Buyer (Bill to) section
  const buyerH = 34
  const buyerY = topY + headerH
  doc.line(M, buyerY + buyerH, M + CONTENT_W, buyerY + buyerH)
  doc.line(splitX, buyerY, splitX, buyerY + buyerH)

  function drawPartyBlock(x: number, title: string) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(70, 70, 70)
    doc.text(title, x + 2, buyerY + 4)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(clean(customer.name), x + 2, buyerY + 8.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    const addr = [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')
    const lines = doc.splitTextToSize(clean(addr), splitX - M - 4) as string[]
    let py = buyerY + 12.5
    for (const l of lines.slice(0, 3)) {
      doc.text(l, x + 2, py)
      py += 3.2
    }
    doc.text(`GSTIN/UIN : ${clean(customer.gstNumber || '33AAIFJ1916C1ZV')}`, x + 2, buyerY + 28)
    doc.text('State Name : Tamil Nadu, Code : 33', x + 2, buyerY + 31.8)
  }

  drawPartyBlock(M, 'Consignee (Ship to)')
  drawPartyBlock(splitX, 'Buyer (Bill to)')

  // 3. Items Table
  const tableStartY = buyerY + buyerH
  const taxPct = service.taxPercent || 18
  const halfTaxPct = taxPct / 2

  const itemsBody: (string | number)[][] = []
  let totalQuantity = 0

  if (service.product) {
    const brandModel = [service.brand, service.model].filter(Boolean).join(' ')
    const itemDesc = `${service.product}${brandModel ? ` (${brandModel})` : ''}`
    itemsBody.push([
      '1',
      clean(itemDesc),
      '84713010',
      '1 NOS',
      formatAmount(service.serviceCharge || service.totalAmount),
      'NOS',
      '',
      formatAmount(service.serviceCharge || service.totalAmount),
    ])
    totalQuantity += 1
  }

  parts.forEach((p) => {
    totalQuantity += p.quantity
    itemsBody.push([
      String(itemsBody.length + 1),
      clean(p.name),
      '85235100',
      `${p.quantity} NOS`,
      formatAmount(p.unitPrice),
      'NOS',
      '',
      formatAmount(p.total),
    ])
  })

  if (!itemsBody.length) {
    totalQuantity += 1
    itemsBody.push([
      '1',
      clean(service.serviceType),
      '998719',
      '1 NOS',
      formatAmount(service.serviceCharge || service.totalAmount),
      'NOS',
      '',
      formatAmount(service.serviceCharge || service.totalAmount),
    ])
  }

  const taxableValue = service.serviceCharge + service.partsCost + (service.deliveryCharge ?? 0) - service.discount
  const cgst = Math.round(taxableValue * (halfTaxPct / 100) * 100) / 100
  const sgst = Math.round(taxableValue * (halfTaxPct / 100) * 100) / 100
  const totalTax = cgst + sgst

  itemsBody.push(['', '', '', '', '', '', '', formatAmount(taxableValue)])
  itemsBody.push(['', `OUTPUT @ CENTRAL TAX @ ${halfTaxPct}%`, '', '', '', '', `${halfTaxPct} %`, formatAmount(cgst)])
  itemsBody.push(['', `OUTPUT @ STATE TAX @ ${halfTaxPct}%`, '', '', '', '', `${halfTaxPct} %`, formatAmount(sgst)])

  autoTable(doc, {
    startY: tableStartY,
    head: [['Sl\nNo.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Disc. %', 'Amount']],
    body: itemsBody,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      cellPadding: 1.6,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 7.6,
      halign: 'center',
      valign: 'middle',
      lineColor: LINE,
      lineWidth: 0.22,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 26, halign: 'right' },
    },
  })

  // Total Row
  const totalRowY = bottomY - 62
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.line(M, totalRowY, M + CONTENT_W, totalRowY)
  doc.line(M, totalRowY + 6, M + CONTENT_W, totalRowY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Total', splitX - 25, totalRowY + 4.2)
  doc.text(`${totalQuantity} NOS`, splitX + 5, totalRowY + 4.2)
  doc.text(`Rs. ${formatAmount(service.totalAmount)}`, M + CONTENT_W - 3, totalRowY + 4.2, { align: 'right' })

  // Amount Chargeable in words
  const wordsY = totalRowY + 10.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.text('Amount Chargeable (in words)', M + 2, wordsY - 2.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`INR ${numberToWordsIndian(service.totalAmount)} Only`, M + 2, wordsY + 1.5)
  doc.text('E. & O.E', M + CONTENT_W - 3, wordsY - 1, { align: 'right' })

  // 4. HSN/SAC Tax Summary Table
  const hsnY = wordsY + 5
  autoTable(doc, {
    startY: hsnY,
    head: [
      ['HSN/SAC', 'Taxable\nValue', 'CGST\nRate  Amount', 'SGST/UTGST\nRate  Amount', 'Total\nTax Amount'],
    ],
    body: [
      ['84713010', formatAmount(taxableValue), `${halfTaxPct}%  ${formatAmount(cgst)}`, `${halfTaxPct}%  ${formatAmount(sgst)}`, formatAmount(totalTax)],
      ['Total', formatAmount(taxableValue), formatAmount(cgst), formatAmount(sgst), formatAmount(totalTax)],
    ],
    theme: 'plain',
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1.4,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      lineColor: LINE,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 32, halign: 'right' },
      2: { cellWidth: 44, halign: 'right' },
      3: { cellWidth: 44, halign: 'right' },
      4: { cellWidth: 44, halign: 'right' },
    },
  })

  // @ts-expect-error - runtime property
  const hsnEndY = doc.lastAutoTable?.finalY ?? (hsnY + 14)
  doc.line(M, hsnEndY, M + CONTENT_W, hsnEndY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.text(
    `Tax Amount (in words) : INR ${numberToWordsIndian(totalTax)} Only (Tax / GST (${taxPct}%))`,
    M + 2,
    hsnEndY + 3.8,
  )

  // 5. Declaration, Bank Details & Signature bottom box
  const declY = hsnEndY + 6
  doc.line(M, declY, M + CONTENT_W, declY)
  const bankX = M + 80
  const authX = M + 135
  doc.line(bankX, declY, bankX, bottomY)
  doc.line(authX, declY, authX, bottomY)

  // Declaration left
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Declaration', M + 2, declY + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  const declLines = [
    'We declare that this invoice shows the actual price of the goods',
    'described and that all particulars are true and correct. NOTE :-',
    'WARRANTY MUST BE CLAIMED FROM MANUFACTURERS ONLY.',
  ]
  if (settings.terms) {
    const customTerms = doc.splitTextToSize(clean(settings.terms), bankX - M - 4) as string[]
    declLines.push(...customTerms.slice(0, 4))
  }

  // The declaration box has a fixed height, so a shop with its own Terms &
  // Conditions used to have them silently clipped off the bottom of the
  // invoice. Tighten the leading (and the type, within legible limits) until
  // everything the owner configured actually fits inside the box.
  const declTop = declY + 6.8
  const declBottom = bottomY - 5
  const declAvail = declBottom - declTop
  let declStep = 2.8
  if (declLines.length * declStep > declAvail && declLines.length > 0) {
    declStep = Math.max(2.1, declAvail / declLines.length)
    doc.setFontSize(Math.max(4.8, Math.min(5.8, declStep * 2.07)))
  }
  let dy = declTop
  for (const dl of declLines) {
    if (dy > declBottom) break
    doc.text(dl, M + 2, dy)
    dy += declStep
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text("Customer's Seal and Signature", M + 2, bottomY - 2.5)

  // Bank details middle
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.text("Company's Bank Details", bankX + 2, declY + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text('Bank Name : INDIAN OVERSEAS BANK', bankX + 2, declY + 7.5)
  doc.text('A/c No. : 340502000005999', bankX + 2, declY + 11)
  doc.text('Branch & IFS Code : T.M.POONDI & IOBA0003405', bankX + 2, declY + 14.5)

  // Right Signatory & Payment Stamp
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(`for ${clean(settings.name || 'TECHCITY TECHNOLOGY')}`, M + CONTENT_W - 3, declY + 4, { align: 'right' })

  // Status Stamp
  const paidStatus = (service.paymentStatus || 'Paid').toUpperCase()
  const stampColor: [number, number, number] = paidStatus === 'PAID' ? [16, 133, 90] : [190, 45, 45]
  doc.setDrawColor(...stampColor)
  doc.setLineWidth(0.4)
  doc.rect(authX + 4, declY + 8, 26, 6.5, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...stampColor)
  doc.text(paidStatus, authX + 17, declY + 12.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(...INK)
  doc.text('Authorised Signatory', M + CONTENT_W - 3, bottomY - 3, { align: 'right' })

  // Subfooters outside box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  doc.text('SUBJECT TO TIRUPUR JURISDICTION', PAGE_W / 2, bottomY + 3.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text(
    `This is a Computer Generated Invoice  |  ${clean(
      settings.footerText || 'Thank you for choosing TECH CITY TECHNOLOGY',
    )}`,
    PAGE_W / 2,
    bottomY + 6.8,
    { align: 'center' },
  )

  return doc
}

/* ------------------------------------------------------------------ */
/* Main builder + output helpers                                       */
/* ------------------------------------------------------------------ */

export function buildDocument(input: DocInput): jsPDF {
  if (input.kind === 'report') return buildChallanDocument(input)
  return buildInvoiceDocument(input)
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
