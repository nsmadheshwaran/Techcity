import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CreditCard,
  FileText,
  HardDrive,
  LayoutDashboard,
  Lock,
  Menu,
  PhoneCall,
  Plus,
  ScrollText,
  Settings as SettingsIcon,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { GlobalSearch, GlobalSearchProvider } from '@/components/GlobalSearch'
import { useAuth } from '@/lib/auth'
import { useReminders, useServices, useSettings } from '@/hooks/useData'
import { daysUntil } from '@/utils/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services', label: 'Services', icon: Wrench },
  { to: '/reports', label: 'Service Reports', icon: FileText },
  { to: '/equipment', label: 'Products / Equipment', icon: HardDrive },
  { to: '/calls', label: 'Call Book', icon: PhoneCall },
  { to: '/quotations', label: 'Quotations', icon: ScrollText },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services/new', label: 'New', icon: Plus, primary: true },
  { to: '/services', label: 'Services', icon: Wrench },
  { to: '/more', label: 'More', icon: Menu },
]

export function AppLayout() {
  return (
    <GlobalSearchProvider>
      <AppShell />
    </GlobalSearchProvider>
  )
}

function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const settings = useSettings()
  const { enabled, lock } = useAuth()
  const reminders = useReminders()
  const services = useServices()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const pendingReminders = (reminders ?? []).filter(
    (r) => !r.done && (daysUntil(r.dueDate) ?? 99) <= 7,
  ).length
  const pendingPayments = (services ?? []).filter(
    (s) => s.balance > 0 && s.status !== 'Cancelled',
  ).length

  const badgeFor = (to: string) =>
    to === '/reminders' ? pendingReminders : to === '/payments' ? pendingPayments : 0

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-200 bg-white lg:flex no-print">
        <SidebarContent badgeFor={badgeFor} settings={settings} />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="absolute inset-0 bg-ink-950/50 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[80%] max-w-xs flex-col bg-white shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3.5 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent badgeFor={badgeFor} settings={settings} />
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur no-print">
          <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <BrandMark size={26} />
              <span className="text-[13px] font-bold tracking-tight text-ink-900">TECH CITY</span>
            </div>

            <div className="hidden flex-1 lg:block">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="lg:hidden">
                <GlobalSearch variant="icon" />
              </div>
              <button
                onClick={() => navigate('/services/new')}
                className="btn-primary hidden sm:inline-flex"
              >
                <Plus size={16} /> New Service
              </button>
              {enabled && (
                <button
                  onClick={lock}
                  className="btn-ghost px-2"
                  title="Lock the application"
                  aria-label="Lock"
                >
                  <Lock size={17} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-3 pb-28 pt-4 sm:px-5 sm:pb-10 sm:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden no-print">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon
            if (item.primary) {
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="flex flex-col items-center justify-center py-1.5"
                  aria-label="New service"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition-transform active:scale-95">
                    <Icon size={20} />
                  </span>
                </button>
              )
            }
            if (item.to === '/more') {
              return (
                <button
                  key={item.to}
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 text-ink-500"
                >
                  <span className="relative">
                    <Icon size={19} />
                    {pendingReminders + pendingPayments > 0 && (
                      <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </span>
                  <span className="text-[10.5px] font-medium">{item.label}</span>
                </button>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                    isActive ? 'text-brand-700' : 'text-ink-500'
                  }`
                }
              >
                <Icon size={19} />
                <span className="text-[10.5px] font-medium">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function SidebarContent({
  badgeFor,
  settings,
}: {
  badgeFor: (to: string) => number
  settings: { name: string; tagline: string }
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-ink-200 px-4 py-3.5">
        <BrandMark size={34} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight tracking-tight text-ink-900">
            {settings.name}
          </p>
          <p className="truncate text-[10.5px] leading-tight text-ink-500">{settings.tagline}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const Icon = item.icon
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700">
                  {badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-ink-200 p-3">
        <p className="text-[11px] leading-relaxed text-ink-400">
          Data is stored securely on this device. Take regular backups from{' '}
          <span className="font-medium text-ink-500">Settings → Backup</span>.
        </p>
      </div>
    </>
  )
}
