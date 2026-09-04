import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Eye, FileText, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useQuotationsWithCustomer, useSettings } from '@/hooks/useData'
import { deleteQuotation } from '@/services/quotations'
import { QUOTATION_STATUSES, type QuotationStatus, type QuotationWithCustomer } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

const STATUS_STYLES: Record<QuotationStatus, string> = {
  Draft: 'border-ink-200 bg-ink-100 text-ink-600',
  Sent: 'border-brand-100 bg-brand-50 text-brand-700',
  Accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Expired: 'border-red-200 bg-red-50 text-red-600',
}

export default function QuotationsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const quotations = useQuotationsWithCustomer()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | QuotationStatus>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (quotations ?? []).filter((qu) => {
      if (status !== 'all' && qu.status !== status) return false
      if (!q) return true
      return (
        qu.code.toLowerCase().includes(q) ||
        (qu.customer?.name ?? '').toLowerCase().includes(q) ||
        (qu.customer?.phone ?? '').toLowerCase().includes(q) ||
        qu.items.some((i) => i.name.toLowerCase().includes(q))
      )
    })
  }, [quotations, query, status])

  async function openPdf(qu: QuotationWithCustomer | undefined) {
    if (!qu || !qu.customer) {
      toast.warning('Customer missing', 'This quotation has no linked customer to print against.')
      return
    }
    setBusy(qu.id)
    try {
      const { quotationObjectUrl } = await import('@/pdf/documents')
      const url = quotationObjectUrl({ quotation: qu, customer: qu.customer, settings })
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        toast.warning('Pop-up blocked', 'Allow pop-ups for this site, or use Download PDF instead.')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error('Could not open PDF', err instanceof Error ? err.message : 'PDF generation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function downloadPdf(qu: QuotationWithCustomer | undefined) {
    if (!qu || !qu.customer) {
      toast.warning('Customer missing', 'This quotation has no linked customer to print against.')
      return
    }
    setBusy(qu.id)
    try {
      const { downloadQuotation } = await import('@/pdf/documents')
      downloadQuotation({ quotation: qu, customer: qu.customer, settings })
      toast.success('PDF downloaded', `${qu.code} saved to your device.`)
    } catch (err) {
      toast.error('Could not download PDF', err instanceof Error ? err.message : 'PDF generation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function onDelete(id: string, code: string) {
    const ok = await confirm({
      title: 'Delete this quotation?',
      message: `${code} will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteQuotation(id)
      toast.success('Quotation deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  return (
    <>
      <PageHeader
        back="/"
        title="Quotations"
        subtitle="Generate a quotation any time from a customer’s saved details"
        actions={
          <Link className="btn-primary" to="/quotations/new">
            <Plus size={16} /> New Quotation
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search by quotation no., customer, item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | QuotationStatus)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        <div className="card">
          <EmptyState
            icon={ScrollText}
            title={query || status !== 'all' ? 'No quotations match' : 'No quotations yet'}
            message={
              query || status !== 'all'
                ? 'Try a different search or clear the filters.'
                : 'Open a customer and press “Quotation”, or create one from a lead — you can send it as a PDF.'
            }
            action={
              !query && status === 'all' ? (
                <Link className="btn-primary" to="/quotations/new">
                  <Plus size={16} /> Create your first quotation
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((qu) => (
            <li key={qu.id} className="card flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FileText size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[15px] font-semibold text-ink-900">{qu.code}</p>
                  <span className={`badge ${STATUS_STYLES[qu.status]}`}>{qu.status}</span>
                  {qu.validUntil && (
                    <span className="text-[12px] text-ink-400">valid till {formatDate(qu.validUntil)}</span>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-500">
                  <span>{formatDate(qu.date)}</span>
                  {qu.customer ? (
                    <Link to={`/customers/${qu.customer.id}`} className="text-brand-700 hover:underline">
                      {qu.customer.name}
                    </Link>
                  ) : (
                    <span className="text-ink-400">Customer deleted</span>
                  )}
                  <span className="hidden sm:inline">
                    {qu.items.length} item{qu.items.length === 1 ? '' : 's'}
                  </span>
                </p>
                {qu.notes && (
                  <p className="mt-1.5 line-clamp-1 text-[12.5px] text-ink-600">{qu.notes}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] font-bold text-ink-900">
                  {formatMoney(qu.totalAmount, settings.currency)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="btn-ghost px-2 py-1.5"
                  onClick={() => openPdf(qu)}
                  disabled={busy === qu.id}
                  aria-label="View PDF"
                  title="View PDF"
                >
                  <Eye size={15} />
                </button>
                <button
                  className="btn-ghost px-2 py-1.5"
                  onClick={() => downloadPdf(qu)}
                  disabled={busy === qu.id}
                  aria-label="Download PDF"
                  title="Download PDF"
                >
                  <Download size={15} />
                </button>
                <Link
                  className="btn-ghost px-2 py-1.5"
                  to={`/quotations/${qu.id}/edit`}
                  aria-label="Edit quotation"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  className="btn-ghost px-2 py-1.5 text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(qu.id, qu.code)}
                  aria-label="Delete quotation"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
