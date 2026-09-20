export interface FilterState {
  query: string
  status: string
  paymentStatus: string
  serviceType: string
  from: string
  to: string
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  status: '',
  paymentStatus: '',
  serviceType: '',
  from: '',
  to: '',
}

export const PENDING_STATUSES = ['Received', 'Diagnosis', 'In Progress', 'Waiting for Parts', 'Ready']

export function applyFilters<
  T extends {
    code: string
    serviceType: string
    status: string
    paymentStatus: string
    serviceDate: string
    complaint: string
    customerId: string
    product?: string
    brand?: string
    model?: string
    serialNumber?: string
  },
>(
  rows: T[],
  filters: FilterState,
  customerLookup: (id: string) => { name: string; phone: string; code: string } | undefined,
): T[] {
  const q = filters.query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  return rows.filter((s) => {
    if (filters.status === '__pending') {
      if (!PENDING_STATUSES.includes(s.status)) return false
    } else if (filters.status && s.status !== filters.status) return false
    if (filters.paymentStatus && s.paymentStatus !== filters.paymentStatus) return false
    if (filters.serviceType && s.serviceType !== filters.serviceType) return false
    if (filters.from && s.serviceDate < filters.from) return false
    if (filters.to && s.serviceDate > filters.to) return false
    if (!q) return true

    const c = customerLookup(s.customerId)
    const haystack = [
      s.code,
      s.serviceType,
      s.complaint,
      s.product,
      s.brand,
      s.model,
      s.serialNumber,
      c?.name,
      c?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (haystack.includes(q)) return true
    if (digits.length >= 3 && c?.phone.replace(/\D/g, '').includes(digits)) return true
    return false
  })
}
