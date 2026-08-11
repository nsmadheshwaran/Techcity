import { db } from '@/lib/db'
import { createCustomer } from './customers'
import { createEquipment } from './equipment'
import { createService, type PartDraft } from './services'
import { addDays, addMonths, todayISO } from '@/utils/format'
import type { PaymentMethod, ServiceStatus } from '@/types'

/**
 * DEVELOPMENT-ONLY sample data.
 *
 * Never runs automatically in a production build: it is only triggered manually from
 * Settings → Demo data, and the button is disabled unless `import.meta.env.DEV` is true
 * or VITE_ENABLE_DEMO_DATA === 'true'. Every row created here is tagged `isDemo: true`
 * so it can be removed in one click without touching real business records.
 */
export function demoAllowed(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
}

const T = todayISO()

const customers = [
  {
    name: 'Ravi Kumar',
    phone: '9876543210',
    altPhone: '9445012345',
    email: 'ravi.kumar@gmail.com',
    address: '12 Bharathi Street, RS Puram',
    city: 'Coimbatore',
    pincode: '641002',
    notes: 'Owns a provision store — 8 camera CCTV setup.',
  },
  {
    name: 'Priya Sundaram',
    phone: '9840012345',
    email: 'priya.s@outlook.com',
    address: '45B Lake View Apartments, Saibaba Colony',
    city: 'Coimbatore',
    pincode: '641011',
    notes: 'Prefers evening service visits.',
  },
  {
    name: 'Anand Traders',
    phone: '9500123456',
    altPhone: '0422 2345678',
    email: 'accounts@anandtraders.in',
    address: '7 Big Bazaar Street, Town Hall',
    city: 'Coimbatore',
    pincode: '641001',
    notes: 'Business account. GST invoice required.',
  },
  {
    name: 'Meena Rajan',
    phone: '9791234567',
    email: 'meena.rajan@yahoo.com',
    address: '22 Kamaraj Road, Peelamedu',
    city: 'Coimbatore',
    pincode: '641004',
  },
  {
    name: 'Karthik Subramaniam',
    phone: '9600456789',
    email: 'karthik.sub@gmail.com',
    address: '9 TV Samy Road, RS Puram',
    city: 'Coimbatore',
    pincode: '641002',
    notes: 'Gaming PC — custom build customer.',
  },
  {
    name: 'Sri Lakshmi Textiles',
    phone: '9865321470',
    email: 'srilakshmitex@gmail.com',
    address: '134 Oppanakara Street',
    city: 'Coimbatore',
    pincode: '641001',
    notes: '16 channel NVR, annual maintenance contract.',
  },
  {
    name: 'Deepak Menon',
    phone: '9445566778',
    email: 'deepak.menon@gmail.com',
    address: '3 Race Course Road',
    city: 'Coimbatore',
    pincode: '641018',
  },
  {
    name: 'Fathima Beevi',
    phone: '9080112233',
    address: '88 Karumbukadai Main Road',
    city: 'Coimbatore',
    pincode: '641021',
  },
  {
    name: 'Green Valley School',
    phone: '9944556677',
    email: 'office@greenvalleyschool.edu.in',
    address: 'Thudiyalur Main Road',
    city: 'Coimbatore',
    pincode: '641034',
    notes: 'School campus — 24 cameras across 3 blocks.',
  },
  {
    name: 'Vignesh Prabhu',
    phone: '9884433221',
    email: 'vignesh.prabhu@gmail.com',
    address: '17 Nehru Nagar, Kalapatti',
    city: 'Coimbatore',
    pincode: '641048',
  },
]

interface SeedService {
  ci: number
  date: string
  type: string
  status: ServiceStatus
  product?: string
  brand?: string
  model?: string
  serial?: string
  complaint: string
  diagnosis?: string
  work?: string
  technician: string
  charge: number
  partsCost: number
  discount: number
  paid: number
  method?: PaymentMethod
  warranty?: string
  next?: string
  parts?: PartDraft[]
  notes?: string
}

