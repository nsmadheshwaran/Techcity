import { useState } from 'react'
import { Download, FileText, MessageCircle, Printer, Share2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { canShareFiles, openWhatsApp, whatsappMessage } from '@/pdf/share'
import { db, sortParts } from '@/lib/db'
import type { DocInput } from '@/pdf/documents'

import type { BusinessSettings, Customer, DocKind, Service } from '@/types'

interface Props {
  service: Service
  customer: Customer
  settings: BusinessSettings
  kind?: DocKind
  compact?: boolean
}

/** Build the full PDF input by loading parts + payments for the service. */
async function buildInput(
  service: Service,
  customer: Customer,
  settings: BusinessSettings,
  kind: DocKind,
): Promise<DocInput> {
  const [parts, payments] = await Promise.all([
    db.serviceParts.where('serviceId').equals(service.id).toArray(),
    db.payments.where('serviceId').equals(service.id).toArray(),
  ])
  return {
    kind,
    service,
    customer,
    parts: sortParts(parts),
    payments: payments.sort((a, b) => a.date.localeCompare(b.date)),
    settings,
  }
}

export function DocumentActions({ service, customer, settings, kind = 'report', compact }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function run(action: 'download' | 'print' | 'view' | 'share' | 'whatsapp') {
    setBusy(action)
    try {
      if (action === 'whatsapp') {
        openWhatsApp(customer, service, settings)
        toast.info(
          'WhatsApp opened',
          'The message is pre-filled. Attach the downloaded PDF to send the report.',
        )
        return
      }

      // The PDF engine (~700 KB) is loaded on demand so the app starts fast.
      const { downloadDocument, printDocument, documentObjectUrl, sharePDFDocument } =
        await import('@/pdf/documents')
      const input = await buildInput(service, customer, settings, kind)

      if (action === 'download') {
        downloadDocument(input)
        toast.success('PDF downloaded', `${service.code} saved to your device.`)
      } else if (action === 'print') {
        await printDocument(input)
      } else if (action === 'view') {
        const url = documentObjectUrl(input)
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (!win) {
          toast.warning(
            'Pop-up blocked',
            'Allow pop-ups for this site, or use Download PDF instead.',
          )
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else if (action === 'share') {
        const result = await sharePDFDocument(input, whatsappMessage(customer, service, settings))
        if (result === 'unsupported') {
          downloadDocument(input)
          toast.info(
            'Sharing not supported here',
            'The PDF was downloaded instead — attach it in WhatsApp or email.',
          )
        } else if (result === 'shared') {
          toast.success('Report shared')
        }
      }
    } catch (err) {
      toast.error(
        'Could not generate the document',
        err instanceof Error ? err.message : 'PDF generation failed. Please try again.',
      )
    } finally {
      setBusy(null)
    }
  }

  const size = compact ? 15 : 16
  const cls = compact ? 'btn-secondary py-1.5 px-2.5 text-[12.5px]' : 'btn-secondary'

  return (
    <>
      <button className={cls} onClick={() => run('view')} disabled={busy !== null}>
        <FileText size={size} /> <span className={compact ? 'hidden sm:inline' : ''}>View</span>
      </button>
      <button className={cls} onClick={() => run('download')} disabled={busy !== null}>
        <Download size={size} />{' '}
        <span className={compact ? 'hidden sm:inline' : ''}>
          {busy === 'download' ? 'Preparing…' : 'Download PDF'}
        </span>
      </button>
      <button className={cls} onClick={() => run('print')} disabled={busy !== null}>
        <Printer size={size} /> <span className={compact ? 'hidden sm:inline' : ''}>Print</span>
      </button>
      <button className={cls} onClick={() => run('share')} disabled={busy !== null}>
        <Share2 size={size} />{' '}
        <span className={compact ? 'hidden sm:inline' : ''}>
          {canShareFiles() ? 'Share' : 'Share (download)'}
        </span>
      </button>
      <button
        className={`${cls} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
        onClick={() => run('whatsapp')}
        disabled={busy !== null}
      >
        <MessageCircle size={size} />{' '}
        <span className={compact ? 'hidden sm:inline' : ''}>WhatsApp</span>
      </button>
    </>
  )
}
