import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LockScreen } from '@/components/LockScreen'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { AuthProvider, useAuth } from '@/lib/auth'
import { initDB } from '@/lib/db'

import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import ServicesPage from '@/pages/ServicesPage'
import ServiceFormPage from '@/pages/ServiceFormPage'
import ServiceDetailPage from '@/pages/ServiceDetailPage'
import ReportsPage from '@/pages/ReportsPage'
import EquipmentPage from '@/pages/EquipmentPage'
import CallsPage from '@/pages/CallsPage'
import QuotationsPage from '@/pages/QuotationsPage'
import QuotationFormPage from '@/pages/QuotationFormPage'
import RemindersPage from '@/pages/RemindersPage'
import PaymentsPage from '@/pages/PaymentsPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * HashRouter is used so the built app works when opened from a static host or
 * even the local file system without any server rewrite rules.
 */
const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'services/new', element: <ServiceFormPage /> },
      { path: 'services/:id/edit', element: <ServiceFormPage /> },
      { path: 'services/:id', element: <ServiceDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'calls', element: <CallsPage /> },
      { path: 'quotations', element: <QuotationsPage /> },
      { path: 'quotations/new', element: <QuotationFormPage /> },
      { path: 'quotations/:id/edit', element: <QuotationFormPage /> },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function Gate() {
  const { ready, enabled, unlocked } = useAuth()
  if (!ready) return <LoadingState label="Starting Tech City Technology…" />
  if (enabled && !unlocked) return <LockScreen />
  return <RouterProvider router={router} />
}

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    initDB()
      .then(() => !cancelled && setStatus('ready'))
      .catch((err: unknown) => {
        if (cancelled) return
        setMessage(
          err instanceof Error
            ? `${err.message}. If you are in a private/incognito window, browser storage may be blocked.`
            : 'The local database could not be opened.',
        )
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          {status === 'loading' && (
            <div className="flex min-h-dvh items-center justify-center">
              <LoadingState label="Loading your business data…" />
            </div>
          )}
          {status === 'error' && (
            <div className="flex min-h-dvh items-center justify-center p-6">
              <div className="card max-w-lg p-2">
                <ErrorState message={message} onRetry={() => window.location.reload()} />
              </div>
            </div>
          )}
          {status === 'ready' && (
            <AuthProvider>
              <Gate />
            </AuthProvider>
          )}
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
