import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileText,
  Lock,
  Monitor,
  Save,
  Settings2,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useSettings } from '@/hooks/useData'
import { useAuth } from '@/lib/auth'
import { useCloud } from '@/cloud/CloudContext'
import { DEFAULT_SERVICE_TYPES, saveSettings } from '@/lib/db'
import {
  exportBackupJSON,
  exportCustomersCSV,
  exportEquipmentCSV,
  exportPaymentsCSV,
  exportProductsCSV,
  exportServicesCSV,
  restoreBackup,
  wipeAllData,
} from '@/services/backup'
import { clearDemoData, demoAllowed, seedDemoData } from '@/services/seed'
import { readFileAsDataURL, readFileAsText } from '@/utils/csv'
import { CloudStatusCard } from '@/cloud/CloudGate'

type Tab = 'business' | 'documents' | 'services' | 'cloud' | 'security' | 'backup'

const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
  { key: 'business', label: 'Business', icon: Building2 },
  { key: 'documents', label: 'PDF & Invoice', icon: FileText },
  { key: 'services', label: 'Service Defaults', icon: Settings2 },
  { key: 'cloud', label: 'Cloud Sync', icon: Cloud },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'backup', label: 'Backup & Export', icon: Database },
]

export default function SettingsPage() {
  const settings = useSettings()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab
  const [tab, setTab] = useState<Tab>(
    tabParam && ['business', 'documents', 'services', 'cloud', 'security', 'backup'].includes(tabParam)
      ? tabParam
      : 'business',
  )

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Business details, document templates, defaults, security and backups."
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-4">
        <nav className="card h-fit min-w-0 max-w-full overflow-hidden p-1.5 lg:col-span-1">
          <div className="flex min-w-0 flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors sm:flex-none sm:text-[13.5px] lg:w-full ${
                  tab === key
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 lg:col-span-3">
          {tab === 'business' && <BusinessTab settings={settings} toast={toast} />}
          {tab === 'documents' && <DocumentsTab settings={settings} toast={toast} />}
          {tab === 'services' && <ServiceDefaultsTab settings={settings} toast={toast} />}
          {tab === 'cloud' && (
            <div className="space-y-4">
              <CloudStatusCard />
            </div>
          )}
          {tab === 'security' && <SecurityTab toast={toast} />}
          {tab === 'backup' && <BackupTab toast={toast} />}
        </div>
      </div>
    </>
  )
}

type ToastApi = ReturnType<typeof useToast>
type Settings = ReturnType<typeof useSettings>

/* ------------------------------------------------------------------ */

