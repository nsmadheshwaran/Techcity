import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  HardDrive,
  LayoutDashboard,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Plus,
  ScrollText,
  Settings as SettingsIcon,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { GlobalSearch, GlobalSearchProvider } from '@/components/GlobalSearch'
import { CloudBanner, CloudSyncPill } from '@/cloud/CloudGate'
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
    items: [{ to: '/settings', label: 'Settings', icon: SettingsIcon }],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services/new', label: 'New', icon: Plus, primary: true },
  { to: '/services', label: 'Services', icon: Wrench },
  { to: '/more', label: 'More', icon: Menu },
]

const COLLAPSE_KEY = 'techcity.nav.collapsed'

/**
 * Resolves the current URL to the module it belongs to, so the header can show
 * "Customers › Detail" style breadcrumbs. Longest matching prefix wins, which
 * keeps nested routes (/customers/:id) attributed to their parent module.
 */
function useModuleCrumb(pathname: string) {
  return useMemo(() => {
    if (pathname === '/') return { module: 'Dashboard', to: '/', leaf: null as string | null }
    const match = ALL_NAV_ITEMS.filter((i) => i.to !== '/' && pathname.startsWith(i.to)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0]
    if (!match) return { module: 'Not found', to: pathname, leaf: null }
    const rest = pathname.slice(match.to.length).replace(/^\//, '')
    const leaf = !rest ? null : rest === 'new' ? 'New' : rest.endsWith('/edit') ? 'Edit' : 'Detail'
    return { module: match.label, to: match.to, leaf }
  }, [pathname])
}

export function AppLayout() {
  return (
    <GlobalSearchProvider>
      <AppShell />
    </GlobalSearchProvider>
  )
}

function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === 'true',
  )
  const location = useLocation()
  const navigate = useNavigate()
  const settings = useSettings()
  const { enabled, lock, username } = useAuth()
  const reminders = useReminders()
  const services = useServices()
  const crumb = useModuleCrumb(location.pathname)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  const pendingReminders = (reminders ?? []).filter(
    (r) => !r.done && (daysUntil(r.dueDate) ?? 99) <= 7,
  ).length
  const pendingPayments = (services ?? []).filter(
    (s) => s.balance > 0 && s.status !== 'Cancelled',
  ).length

  const badgeFor = (to: string) =>
    to === '/reminders' ? pendingReminders : to === '/payments' ? pendingPayments : 0

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white transition-[width] duration-150 lg:flex no-print ${
          collapsed ? 'w-[60px]' : 'w-[232px]'
        }`}
      >
        <SidebarContent
          badgeFor={badgeFor}
          settings={settings}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="absolute inset-0 bg-ink-950/45 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3.5 rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent badgeFor={badgeFor} settings={settings} collapsed={false} />
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className={`transition-[padding] duration-150 ${collapsed ? 'lg:pl-[60px]' : 'lg:pl-[232px]'}`}>
        <header className="sticky top-0 z-20 border-b border-line bg-white no-print">
          <div className="flex h-13 items-center gap-2.5 px-3 sm:px-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-2 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <BrandMark size={26} />
              <span className="text-[13px] font-bold tracking-tight text-ink-900">TECH CITY</span>
            </div>

            {/* Breadcrumb — tells you where you are at a glance */}
            <nav
              aria-label="Breadcrumb"
              className="hidden min-w-0 items-center gap-1 text-[13px] lg:flex"
            >
              <Link
                to={crumb.to}
                className={`truncate font-semibold ${
                  crumb.leaf ? 'text-ink-500 hover:text-brand-700' : 'text-ink-900'
                }`}
              >
                {crumb.module}
              </Link>
              {crumb.leaf && (
                <>
                  <ChevronRight size={14} className="shrink-0 text-ink-400" />
                  <span className="truncate font-semibold text-ink-900">{crumb.leaf}</span>
                </>
              )}
            </nav>

            {/* Search sits in the middle, like every CRM top bar */}
            <div className="mx-auto hidden w-full max-w-md lg:block">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="lg:hidden">
                <GlobalSearch variant="icon" />
              </div>

              <CloudSyncPill />

              <Link
                to="/reminders"
                className="relative hidden rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 sm:inline-flex"
                title={`${pendingReminders} reminder(s) due within 7 days`}
                aria-label="Reminders"
              >
                <Bell size={17} />
                {pendingReminders > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </Link>

              <button
                onClick={() => navigate('/services/new')}
                className="btn-primary hidden sm:inline-flex"
              >
                <Plus size={15} /> New Service
              </button>

              {enabled && (
                <button
                  onClick={lock}
                  className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                  title="Lock the application"
                  aria-label="Lock"
                >
                  <Lock size={16} />
                </button>
              )}

              <UserMenu username={username} orgName={settings.name} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-3 pb-28 pt-4 sm:px-5 sm:pb-10 sm:pt-5">
          <CloudBanner />
          <Outlet />
        </main>
      </div>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden no-print">
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white transition-transform active:scale-90">
                    <Icon size={19} />
                  </span>
                </button>
              )
            }
            if (item.to === '/more') {
              return (
                <button
                  key={item.to}
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 text-ink-500 active:text-brand-700"
                >
                  <span className="relative">
                    <Icon size={18} />
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
                    isActive ? 'text-brand-700 font-semibold' : 'text-ink-500 hover:text-ink-800'
                  }`
                }
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/** Avatar dropdown: identity, organisation and jump-offs — standard CRM top-right. */
function UserMenu({ username, orgName }: { username: string; orgName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (username || 'Owner').trim().charAt(0).toUpperCase() || 'O'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg animate-fade-in"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-[13px] font-semibold text-ink-900">{username || 'Owner'}</p>
            <p className="truncate text-[11.5px] text-ink-500">{orgName}</p>
          </div>
          <div className="p-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-700 hover:bg-ink-100"
              role="menuitem"
            >
              <SettingsIcon size={15} className="text-ink-500" /> Settings
            </Link>
            <Link
              to="/settings?tab=cloud"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-700 hover:bg-ink-100"
              role="menuitem"
            >
              <FileText size={15} className="text-ink-500" /> Backup & sync
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarContent({
  badgeFor,
  settings,
  collapsed,
  onToggleCollapse,
}: {
  badgeFor: (to: string) => number
  settings: { name: string; tagline: string }
  collapsed: boolean
  onToggleCollapse?: () => void
}) {
  return (
    <>
      {/* Organisation banner */}
      <div
        className={`flex items-center gap-2.5 border-b border-line py-3 ${
          collapsed ? 'justify-center px-2' : 'px-3.5'
        }`}
      >
        <BrandMark size={collapsed ? 30 : 32} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight tracking-tight text-ink-900">
              {settings.name}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] leading-tight text-ink-500">
              {settings.tagline}
            </p>
          </div>
        )}
      </div>

      {/* Modules */}
      <nav className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.title} className="mb-1">
            {collapsed ? (
              <div className="mx-2 my-2 border-t border-line-soft" />
            ) : (
              <p className="sidebar-section-header">{sec.title}</p>
            )}
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon
                const badge = badgeFor(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link-active' : ''} ${
                        collapsed ? 'justify-center px-0' : ''
                      }`
                    }
                  >
                    <span className="relative shrink-0">
                      <Icon size={17} />
                      {collapsed && badge > 0 && (
                        <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 && (
                          <span className="rounded bg-rose-50 px-1.5 text-[10.5px] font-bold leading-[18px] text-rose-700 ring-1 ring-rose-200">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse control (desktop only) */}
      {onToggleCollapse && (
        <div className="border-t border-line p-1.5">
          <button
            onClick={onToggleCollapse}
            className={`sidebar-link w-full ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && <span className="flex-1 truncate text-left">Collapse</span>}
          </button>
        </div>
      )}
    </>
  )
}
