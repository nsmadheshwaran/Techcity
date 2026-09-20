import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { GlobalSearch, GlobalSearchProvider } from '@/components/GlobalSearch'
import { CloudSyncPill } from '@/cloud/CloudGate'
import { useAuth } from '@/lib/auth'
import { useReminders, useServices, useSettings } from '@/hooks/useData'
import { daysUntil } from '@/utils/format'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/services', label: 'Services', icon: Wrench },
      { to: '/reports', label: 'Service Reports', icon: FileText },
    ],
  },
  {
    title: 'Field & Sales',
    items: [
      { to: '/equipment', label: 'Products / Equipment', icon: HardDrive },
      { to: '/calls', label: 'Call Book', icon: PhoneCall },
      { to: '/quotations', label: 'Quotations', icon: ScrollText },
    ],
  },
  {
    title: 'Finance & Tasks',
    items: [
      { to: '/payments', label: 'Payments', icon: CreditCard },
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/reminders', label: 'Reminders', icon: Bell },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
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
    <div className="min-h-dvh bg-slate-50/50">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex no-print">
        <SidebarContent badgeFor={badgeFor} settings={settings} />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3.5 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent badgeFor={badgeFor} settings={settings} />
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="lg:pl-64">
        {/* Modern frosted glass top header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md no-print">
          <div className="flex h-15 items-center gap-3 px-3 sm:px-6">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2.5 lg:hidden">
              <BrandMark size={28} />
              <div>
                <span className="block text-[13px] font-bold tracking-tight text-slate-900 leading-tight">
                  TECH CITY
                </span>
                <span className="block text-[10px] text-slate-500 leading-none">CRM</span>
              </div>
            </div>

            {/* Desktop Command Palette trigger */}
            <div className="hidden flex-1 lg:block max-w-xl">
              <GlobalSearch />
            </div>

            {/* Right action strip */}
            <div className="ml-auto flex items-center gap-2">
              <div className="lg:hidden">
                <GlobalSearch variant="icon" />
              </div>

              {/* Live Cloud Sync Status Pill */}
              <CloudSyncPill />

              {/* Primary action */}
              <button
                onClick={() => navigate('/services/new')}
                className="btn-primary hidden sm:inline-flex py-2 px-3.5 text-xs font-semibold"
              >
                <Plus size={15} /> New Service
              </button>

              {/* App passcode lock button */}
              {enabled && (
                <button
                  onClick={lock}
                  className="btn-ghost rounded-xl p-2 text-slate-500 hover:text-slate-800"
                  title="Lock the application"
                  aria-label="Lock"
                >
                  <Lock size={16} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-3.5 pb-28 pt-4 sm:px-6 sm:pb-12 sm:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden no-print shadow-lg">
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
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md transition-transform active:scale-90">
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
                  className="flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500 active:text-brand-700"
                >
                  <span className="relative">
                    <Icon size={19} />
                    {pendingReminders + pendingPayments > 0 && (
                      <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
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
                    isActive ? 'text-brand-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                <Icon size={19} />
                <span className="text-[10px] font-medium">{item.label}</span>
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
      {/* Brand & Organization banner */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-4">
        <div className="relative">
          <BrandMark size={36} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white" title="Verified CRM Workspace">
            <ShieldCheck size={9} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-bold leading-tight tracking-tight text-slate-900">
              {settings.name}
            </p>
          </div>
          <p className="truncate text-[11px] leading-tight text-slate-500 mt-0.5">{settings.tagline}</p>
        </div>
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.title}>
            <p className="sidebar-section-header">{sec.title}</p>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
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
                      <span className="rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 shadow-xs">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile & device storage footer */}
      <div className="border-t border-slate-200/80 p-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-slate-100/80">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white text-xs shadow-xs">
            TC
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-semibold text-slate-900">Shop Terminal</p>
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" title="Online" />
            </div>
            <p className="truncate text-[10.5px] text-slate-500">IndexedDB Local Cache</p>
          </div>
          <Link
            to="/settings?tab=cloud"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-xs"
            title="Cloud Sync Settings"
          >
            <SettingsIcon size={14} />
          </Link>
        </div>
      </div>
    </>
  )
}