const seedServices: SeedService[] = [
  {
    ci: 0,
    date: addMonths(T, -7),
    type: 'CCTV Installation',
    status: 'Completed',
    product: 'CCTV System',
    brand: 'Hikvision',
    model: 'DS-7108HGHI-K1',
    serial: 'HK7108-22910',
    complaint: 'New 8 camera CCTV setup required for shop premises.',
    diagnosis: 'Site survey completed. 8 dome/bullet cameras with 1TB storage recommended.',
    work: 'Installed 8 cameras, DVR, 1TB HDD, power supply, 180m cable. Mobile view configured.',
    technician: 'Suresh',
    charge: 4000,
    partsCost: 14000,
    discount: 0,
    paid: 18000,
    method: 'Bank Transfer',
    warranty: '1 Year',
    next: addMonths(T, 5),
    parts: [
      { name: 'Hikvision Dome Camera 2MP', quantity: 4, unitPrice: 1400 },
      { name: 'Hikvision Bullet Camera 2MP', quantity: 4, unitPrice: 1500 },
      { name: '1TB Surveillance HDD', quantity: 1, unitPrice: 2400 },
    ],
  },
  {
    ci: 0,
    date: addMonths(T, -3),
    type: 'DVR Service',
    status: 'Completed',
    product: 'DVR',
    brand: 'Hikvision',
    model: 'DS-7108HGHI-K1',
    serial: 'HK7108-22910',
    complaint: 'DVR restarting frequently, recording stops randomly.',
    diagnosis: 'Faulty SMPS adapter, HDD bad sectors detected.',
    work: 'Replaced SMPS adapter, formatted and re-initialised HDD, firmware updated.',
    technician: 'Suresh',
    charge: 800,
    partsCost: 950,
    discount: 250,
    paid: 1500,
    method: 'UPI',
    warranty: '3 Months',
    next: addDays(T, 12),
    parts: [{ name: '12V 10A SMPS Power Supply', quantity: 1, unitPrice: 950 }],
  },
  {
    ci: 0,
    date: addDays(T, -6),
    type: 'CCTV Maintenance',
    status: 'Completed',
    product: 'CCTV System',
    brand: 'Hikvision',
    complaint: 'Routine maintenance — camera 3 blurred, night vision weak.',
    diagnosis: 'Dust on lens housings, IR LED weak on camera 3.',
    work: 'Cleaned all 8 cameras, re-aligned 2 cameras, replaced camera 3, tested playback.',
    technician: 'Suresh',
    charge: 1000,
    partsCost: 500,
    discount: 100,
    paid: 1000,
    method: 'Cash',
    warranty: '3 Months',
    next: addMonths(T, 6),
    parts: [{ name: 'Dome Camera 2MP (replacement)', quantity: 1, unitPrice: 500 }],
    notes: 'Balance to be collected on next visit.',
  },
  {
    ci: 1,
    date: addMonths(T, -5),
    type: 'Laptop Repair',
    status: 'Completed',
    product: 'Laptop',
    brand: 'HP',
    model: 'Pavilion 15-eg2009TU',
    serial: '5CD2178QJ4',
    complaint: 'Laptop not powering on after power cut.',
    diagnosis: 'Charging IC damaged on motherboard.',
    work: 'Chip level repair of charging section, thermal paste replaced, cleaned internals.',
    technician: 'Manoj',
    charge: 1500,
    partsCost: 600,
    discount: 100,
    paid: 2000,
    method: 'UPI',
    warranty: '3 Months',
    parts: [{ name: 'Charging IC + MOSFET set', quantity: 1, unitPrice: 600 }],
  },
  {
    ci: 1,
    date: addDays(T, -20),
    type: 'OS Installation',
    status: 'Completed',
    product: 'Laptop',
    brand: 'HP',
    model: 'Pavilion 15-eg2009TU',
    serial: '5CD2178QJ4',
    complaint: 'Windows very slow, frequent blue screen errors.',
    diagnosis: 'Corrupted Windows installation, HDD nearing failure.',
    work: 'Upgraded to 512GB SSD, fresh Windows 11 installation with drivers, data migrated.',
    technician: 'Manoj',
    charge: 700,
    partsCost: 3200,
    discount: 200,
    paid: 3700,
    method: 'Card',
    warranty: '1 Year',
    parts: [{ name: 'Crucial 512GB NVMe SSD', quantity: 1, unitPrice: 3200 }],
  },
  {
    ci: 2,
    date: addMonths(T, -9),
    type: 'Networking',
    status: 'Completed',
    product: 'Network Setup',
    brand: 'TP-Link',
    model: 'TL-SG1016D',
    complaint: 'Office LAN setup for 12 systems with billing server.',
    diagnosis: 'Structured cabling required with 16 port switch.',
    work: 'Laid Cat6 cabling for 12 nodes, installed switch + router, configured static IPs.',
    technician: 'Suresh',
    charge: 6000,
    partsCost: 12500,
    discount: 500,
    paid: 18000,
    method: 'Bank Transfer',
    warranty: '1 Year',
    parts: [
      { name: 'Cat6 Cable (305m box)', quantity: 1, unitPrice: 7200 },
      { name: 'TP-Link 16 Port Switch', quantity: 1, unitPrice: 4300 },
      { name: 'RJ45 Connectors (100 pcs)', quantity: 1, unitPrice: 1000 },
    ],
  },
  {
    ci: 2,
    date: addDays(T, -2),
    type: 'Printer Service',
    status: 'In Progress',
    product: 'Printer',
    brand: 'Epson',
    model: 'L3210',
    serial: 'X7PY045218',
    complaint: 'Printing faded, paper jam repeatedly.',
    diagnosis: 'Print head partially clogged, pickup roller worn out.',
    work: 'Head cleaning in progress. Pickup roller ordered.',
    technician: 'Manoj',
    charge: 600,
    partsCost: 450,
    discount: 0,
    paid: 0,
    warranty: '1 Month',
    parts: [{ name: 'Pickup Roller Assembly', quantity: 1, unitPrice: 450 }],
  },
  {
    ci: 3,
    date: addMonths(T, -4),
    type: 'Virus/Malware Removal',
    status: 'Completed',
    product: 'Desktop',
    brand: 'Dell',
    model: 'Vostro 3888',
    serial: 'DL3888V21',
    complaint: 'Pop-up ads everywhere, browser homepage changed.',
    diagnosis: 'Adware and browser hijacker infection.',
    work: 'Full malware scan and removal, browsers reset, licensed antivirus installed.',
    technician: 'Manoj',
    charge: 500,
    partsCost: 700,
    discount: 0,
    paid: 1200,
    method: 'Cash',
    warranty: '1 Year',
    parts: [{ name: 'Quick Heal Antivirus 1 Year', quantity: 1, unitPrice: 700 }],
  },
  {
    ci: 3,
    date: addDays(T, -1),
    type: 'Data Recovery',
    status: 'Waiting for Parts',
    product: 'External HDD',
    brand: 'Seagate',
    model: 'Expansion 2TB',
    serial: 'NA8K21LP',
    complaint: 'External drive not detected, clicking sound.',
    diagnosis: 'Head assembly failure. Donor drive required for recovery.',
    technician: 'Manoj',
    charge: 3500,
    partsCost: 0,
    discount: 0,
    paid: 1000,
    method: 'UPI',
    notes: 'Advance collected. Recovery attempt after donor drive arrives.',
  },
  {
    ci: 4,
    date: addMonths(T, -2),
    type: 'Computer Sales',
    status: 'Delivered',
    product: 'Gaming Desktop',
    brand: 'Custom Build',
    model: 'Ryzen 5 5600 / RTX 3060',
    serial: 'TCT-BUILD-0042',
    complaint: 'New gaming PC build within budget of 65k.',
    diagnosis: 'Configuration finalised with customer.',
    work: 'Assembled, stress tested, Windows 11 + drivers installed, cable management done.',
    technician: 'Karthik R',
    charge: 2000,
    partsCost: 61000,
    discount: 1500,
    paid: 61500,
    method: 'Bank Transfer',
    warranty: '1 Year',
    parts: [
      { name: 'AMD Ryzen 5 5600 CPU', quantity: 1, unitPrice: 12500 },
      { name: 'RTX 3060 12GB GPU', quantity: 1, unitPrice: 27000 },
      { name: 'B550M Motherboard', quantity: 1, unitPrice: 8500 },
      { name: '16GB DDR4 3200MHz RAM', quantity: 1, unitPrice: 3600 },
      { name: '1TB NVMe SSD + Cabinet + SMPS', quantity: 1, unitPrice: 9400 },
    ],
  },
  {
    ci: 4,
    date: addDays(T, -9),
    type: 'Desktop Service',
    status: 'Completed',
    product: 'Gaming Desktop',
    brand: 'Custom Build',
    serial: 'TCT-BUILD-0042',
    complaint: 'System overheating during gaming, fan noise high.',
    diagnosis: 'Dust build-up in radiator and GPU fans.',
    work: 'Full internal cleaning, thermal paste reapplied, fan curve tuned.',
    technician: 'Karthik R',
    charge: 800,
    partsCost: 250,
    discount: 50,
    paid: 1000,
    method: 'UPI',
    warranty: '1 Month',
    next: addMonths(T, 6),
    parts: [{ name: 'Thermal Paste MX-4', quantity: 1, unitPrice: 250 }],
  },
  {
    ci: 5,
    date: addMonths(T, -11),
    type: 'CCTV Installation',
    status: 'Completed',
    product: 'IP CCTV System',
    brand: 'CP Plus',
    model: 'CP-UNR-4K5162-V2',
    serial: 'CPNVR16-8871',
    complaint: '16 camera IP setup required across showroom and godown.',
    diagnosis: 'PoE NVR based setup with 4MP cameras recommended.',
    work: 'Installed 16 IP cameras, 16CH NVR, 4TB HDD, PoE switch and remote access.',
    technician: 'Suresh',
    charge: 12000,
    partsCost: 68000,
    discount: 3000,
    paid: 77000,
    method: 'Bank Transfer',
    warranty: '2 Years',
    next: addDays(T, 4),
    parts: [
      { name: 'CP Plus 4MP IP Camera', quantity: 16, unitPrice: 3400 },
      { name: '16CH PoE NVR', quantity: 1, unitPrice: 9600 },
      { name: '4TB Surveillance HDD', quantity: 1, unitPrice: 8800 },
    ],
  },
  {
    ci: 5,
    date: addMonths(T, -5),
    type: 'CCTV Maintenance',
    status: 'Completed',
    product: 'IP CCTV System',
    brand: 'CP Plus',
    complaint: 'Quarterly AMC maintenance visit.',
    diagnosis: 'All cameras functional, 2 cameras needed re-alignment.',
    work: 'Cleaned all cameras, checked recordings, updated NVR firmware, tested backup.',
    technician: 'Suresh',
    charge: 2500,
    partsCost: 0,
    discount: 0,
    paid: 2500,
    method: 'UPI',
    next: addDays(T, 4),
  },
  {
    ci: 6,
    date: addDays(T, -35),
    type: 'Hard Disk Replacement',
    status: 'Completed',
    product: 'Laptop',
    brand: 'Lenovo',
    model: 'IdeaPad 3 15ITL6',
    serial: 'PF3K2M8L',
    complaint: 'Laptop extremely slow, takes 10 minutes to boot.',
    diagnosis: 'Mechanical HDD with bad sectors.',
    work: 'Replaced with 480GB SSD, cloned data, Windows optimised.',
    technician: 'Manoj',
    charge: 600,
    partsCost: 2900,
    discount: 0,
    paid: 2000,
    method: 'Cash',
    warranty: '1 Year',
    notes: 'Balance ₹1,500 pending — customer will pay next visit.',
    parts: [{ name: 'WD Green 480GB SSD', quantity: 1, unitPrice: 2900 }],
  },
  {
    ci: 6,
    date: addDays(T, -3),
    type: 'Software Installation',
    status: 'Ready',
    product: 'Laptop',
    brand: 'Lenovo',
    model: 'IdeaPad 3 15ITL6',
    complaint: 'MS Office and Tally installation required.',
    diagnosis: 'Licensed software installation.',
    work: 'MS Office 2021 and Tally Prime installed and activated.',
    technician: 'Manoj',
    charge: 500,
    partsCost: 0,
    discount: 0,
    paid: 0,
    warranty: '1 Month',
  },
  {
    ci: 7,
    date: addDays(T, -14),
    type: 'Camera Replacement',
    status: 'Completed',
    product: 'CCTV Camera',
    brand: 'Dahua',
    model: 'HAC-B1A21',
    complaint: 'Two cameras showing black screen after lightning.',
    diagnosis: 'Camera boards damaged due to power surge.',
    work: 'Replaced 2 bullet cameras, installed surge protector on power line.',
    technician: 'Suresh',
    charge: 700,
    partsCost: 3200,
    discount: 200,
    paid: 3700,
    method: 'Cash',
    warranty: '1 Year',
    next: addMonths(T, 6),
    parts: [
      { name: 'Dahua Bullet Camera 2MP', quantity: 2, unitPrice: 1350 },
      { name: 'Surge Protector', quantity: 1, unitPrice: 500 },
    ],
  },
  {
    ci: 8,
    date: addMonths(T, -6),
    type: 'CCTV Installation',
    status: 'Completed',
    product: 'IP CCTV System',
    brand: 'Hikvision',
    model: 'DS-7616NI-Q2',
    serial: 'HK7616-4412',
    complaint: 'Campus surveillance for 3 blocks — 24 cameras.',
    diagnosis: 'Three NVR zones with fibre backbone between blocks.',
    work: 'Installed 24 cameras, 2 NVRs, fibre link, centralised monitoring in office.',
    technician: 'Suresh',
    charge: 22000,
    partsCost: 118000,
    discount: 8000,
    paid: 100000,
    method: 'Bank Transfer',
    warranty: '2 Years',
    next: addDays(T, 25),
    notes: 'Balance payable after school committee approval.',
    parts: [
      { name: 'Hikvision 4MP IP Camera', quantity: 24, unitPrice: 3600 },
      { name: '16CH NVR', quantity: 2, unitPrice: 9500 },
      { name: 'Fibre + accessories', quantity: 1, unitPrice: 12600 },
    ],
  },
  {
    ci: 8,
    date: addDays(T, -4),
    type: 'NVR Service',
    status: 'Diagnosis',
    product: 'NVR',
    brand: 'Hikvision',
    model: 'DS-7616NI-Q2',
    serial: 'HK7616-4412',
    complaint: 'Block B NVR not recording for last 3 days.',
    diagnosis: 'Checking HDD health and PoE switch power output.',
    technician: 'Suresh',
    charge: 1200,
    partsCost: 0,
    discount: 0,
    paid: 0,
  },
  {
    ci: 9,
    date: addDays(T, -45),
    type: 'Computer Repair',
    status: 'Completed',
    product: 'Desktop',
    brand: 'Acer',
    model: 'Aspire TC-1760',
    serial: 'ACR1760XT',
    complaint: 'No display on monitor, system beeps on start.',
    diagnosis: 'Faulty RAM module.',
    work: 'Replaced 8GB DDR4 RAM, cleaned slots, tested with memtest.',
    technician: 'Karthik R',
    charge: 400,
    partsCost: 1800,
    discount: 0,
    paid: 2200,
    method: 'UPI',
    warranty: '1 Year',
    parts: [{ name: 'Kingston 8GB DDR4 RAM', quantity: 1, unitPrice: 1800 }],
  },
  {
    ci: 9,
    date: T,
    type: 'Laptop Repair',
    status: 'Received',
    product: 'Laptop',
    brand: 'Asus',
    model: 'VivoBook X515EA',
    serial: 'M1N0PQ7788',
    complaint: 'Keyboard keys not working, screen flickering occasionally.',
    technician: 'Manoj',
    charge: 0,
    partsCost: 0,
    discount: 0,
    paid: 0,
    notes: 'Device received for inspection. Estimate to be shared after diagnosis.',
  },
]

