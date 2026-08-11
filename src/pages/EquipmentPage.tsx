import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, HardDrive, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EquipmentFormModal } from '@/components/equipment/EquipmentFormModal'
import { EquipmentBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useEquipment } from '@/hooks/useData'
import { deleteEquipment } from '@/services/equipment'
import { exportEquipmentCSV } from '@/services/backup'
import { EQUIPMENT_STATUSES, type Equipment } from '@/types'
import { daysUntil, formatDate } from '@/utils/format'

export default function EquipmentPage() {
  const equipment = useEquipment()
  const customerMap = useCustomerMap()
  const toast = useToast()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | undefined>()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (equipment ?? []).filter((e) => {
      if (status && e.status !== status) return false
      if (!q) return true
      const c = customerMap.get(e.customerId)
      return [e.code, e.productType, e.brand, e.model, e.serialNumber, e.location, c?.name, c?.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [equipment, query, status, customerMap])

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 20)

  async function onDelete(e: Equipment) {
    const ok = await confirm({
      title: 'Delete equipment record?',
      message: `${e.productType} ${e.brand ?? ''} (${e.code}) will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteEquipment(e.id)
      toast.success('Equipment deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  async function onExport() {
    try {
      const count = await exportEquipmentCSV()
      toast.success('Equipment exported', `${count} record(s) saved as CSV.`)
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export.')
    }
  }

  return (
    <>
      <PageHeader
        title="Products / Equipment"
        subtitle="Devices installed or supplied to customers, with warranty tracking."
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!equipment?.length}>
              <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Plus size={16} /> Add Equipment
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9 pr-9"
            placeholder="Search by customer, product, brand, model or serial number…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="input w-full py-2 sm:w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {EQUIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {!equipment ? (
          <SkeletonRows rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={HardDrive}
            title={equipment.length ? 'No equipment matches' : 'No equipment recorded'}
            message={
              equipment.length
                ? 'Try a different search term or status filter.'
                : 'Track cameras, DVRs, computers and other devices installed at customer sites.'
            }
            action={
              <button
                className="btn-primary"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus size={16} /> Add Equipment
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th className="table-th">Product</th>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Serial / Location</th>
                    <th className="table-th">Installed</th>
                    <th className="table-th">Warranty</th>
                    <th className="table-th">Status</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {slice.map((e) => {
                    const c = customerMap.get(e.customerId)
                    const left = daysUntil(e.warrantyExpiry)
                    return (
                      <tr key={e.id} className="transition-colors hover:bg-ink-50">
                        <td className="table-td">
                          <p className="font-medium text-ink-900">
                            {e.productType}
                            {e.brand ? ` · ${e.brand}` : ''}
                          </p>
                          <p className="text-[12px] text-ink-500">
                            {e.model || e.code}
                          </p>
                        </td>
                        <td className="table-td">
                          {c ? (
                            <Link
                              to={`/customers/${c.id}`}
                              className="text-brand-700 hover:underline"
                            >
                              {c.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="table-td text-ink-600">
                          {e.serialNumber || '—'}
                          {e.location && (
                            <span className="block text-[12px] text-ink-500">{e.location}</span>
                          )}
                        </td>
                        <td className="table-td whitespace-nowrap text-ink-600">
                          {e.installationDate ? formatDate(e.installationDate) : '—'}
                        </td>
                        <td className="table-td">
                          {e.warrantyExpiry ? (
                            <>
                              <span className="text-ink-800">{formatDate(e.warrantyExpiry)}</span>
                              <span
                                className={`block text-[11.5px] ${
                                  left !== null && left < 0
                                    ? 'text-red-600'
                                    : left !== null && left <= 30
                                      ? 'text-amber-700'
                                      : 'text-ink-500'
                                }`}
                              >
                                {left !== null && left < 0
                                  ? 'Expired'
                                  : left !== null
                                    ? `${left} days left`
                                    : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-400">{e.warrantyPeriod || '—'}</span>
                          )}
                        </td>
                        <td className="table-td">
                          <EquipmentBadge status={e.status} />
                        </td>
                        <td className="table-td">
                          <div className="flex justify-end gap-1">
                            <button
                              className="btn-ghost px-2"
                              onClick={() => {
                                setEditing(e)
                                setFormOpen(true)
                              }}
                              aria-label="Edit equipment"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(e)}
                              aria-label="Delete equipment"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 lg:hidden">
              {slice.map((e) => {
                const c = customerMap.get(e.customerId)
                return (
                  <li key={e.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14.5px] font-semibold text-ink-900">
                            {e.productType}
                            {e.brand ? ` · ${e.brand}` : ''}
                          </p>
                          <EquipmentBadge status={e.status} />
                        </div>
                        <p className="mt-0.5 text-[13px] text-ink-600">
                          {c ? (
                            <Link to={`/customers/${c.id}`} className="text-brand-700">
                              {c.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {[e.model, e.serialNumber && `SN: ${e.serialNumber}`, e.location]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">
                          {e.installationDate ? `Installed ${formatDate(e.installationDate)}` : ''}
                          {e.warrantyExpiry ? ` · Warranty till ${formatDate(e.warrantyExpiry)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          className="btn-ghost px-2"
                          onClick={() => {
                            setEditing(e)
                            setFormOpen(true)
                          }}
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-ghost px-2 text-red-600"
                          onClick={() => onDelete(e)}
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              label="equipment records"
            />
          </>
        )}
      </div>

      <EquipmentFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(undefined)
        }}
        equipment={editing}
      />
    </>
  )
}
