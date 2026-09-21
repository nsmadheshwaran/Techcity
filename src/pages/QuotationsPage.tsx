import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { ListToolbar, SearchInput, ViewTabs } from '@/components/ui/ListToolbar'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useQuotationsWithCustomer, useSettings } from '@/hooks/useData'
import { deleteQuotation } from '@/services/quotations'
import { QUOTATION_STATUSES, type QuotationStatus, type QuotationWithCustomer } from '@/types'
import { formatDate, formatMoney, toWhatsAppNumber } from '@/utils/format'

const STATUS_CONFIG: Record<QuotationStatus, { pill: string; dot: string }> = {
  Draft: { pill: 'border-ink-200/80 bg-ink-100/70 text-ink-700', dot: 'bg-ink-400' },
  Sent: { pill: 'border-blue-200/80 bg-blue-50 text-blue-700', dot: 'bg-blue-500 animate-pulse' },
  Accepted: { pill: 'border-emerald-200/80 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Expired: { pill: 'border-rose-200/80 bg-rose-50 text-rose-700', dot: 'bg-rose-400' },
}

export default function QuotationsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const quotations = useQuotationsWithCustomer()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | QuotationStatus>('all')
  const [busy, setBusy] = useState<string | null>(null)

  // Metrics
  const stats = useMemo(() => {
    const list = quotations ?? []
    const totalCount = list.length
    const totalValue = list.reduce((sum, q) => sum + q.totalAmount, 0)
    const accepted = list.filter((q) => q.status === 'Accepted')
    const acceptedValue = accepted.reduce((sum, q) => sum + q.totalAmount, 0)
    const pendingSent = list.filter((q) => q.status === 'Sent' || q.status === 'Draft')
    const pendingValue = pendingSent.reduce((sum, q) => sum + q.totalAmount, 0)

    return {
      totalCount,
      totalValue,
      acceptedCount: accepted.length,
      acceptedValue,
      pendingCount: pendingSent.length,
      pendingValue,
    }
  }, [quotations])

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

  function shareOnWhatsApp(qu: QuotationWithCustomer) {
    if (!qu.customer?.phone) {
      toast.warning('No phone number', 'This customer does not have a phone number saved.')
      return
    }
    const cleanPhone = toWhatsAppNumber(qu.customer.phone)
    const itemsList = qu.items.map((it) => `• ${it.name} (${it.quantity}x)`).join('\n')
    const message = `Hello ${qu.customer.name},\n\nHere is your quotation ${qu.code} from Tech City:\nTotal: ${formatMoney(qu.totalAmount, settings.currency)}\n\nItems:\n${itemsList}\n\nPlease let us know if you would like us to proceed with the service!\nThank you!`
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
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
        subtitle="Manage estimates, share quotes via WhatsApp or PDF, and convert to active jobs with 1 click"
        actions={
          <Link className="btn-primary" to="/quotations/new">
            <Plus size={14} /> New Quotation
          </Link>
        }
      />

      {/* Pipeline KPIs — same tile component the dashboard uses */}
      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Pipeline"
          value={formatMoney(stats.totalValue, settings.currency)}
          icon={FileText}
          tone="brand"
          hint={`${stats.totalCount} quotation${stats.totalCount === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Accepted / Won"
          value={formatMoney(stats.acceptedValue, settings.currency)}
          icon={CheckCircle2}
          tone="success"
          hint={`${stats.acceptedCount} converted`}
        />
        <StatCard
          label="Pending / In Review"
          value={formatMoney(stats.pendingValue, settings.currency)}
          icon={Clock}
          tone="warning"
          hint={`${stats.pendingCount} awaiting response`}
        />
      </div>

      <div className="panel">
        <ListToolbar>
          <ViewTabs
            value={status}
            onChange={setStatus}
            options={[
              { key: 'all' as const, label: 'All', count: stats.totalCount },
              ...QUOTATION_STATUSES.map((sVal) => ({
                key: sVal,
                label: sVal,
                count: (quotations ?? []).filter((q) => q.status === sVal).length,
              })),
            ]}
          />
          <SearchInput
            className="w-full sm:w-72"
            value={query}
            onChange={setQuery}
            placeholder="Search quotation no., customer, phone, item…"
            ariaLabel="Search quotations"
          />
        </ListToolbar>

        {!filtered.length ? (
          <EmptyState
            icon={ScrollText}
            title={query || status !== 'all' ? 'No quotations match' : 'No quotations yet'}
            message={
              query || status !== 'all'
                ? 'Try a different search or clear the filters.'
                : 'Create quotations for customer inquiries. Once accepted, convert them into active service jobs with 1 click.'
            }
            action={
              !query && status === 'all' ? (
                <Link className="btn-primary" to="/quotations/new">
                  <Plus size={14} /> Create your first quotation
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
          {filtered.map((qu) => {
            const conf = STATUS_CONFIG[qu.status] ?? STATUS_CONFIG.Draft
            return (
              <li
                key={qu.id}
                className="flex flex-col gap-3 px-3.5 py-3 transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <FileText size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Link
                        to={`/quotations/${qu.id}/edit`}
                        className="text-[15px] font-bold text-ink-900 hover:text-brand-600 transition-colors"
                      >
                        {qu.code}
                      </Link>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${conf.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                        {qu.status}
                      </span>
                      {qu.validUntil && (
                        <span className="text-[11.5px] font-medium text-ink-400">
                          Valid until {formatDate(qu.validUntil)}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-600">
                      {qu.customer ? (
                        <Link
                          to={`/customers/${qu.customer.id}`}
                          className="font-semibold text-ink-900 hover:text-brand-600 hover:underline"
                        >
                          {qu.customer.name}
                        </Link>
                      ) : (
                        <span className="text-ink-400">Customer deleted</span>
                      )}
                      {qu.customer?.phone && (
                        <span className="text-ink-400">· {qu.customer.phone}</span>
                      )}
                      <span className="text-ink-400">· Created {formatDate(qu.date)}</span>
                    </p>

                    {/* Items pill preview */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {qu.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center rounded-md bg-ink-100/70 px-2 py-0.5 text-[11px] font-medium text-ink-700"
                        >
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                      {qu.items.length > 3 && (
                        <span className="text-[11px] font-medium text-ink-400">
                          +{qu.items.length - 3} more
                        </span>
                      )}
                    </div>

                    {qu.notes && (
                      <p className="mt-1.5 line-clamp-1 text-[12px] italic text-ink-500">{qu.notes}</p>
                    )}
                  </div>
                </div>

                {/* Amount and CRM Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center">
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] uppercase font-bold tracking-wider text-ink-400">Total Amount</p>
                    <p className="text-lg font-bold text-ink-900 leading-tight">
                      {formatMoney(qu.totalAmount, settings.currency)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 1-Click Convert to Service Job */}
                    <Link
                      to={`/services/new?quotationId=${qu.id}&customerId=${qu.customerId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-all hover:border-brand-400 hover:bg-brand-100/70"
                      title="Convert this quotation into an active Service Job"
                    >
                      <Briefcase size={13} className="text-brand-600" />
                      <span>Convert to Job</span>
                    </Link>

                    {/* WhatsApp Quick Share */}
                    <button
                      onClick={() => shareOnWhatsApp(qu)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100/70"
                      title="Share Quote on WhatsApp"
                      aria-label="Share Quote on WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>

                    {/* View PDF */}
                    <button
                      className="btn-ghost p-1.5 text-ink-600"
                      onClick={() => openPdf(qu)}
                      disabled={busy === qu.id}
                      aria-label="View PDF"
                      title="View PDF"
                    >
                      <Eye size={15} />
                    </button>

                    {/* Download PDF */}
                    <button
                      className="btn-ghost p-1.5 text-ink-600"
                      onClick={() => downloadPdf(qu)}
                      disabled={busy === qu.id}
                      aria-label="Download PDF"
                      title="Download PDF"
                    >
                      <Download size={15} />
                    </button>

                    {/* Edit */}
                    <Link
                      className="btn-ghost p-1.5 text-ink-600"
                      to={`/quotations/${qu.id}/edit`}
                      aria-label="Edit quotation"
                      title="Edit quotation"
                    >
                      <Pencil size={15} />
                    </Link>

                    {/* Delete */}
                    <button
                      className="btn-ghost p-1.5 text-rose-600 hover:bg-rose-50"
                      onClick={() => onDelete(qu.id, qu.code)}
                      aria-label="Delete quotation"
                      title="Delete quotation"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
          </ul>
        )}
      </div>
    </>
  )
}