const seedEquipment = [
  {
    ci: 0,
    productType: 'DVR',
    brand: 'Hikvision',
    model: 'DS-7108HGHI-K1',
    serialNumber: 'HK7108-22910',
    installationDate: addMonths(T, -7),
    warrantyPeriod: '2 Years',
    location: 'Shop billing counter',
    status: 'Active' as const,
    notes: '8 channel DVR with 1TB storage.',
  },
  {
    ci: 0,
    productType: 'Camera',
    brand: 'Hikvision',
    model: 'DS-2CE16D0T-IRP',
    serialNumber: 'HKCAM-1102',
    installationDate: addMonths(T, -7),
    warrantyPeriod: '1 Year',
    location: 'Shop entrance',
    status: 'Active' as const,
  },
  {
    ci: 5,
    productType: 'NVR',
    brand: 'CP Plus',
    model: 'CP-UNR-4K5162-V2',
    serialNumber: 'CPNVR16-8871',
    installationDate: addMonths(T, -11),
    warrantyPeriod: '2 Years',
    location: 'Showroom server rack',
    status: 'Active' as const,
    notes: '16 channel PoE NVR with 4TB HDD.',
  },
  {
    ci: 8,
    productType: 'Camera',
    brand: 'Hikvision',
    model: 'DS-2CD1343G0-I',
    serialNumber: 'HKIP-556677',
    installationDate: addMonths(T, -6),
    warrantyPeriod: '2 Years',
    location: 'Block A corridor',
    status: 'Active' as const,
  },
  {
    ci: 4,
    productType: 'Desktop',
    brand: 'Custom Build',
    model: 'Ryzen 5 5600 / RTX 3060',
    serialNumber: 'TCT-BUILD-0042',
    installationDate: addMonths(T, -2),
    warrantyPeriod: '1 Year',
    location: 'Home study room',
    status: 'Active' as const,
  },
]