function BusinessTab({ settings, toast }: { settings: Settings; toast: ToastApi }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setForm(settings), [settings])

  async function save() {
    if (!form.name.trim()) return toast.warning('Business name is required')
    setSaving(true)
    try {
      await saveSettings({
        name: form.name.trim(),
        tagline: form.tagline,
        address: form.address,
        phone: form.phone,
        altPhone: form.altPhone,
        email: form.email,
        website: form.website,
        gstNumber: form.gstNumber,
        gstEnabled: form.gstEnabled,
        defaultTaxPercent: Number(form.defaultTaxPercent) || 0,
        currency: form.currency || '₹',
        logoDataUrl: form.logoDataUrl,
      })
      toast.success('Business details saved')
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function onLogo(file?: File) {
    if (!file) return
    if (file.size > 512_000) {
      toast.warning('Logo too large', 'Please use an image under 500 KB for fast PDF generation.')
      return
    }
    try {
      const dataUrl = await readFileAsDataURL(file)
      setForm((f) => ({ ...f, logoDataUrl: dataUrl }))
      await saveSettings({ logoDataUrl: dataUrl })
      toast.success('Logo updated', 'It will appear on the app and all PDFs.')
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : 'Could not read the image.')
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-4 text-[15px] font-semibold text-ink-900">Business Information</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Business Name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="sm:col-span-2"
        />
        <TextField
          label="Tagline"
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          className="sm:col-span-2"
        />
        <TextAreaField
          label="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          rows={2}
          className="sm:col-span-2"
        />
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <TextField
          label="Alternate Phone"
          value={form.altPhone ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, altPhone: e.target.value }))}
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <TextField
          label="Website"
          value={form.website ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        />
        <TextField
          label="Currency Symbol"
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          hint="Used across the app (PDFs print as Rs.)"
        />
      </div>

      <div className="mt-5 rounded-lg border border-ink-200 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-ink-300 accent-brand-600"
            checked={form.gstEnabled}
            onChange={(e) => setForm((f) => ({ ...f, gstEnabled: e.target.checked }))}
          />
          <span>
            <span className="block text-[13.5px] font-medium text-ink-900">
              Enable GST / tax on invoices
            </span>
            <span className="block text-[12.5px] text-ink-500">
              Tax is never applied unless you enable it here.
            </span>
          </span>
        </label>
        {form.gstEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="GST Number"
              value={form.gstNumber ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
              placeholder="33ABCDE1234F1Z5"
            />
            <TextField
              label="Default Tax %"
              type="number"
              min={0}
              step="0.01"
              value={String(form.defaultTaxPercent)}
              onChange={(e) =>
                setForm((f) => ({ ...f, defaultTaxPercent: Number(e.target.value) || 0 }))
              }
            />
          </div>
        )}
      </div>

      <div className="mt-5">
        <label className="field-label">Business Logo</label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-ink-200 bg-ink-50">
            {form.logoDataUrl ? (
              <img src={form.logoDataUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[11px] text-ink-400">No logo</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload logo
          </button>
          {form.logoDataUrl && (
            <button
              className="btn-ghost text-red-600"
              onClick={async () => {
                setForm((f) => ({ ...f, logoDataUrl: '' }))
                await saveSettings({ logoDataUrl: '' })
                toast.success('Logo removed')
              }}
            >
              <X size={15} /> Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-ink-500">PNG or JPG, under 500 KB.</p>
      </div>

      <button className="btn-primary mt-5" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? 'Saving…' : 'Save Business Details'}
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function DocumentsTab({ settings, toast }: { settings: Settings; toast: ToastApi }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(settings), [settings])

  async function save() {
    setSaving(true)
    try {
      await saveSettings({
        terms: form.terms,
        footerText: form.footerText,
        invoicePrefix: form.invoicePrefix || 'TC-INV-',
      })
      toast.success('Document settings saved')
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-[15px] font-semibold text-ink-900">PDF & Invoice Settings</h2>
      <p className="mb-4 text-[13px] text-ink-500">
        These appear on every service report, invoice and receipt. Business name, address and logo
        come from the Business tab.
      </p>
      <div className="space-y-4">
        <TextField
          label="Invoice Number Prefix"
          value={form.invoicePrefix}
          onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))}
          hint="Example: TC-INV-00001"
        />
        <TextField
          label="Footer Text"
          value={form.footerText}
          onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
        />
        <TextAreaField
          label="Terms & Conditions"
          value={form.terms}
          onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
          rows={8}
          hint="One term per line."
        />
      </div>
      <button className="btn-primary mt-5" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? 'Saving…' : 'Save Document Settings'}
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function ServiceDefaultsTab({ settings, toast }: { settings: Settings; toast: ToastApi }) {
  const [form, setForm] = useState(settings)
  const [newType, setNewType] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(settings), [settings])

  async function save() {
    setSaving(true)
    try {
      await saveSettings({
        defaultWarrantyPeriod: form.defaultWarrantyPeriod,
        defaultTechnician: form.defaultTechnician,
        serviceTypes: form.serviceTypes,
      })
      toast.success('Service defaults saved')
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-4 text-[15px] font-semibold text-ink-900">Service Defaults</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Default Warranty Period"
          value={form.defaultWarrantyPeriod}
          onChange={(e) => setForm((f) => ({ ...f, defaultWarrantyPeriod: e.target.value }))}
          placeholder="3 Months"
          hint="Pre-filled on new services"
        />
        <TextField
          label="Default Technician"
          value={form.defaultTechnician}
          onChange={(e) => setForm((f) => ({ ...f, defaultTechnician: e.target.value }))}
          placeholder="Optional"
        />
      </div>

      <div className="mt-5">
        <label className="field-label">Service Types</label>
        <div className="flex flex-wrap gap-1.5">
          {form.serviceTypes.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 py-1 pl-3 pr-1.5 text-[12.5px] text-ink-700"
            >
              {t}
              <button
                onClick={() =>
                  setForm((f) => ({ ...f, serviceTypes: f.serviceTypes.filter((x) => x !== t) }))
                }
                className="rounded-full p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
                aria-label={`Remove ${t}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add a service type"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const v = newType.trim()
                if (v && !form.serviceTypes.includes(v))
                  setForm((f) => ({ ...f, serviceTypes: [...f.serviceTypes, v] }))
                setNewType('')
              }
            }}
          />
          <button
            className="btn-secondary"
            onClick={() => {
              const v = newType.trim()
              if (v && !form.serviceTypes.includes(v))
                setForm((f) => ({ ...f, serviceTypes: [...f.serviceTypes, v] }))
              setNewType('')
            }}
          >
            Add
          </button>
          <button
            className="btn-ghost"
            onClick={() => setForm((f) => ({ ...f, serviceTypes: [...DEFAULT_SERVICE_TYPES] }))}
          >
            Reset
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-500">
          Service status options are fixed: Received, Diagnosis, In Progress, Waiting for Parts,
          Ready, Delivered, Completed, Cancelled.
        </p>
      </div>

      <button className="btn-primary mt-5" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? 'Saving…' : 'Save Service Defaults'}
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function SecurityTab({ toast }: { toast: ToastApi }) {
  const { enabled, username, setPasscode, disableLock } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [name, setName] = useState(username)
  const [busy, setBusy] = useState(false)

  useEffect(() => setName(username), [username])

  async function apply() {
    if (next !== confirmPass) return toast.warning('Passcodes do not match')
    setBusy(true)
    try {
      await setPasscode(enabled ? current : null, next, name)
      toast.success(enabled ? 'Passcode updated' : 'Passcode enabled')
      setCurrent('')
      setNext('')
      setConfirmPass('')
    } catch (err) {
      toast.error('Could not set passcode', err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await disableLock(current)
      toast.success('Passcode removed')
      setCurrent('')
    } catch (err) {
      toast.error('Could not remove passcode', err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-[15px] font-semibold text-ink-900">Security</h2>
      <p className="mb-4 text-[13px] leading-relaxed text-ink-500">
        All data is stored locally in this browser. Set a passcode so customer records are not
        visible to anyone who opens the app on this device. The passcode is stored as a SHA-256
        hash — never in plain text.
        {' '}
        <span className="text-ink-600">
          For multi-device access with server-side accounts, connect Supabase (see README).
        </span>
      </p>

      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-1.5 text-[13px]">
        <Lock size={14} className={enabled ? 'text-emerald-600' : 'text-ink-400'} />
        {enabled ? 'Passcode lock is ON' : 'Passcode lock is OFF'}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Display Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Owner"
        />
        {enabled && (
          <TextField
            label="Current Passcode"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <TextField
          label={enabled ? 'New Passcode' : 'Passcode'}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="Minimum 4 characters"
        />
        <TextField
          label="Confirm Passcode"
          type="password"
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={apply} disabled={busy || !next}>
          <Save size={16} /> {enabled ? 'Update Passcode' : 'Enable Passcode Lock'}
        </button>
        {enabled && (
          <button className="btn-secondary text-red-600" onClick={remove} disabled={busy || !current}>
            Remove passcode
          </button>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-ink-200 bg-ink-50/70 p-4">
        <div className="flex items-center gap-2 mb-2 text-ink-900 font-semibold text-[13.5px]">
          <Shield size={16} className="text-brand-600" />
          <span>Data Privacy &amp; Storage Architecture</span>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-600 mb-3">
          TechCity CRM is designed on a <strong>local-first privacy model</strong>. Your records remain private and secure:
        </p>
        <ul className="space-y-1.5 text-[12px] text-ink-600 list-disc list-inside">
          <li><strong>Zero Third-Party Trackers:</strong> No advertising cookies, tracking pixels, or external analytics scripts are loaded.</li>
          <li><strong>Local Browser Storage:</strong> Primary records live in this browser&apos;s IndexedDB database and survive offline reboots.</li>
          <li><strong>Private Cloud Sync:</strong> Multi-device synchronization connects directly to your private Supabase backend protected by Row-Level Security (RLS).</li>
          <li><strong>Total Data Ownership:</strong> You can export full JSON/CSV backups or wipe device records at any time from the Backup tab.</li>
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  return (
    <section className="card border-brand-200/80 bg-gradient-to-br from-white via-brand-50/20 to-brand-50/40 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3.5 mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20">
            <Smartphone size={20} />
          </span>
          <div>
            <h2 className="text-[15.5px] font-bold text-ink-900 leading-tight">Install App on Mobile & Monitor</h2>
            <p className="text-[12px] text-ink-500">Run TechCity CRM as a standalone app on your phone, tablet, or PC counter screen</p>
          </div>
        </div>
        {installed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> Installed
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ink-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-ink-900 font-semibold text-sm mb-1.5">
            <Smartphone size={16} className="text-brand-600" />
            <span>Mobile Phone (Android / iPhone)</span>
          </div>
          <p className="text-xs text-ink-600 leading-relaxed">
            Open this page in <strong>Chrome</strong> (Android) or <strong>Safari</strong> (iPhone/iPad).
            Tap the menu / share button and select <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong>.
          </p>
        </div>

        <div className="rounded-lg border border-ink-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-ink-900 font-semibold text-sm mb-1.5">
            <Monitor size={16} className="text-brand-600" />
            <span>Counter Monitor / PC (Chrome / Edge)</span>
          </div>
          <p className="text-xs text-ink-600 leading-relaxed">
            In Chrome or Edge, click the <strong>Install icon</strong> in the right side of the address bar, or open browser menu → <strong>Cast, save and share → Install app</strong>.
          </p>
        </div>
      </div>

      {deferredPrompt && !installed && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-brand-600 px-4 py-2.5 text-white">
          <span className="text-xs font-medium">Ready to install directly on this device!</span>
          <button
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-sm transition-transform active:scale-95"
          >
            <Download size={14} /> Install Now
          </button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

function BackupTab({ toast }: { toast: ToastApi }) {
  const cloud = useCloud()
  const confirm = useConfirm()
  const restoreRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<unknown>, successMessage: string) {
    setBusy(key)
    try {
      const result = await fn()
      toast.success(successMessage, typeof result === 'number' ? `${result} record(s).` : undefined)
    } catch (err) {
      toast.error('Operation failed', err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setBusy(null)
    }
  }

  async function onRestore(file?: File) {
    if (!file) return
    const ok = await confirm({
      title: 'Restore from backup?',
      message:
        'All current data in this browser will be replaced by the contents of the backup file. Export a backup first if you are unsure.',
      confirmLabel: 'Restore',
      danger: true,
    })
    if (!ok) return
    setBusy('restore')
    try {
      const text = await readFileAsText(file)
      const result = await restoreBackup(text)
      toast.success(
        'Backup restored',
        `${result.customers} customers and ${result.services} services loaded. Refreshing pages…`,
      )
      // Trigger cloud sync if logged in so restored records sync to Supabase immediately
      if (cloud.userEmail) {
        void cloud.refresh()
      }
    } catch (err) {
      toast.error('Restore failed', err instanceof Error ? err.message : 'Invalid backup file.')
    } finally {
      setBusy(null)
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  async function onWipe() {
    const ok = await confirm({
      title: 'Delete ALL business data?',
      message:
        'Every customer, service, payment, equipment and reminder record will be permanently deleted from this device. Settings are kept. This cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
    })
    if (!ok) return
    await run('wipe', wipeAllData, 'All data deleted')
  }

  return (
    <div className="space-y-4">
      <CloudStatusCard />
      <InstallAppCard />
      <section className="card p-4 sm:p-5">
        <h2 className="mb-1 text-[15px] font-semibold text-ink-900">Backup & Restore</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-500">
          Customer service records are important business data. Download a full backup regularly and
          keep a copy on a pen drive or cloud storage.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => run('backup', exportBackupJSON, 'Backup downloaded')}
          >
            <Database size={16} /> Download Full Backup (JSON)
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onRestore(e.target.files?.[0])}
          />
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => restoreRef.current?.click()}
          >
            <Upload size={16} /> Restore from Backup
          </button>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-1 text-[15px] font-semibold text-ink-900">Export Records</h2>
        <p className="mb-4 text-[13px] text-ink-500">
          Download as CSV or as a real Excel (.xlsx) workbook for accounting and reporting.
        </p>
        <div className="divide-y divide-line rounded-lg border border-line">
          {(
            [
              ['c', 'Customers', exportCustomersCSV, 'Customers exported'],
              ['s', 'Service Records', exportServicesCSV, 'Service records exported'],
              ['p', 'Payments', exportPaymentsCSV, 'Payments exported'],
              ['e', 'Equipment', exportEquipmentCSV, 'Equipment exported'],
              ['pr', 'Stock', exportProductsCSV, 'Stock exported'],
            ] as const
          ).map(([key, label, fn, message]) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-ink-800">{label}</span>
              <div className="flex gap-2">
                <button
                  className="btn-ghost px-2.5 py-1 text-[12.5px]"
                  disabled={busy !== null}
                  onClick={() => run(key, () => fn('csv'), message)}
                >
                  CSV
                </button>
                <button
                  className="btn-ghost px-2.5 py-1 text-[12.5px]"
                  disabled={busy !== null}
                  onClick={() => run(key, () => fn('excel'), message)}
                >
                  Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-1 text-[15px] font-semibold text-ink-900">Sample / Demo Data</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-500">
          Load a demo dataset (10 customers, 20 services, 5 equipment records) to explore the app.
          Every demo row is tagged so it can be removed without touching real records.
          {!demoAllowed() && (
            <span className="mt-1 block font-medium text-ink-700">
              Demo data is disabled in this build. Set VITE_ENABLE_DEMO_DATA=true to allow it.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            disabled={busy !== null || !demoAllowed()}
            onClick={() =>
              run('seed', async () => {
                const r = await seedDemoData()
                return r.customers + r.services
              }, 'Demo data loaded')
            }
          >
            Load demo data
          </button>
          <button
            className="btn-secondary text-red-600"
            disabled={busy !== null}
            onClick={() => run('cleardemo', clearDemoData, 'Demo data removed')}
          >
            <Trash2 size={15} /> Remove demo data
          </button>
        </div>
      </section>

      <section className="card border-red-200 p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-red-800">
          <AlertTriangle size={16} /> Danger Zone
        </h2>
        <p className="mb-4 text-[13px] text-ink-600">
          Permanently delete all business records from this device. Export a backup first.
        </p>
        <button className="btn-danger" disabled={busy !== null} onClick={onWipe}>
          <Trash2 size={16} /> Delete all data
        </button>
      </section>
    </div>
  )
}
