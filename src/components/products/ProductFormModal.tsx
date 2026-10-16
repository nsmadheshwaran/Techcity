import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ComboField, NumberField, TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { createProduct, updateProduct } from '@/services/products'
import type { Product } from '@/types'

const CATEGORIES = [
  'Laptop',
  'Desktop',
  'Monitor',
  'Printer',
  'CCTV Camera',
  'DVR',
  'NVR',
  'Router',
  'Networking Cable',
  'Hard Disk',
  'RAM',
  'Accessories',
  'Other',
]

const UNITS = ['pcs', 'box', 'roll', 'mtr', 'set']

interface Props {
  open: boolean
  onClose: () => void
  product?: Product
  onSaved?: (p: Product) => void
}

export function ProductFormModal({ open, onClose, product, onSaved }: Props) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    category: '',
    brand: '',
    quantity: 0,
    unit: 'pcs',
    costPrice: 0,
    sellPrice: 0,
    lowStockThreshold: 0,
    location: '',
    notes: '',
  })

  useEffect(() => {
    if (!open) return
    setError('')
    if (product) {
      setForm({
        name: product.name,
        category: product.category ?? '',
        brand: product.brand ?? '',
        quantity: product.quantity ?? 0,
        unit: product.unit ?? 'pcs',
        costPrice: product.costPrice ?? 0,
        sellPrice: product.sellPrice ?? 0,
        lowStockThreshold: product.lowStockThreshold ?? 0,
        location: product.location ?? '',
        notes: product.notes ?? '',
      })
    } else {
      setForm({
        name: '',
        category: '',
        brand: '',
        quantity: 0,
        unit: 'pcs',
        costPrice: 0,
        sellPrice: 0,
        lowStockThreshold: 0,
        location: '',
        notes: '',
      })
    }
  }, [open, product])

  async function save() {
    if (!form.name.trim()) {
      setError('Product name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        brand: form.brand.trim() || undefined,
        quantity: Math.max(0, Math.round(form.quantity)),
        unit: form.unit.trim() || undefined,
        costPrice: form.costPrice || undefined,
        sellPrice: form.sellPrice || undefined,
        lowStockThreshold: form.lowStockThreshold || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      const saved = product
        ? await updateProduct(product.id, payload)
        : await createProduct(payload)
      toast.success(product ? 'Product updated' : 'Product added', saved.code)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the product.'
      setError(message)
      toast.error('Save failed', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.code}` : 'Add Product'}
      description="What is physically on the shelf in the shop."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Product'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Product Name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Dell 1TB HDD"
          className="sm:col-span-2"
        />
        <ComboField
          label="Category"
          listId="product-categories"
          options={CATEGORIES}
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="Hard Disk"
        />
        <TextField
          label="Brand"
          value={form.brand}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          placeholder="Seagate"
        />
        <NumberField
          label="Quantity in Stock"
          required
          currency={null}
          step="1"
          value={form.quantity}
          onValueChange={(v) => setForm((f) => ({ ...f, quantity: v }))}
        />
        <ComboField
          label="Unit"
          listId="product-units"
          options={UNITS}
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          placeholder="pcs"
        />
        <NumberField
          label="Cost Price (per unit)"
          hint="What the shop paid — never shown on customer documents."
          value={form.costPrice}
          onValueChange={(v) => setForm((f) => ({ ...f, costPrice: v }))}
        />
        <NumberField
          label="Sell Price (per unit)"
          value={form.sellPrice}
          onValueChange={(v) => setForm((f) => ({ ...f, sellPrice: v }))}
        />
        <NumberField
          label="Low Stock Alert"
          currency={null}
          step="1"
          hint="Flag this item when quantity falls to or below this number."
          value={form.lowStockThreshold}
          onValueChange={(v) => setForm((f) => ({ ...f, lowStockThreshold: v }))}
        />
        <TextField
          label="Shelf / Location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          placeholder="Rack 2, Bin A"
        />
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}
