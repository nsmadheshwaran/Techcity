import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Service } from '@/types'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, parseDate } from '@/utils/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Visual service timeline grouped by year:
 *
 *  2026
 *   ├── Aug 11  CCTV Maintenance  ₹1,500
 *   └── Jan 10  CCTV Installation ₹18,000
 */
export function ServiceTimeline({ services, currency = '₹' }: { services: Service[]; currency?: string }) {
  const sorted = [...services].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  const years = new Map<number, Service[]>()
  for (const s of sorted) {
    const y = parseDate(s.serviceDate)?.getFullYear() ?? 0
    const list = years.get(y)
    if (list) list.push(s)
    else years.set(y, [s])
  }

  return (
    <div className="px-4 py-4">
      {[...years.entries()].map(([year, items]) => (
        <div key={year} className="mb-2 last:mb-0">
          <p className="mb-1 text-[13px] font-bold tracking-tight text-ink-900">{year}</p>
          <ol className="relative ml-1.5 border-l-2 border-ink-200 pl-4">
            {items.map((s) => {
              const d = parseDate(s.serviceDate)
              return (
                <li key={s.id} className="relative pb-4 last:pb-1">
                  <span className="absolute -left-[22px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                  <Link
                    to={`/services/${s.id}`}
                    className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-50"
                  >
                    <span className="w-14 shrink-0 pt-0.5 text-[12.5px] font-medium text-ink-500">
                      {d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink-900">
                          {s.serviceType}
                        </span>
                        <StatusBadge status={s.status} />
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-500">
                        <span className="font-semibold text-ink-800">
                          {formatMoney(s.totalAmount, currency)}
                        </span>
                        {s.balance > 0 && (
                          <span className="text-red-600">
                            {formatMoney(s.balance, currency)} due
                          </span>
                        )}
                        <span>· {s.code}</span>
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="mt-1 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                    />
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