export async function seedDemoData(): Promise<{ customers: number; services: number; equipment: number }> {
  if (!demoAllowed()) throw new Error('Demo data is disabled in this environment.')

  const created = []
  for (const c of customers) {
    // Skip if a customer with that phone already exists (avoids duplicates on re-seed).
    const all = await db.customers.toArray()
    const exists = all.find((x) => x.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, ''))
    if (exists) {
      created.push(exists)
      continue
    }
    created.push(await createCustomer({ ...c, isDemo: true }))
  }

  let serviceCount = 0
  for (const s of seedServices) {
    const customer = created[s.ci]
    if (!customer) continue
    await createService(
      {
        customerId: customer.id,
        serviceDate: s.date,
        serviceType: s.type,
        status: s.status,
        product: s.product,
        brand: s.brand,
        model: s.model,
        serialNumber: s.serial,
        complaint: s.complaint,
        diagnosis: s.diagnosis,
        workPerformed: s.work,
        technician: s.technician,
        serviceCharge: s.charge,
        partsCost: s.partsCost,
        discount: s.discount,
        taxPercent: 0,
        amountPaid: s.paid,
        paymentMethod: s.method,
        warrantyPeriod: s.warranty,
        nextServiceDate: s.next,
        notes: s.notes,
        isDemo: true,
      },
      s.parts ?? [],
    )
    serviceCount++
  }

  let equipmentCount = 0
  for (const e of seedEquipment) {
    const customer = created[e.ci]
    if (!customer) continue
    const { ci: _ci, ...rest } = e
    await createEquipment({ ...rest, customerId: customer.id, isDemo: true })
    equipmentCount++
  }

  return { customers: created.length, services: serviceCount, equipment: equipmentCount }
}

/** Removes every row tagged as demo data, leaving real business records untouched. */
export async function clearDemoData() {
  await db.transaction(
    'rw',
    [db.customers, db.services, db.serviceParts, db.payments, db.equipment, db.reminders],
    async () => {
      const demoServices = await db.services.filter((s) => s.isDemo === true).toArray()
      for (const s of demoServices) {
        await db.serviceParts.where('serviceId').equals(s.id).delete()
        await db.payments.where('serviceId').equals(s.id).delete()
        await db.reminders.where('serviceId').equals(s.id).delete()
      }
      await db.services.filter((s) => s.isDemo === true).delete()
      await db.equipment.filter((e) => e.isDemo === true).delete()
      await db.reminders.filter((r) => r.isDemo === true).delete()
      const demoCustomers = await db.customers.filter((c) => c.isDemo === true).toArray()
      for (const c of demoCustomers) {
        await db.payments.where('customerId').equals(c.id).delete()
        await db.reminders.where('customerId').equals(c.id).delete()
      }
      await db.customers.filter((c) => c.isDemo === true).delete()
    },
  )
}

export async function hasDemoData(): Promise<boolean> {
  const count = await db.customers.filter((c) => c.isDemo === true).count()
  return count > 0
}
