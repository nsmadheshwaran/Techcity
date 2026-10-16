import { useMemo, useState } from 'react'
import { Boxes, Download, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ProductFormModal } from '@/components/products/ProductFormModal'
import { Chip } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { ListToolbar, SearchInput } from '@/components/ui/ListToolbar'
import { Pagination } from '@/components/ui/Pagination'
import { SortableTh } from '@/components/ui/SortableTh'
import { useSort, useSorted } from '@/components/ui/useSort'
import { usePagination } from '@/components/ui/usePagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useProducts } from '@/hooks/useData'
import { adjustStock, deleteProduct, searchProducts } from '@/services/products'
import { exportProductsCSV } from '@/services/backup'
import { formatMoney } from '@/utils/format'
import type { Product } from '@/types'

type ProductSortKey = 'name' | 'category' | 'quantity' | 'sellPrice'

function isLow(p: Product) {
  return (p.lowStockThreshold ?? 0) > 0 && p.quantity <= (p.lowStockThreshold ?? 0)
}

export default function StockPage() {
  const products = useProducts()
  const toast = useToast()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()

  const filtered = useMemo(() => {
    let list = searchProducts(products ?? [], query)
    if (lowOnly) list = list.filter(isLow)
    return list
  }, [products, query, lowOnly])

  const sort = useSort<ProductSortKey>()
  const sorted = useSorted(filtered, sort.key, sort.dir, {
    name: (p) => p.name,
    category: (p) => p.category,
    quantity: (p) => p.quantity,
    sellPrice: (p) => p.sellPrice,
  })

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(sorted, 20)

  const lowCount = useMemo(() => (products ?? []).filter(isLow).length, [products])

  async function onAdjust(p: Product, delta: number) {
    try {
      await adjustStock(p.id, delta)
    } catch (err) {
      toast.error('Could not update stock', err instanceof Error ? err.message : '')
    }
  }

  async function onDelete(p: Product) {
    const ok = await confirm({
      title: 'Delete this product?',
      message: `${p.name} (${p.code}) will be permanently removed from stock.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteProduct(p.id)
      toast.success('Product deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  async function onExport(format: 'csv' | 'excel') {
    try {
      const count = await exportProductsCSV(format)
      toast.success(
        'Stock exported',
        `${count} item(s) saved as ${format === 'excel' ? 'Excel' : 'CSV'}.`,
      )
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export.')
    }
  }

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="What is physically on the shelf in the shop."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => onExport('csv')}
              disabled={!products?.length}
            >
              <Download size={16} /> <span className="sr-only sm:not-sr-only">CSV</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => onExport('excel')}
              disabled={!products?.length}
            >
              <Download size={16} /> <span className="sr-only sm:not-sr-only">Excel</span>
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Plus size={16} /> Add Product
            </button>
          </>
        }
      />

      <div className="panel">
        <ListToolbar>
          <SearchInput
            className="min-w-0 flex-1"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            placeholder="Search by name, category, brand or shelf location…"
            ariaLabel="Search stock"
          />
          <button
            className={`btn-secondary ${lowOnly ? 'border-amber-400 bg-amber-50 text-amber-800' : ''}`}
            onClick={() => {
              setLowOnly((v) => !v)
              setPage(1)
            }}
          >
            Low stock {lowCount > 0 && <Chip tone="warning">{lowCount}</Chip>}
          </button>
        </ListToolbar>

        {!products ? (
          <SkeletonRows rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={products.length ? 'No products match' : 'No stock recorded yet'}
            message={
              products.length
                ? 'Try a different search term or clear the low-stock filter.'
                : 'Add the parts and devices you keep on the shelf so you always know what is in stock.'
            }
            action={
              <button
                className="btn-primary"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus size={16} /> Add Product
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr>
                    <SortableTh
                      label="Product"
                      column="name"
                      active={sort.key}
                      dir={sort.dir}
                      onSort={sort.toggle}
                    />
                    <SortableTh
                      label="Category"
                      column="category"
                      active={sort.key}
                      dir={sort.dir}
                      onSort={sort.toggle}
                    />
                    <SortableTh
                      label="In Stock"
                      column="quantity"
                      active={sort.key}
                      dir={sort.dir}
                      onSort={sort.toggle}
                    />
                    <SortableTh
                      label="Sell Price"
                      column="sellPrice"
                      active={sort.key}
                      dir={sort.dir}
                      onSort={sort.toggle}
                    />
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {slice.map((p) => {
                    const low = isLow(p)
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-ink-50">
                        <td className="table-td">
                          <p className="font-medium text-ink-900">{p.name}</p>
                          <p className="text-[12px] text-ink-500">
                            {[p.code, p.brand, p.location].filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        <td className="table-td text-ink-600">{p.category || '—'}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="btn-ghost px-1.5 py-0.5"
                              onClick={() => onAdjust(p, -1)}
                              aria-label={`Decrease stock of ${p.name}`}
                              disabled={p.quantity <= 0}
                            >
                              <Minus size={13} />
                            </button>
                            <span
                              className={`min-w-[2.5rem] text-center font-semibold ${low ? 'text-amber-700' : 'text-ink-800'}`}
                            >
                              {p.quantity} {p.unit || ''}
                            </span>
                            <button
                              className="btn-ghost px-1.5 py-0.5"
                              onClick={() => onAdjust(p, 1)}
                              aria-label={`Increase stock of ${p.name}`}
                            >
                              <Plus size={13} />
                            </button>
                            {low && <Chip tone="warning">Low</Chip>}
                          </div>
                        </td>
                        <td className="table-td text-ink-700">
                          {p.sellPrice ? formatMoney(p.sellPrice) : '—'}
                        </td>
                        <td className="table-td">
                          <div className="flex justify-end gap-1">
                            <button
                              className="btn-ghost px-2"
                              onClick={() => {
                                setEditing(p)
                                setFormOpen(true)
                              }}
                              aria-label="Edit product"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(p)}
                              aria-label="Delete product"
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

            <ul className="divide-y divide-line-soft lg:hidden">
              {slice.map((p) => {
                const low = isLow(p)
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14.5px] font-semibold text-ink-900">{p.name}</p>
                          {low && <Chip tone="warning">Low</Chip>}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {[p.code, p.category, p.brand].filter(Boolean).join(' · ')}
                        </p>
                        {p.sellPrice ? (
                          <p className="mt-0.5 text-[12.5px] text-ink-600">
                            {formatMoney(p.sellPrice)}
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            className="btn-ghost px-1.5 py-0.5"
                            onClick={() => onAdjust(p, -1)}
                            aria-label={`Decrease stock of ${p.name}`}
                            disabled={p.quantity <= 0}
                          >
                            <Minus size={13} />
                          </button>
                          <span
                            className={`min-w-[2.5rem] text-center font-semibold ${low ? 'text-amber-700' : 'text-ink-800'}`}
                          >
                            {p.quantity} {p.unit || ''}
                          </span>
                          <button
                            className="btn-ghost px-1.5 py-0.5"
                            onClick={() => onAdjust(p, 1)}
                            aria-label={`Increase stock of ${p.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          className="btn-ghost px-2"
                          onClick={() => {
                            setEditing(p)
                            setFormOpen(true)
                          }}
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-ghost px-2 text-red-600"
                          onClick={() => onDelete(p)}
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
              label="products"
            />
          </>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(undefined)
        }}
        product={editing}
      />
    </>
  )
}
