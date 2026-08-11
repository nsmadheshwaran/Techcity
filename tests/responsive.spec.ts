import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173/'
const WIDTHS = [360, 390, 414, 768, 1024, 1280, 1440, 1920]
const PAGES = [
  '#/', '#/customers', '#/services', '#/reports', '#/payments',
  '#/reminders', '#/equipment', '#/settings', '#/services/new',
]

test('no horizontal overflow or clipped content at any breakpoint', async ({ browser }) => {
  test.setTimeout(300_000)
  const seedCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const seed = await seedCtx.newPage()
  await seed.goto(BASE + '#/settings')
  await seed.waitForLoadState('networkidle')
  await seed.getByRole('button', { name: 'Backup & Export' }).click()
  await seed.getByRole('button', { name: 'Load demo data' }).click()
  await seed.getByText('Demo data loaded').waitFor({ timeout: 60000 })
  const state = await seedCtx.storageState()
  await seedCtx.close()

  const problems: string[] = []

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      storageState: state,
      isMobile: width < 768,
      hasTouch: width < 768,
    })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

    for (const hash of PAGES) {
      await page.goto(BASE + hash)
      await page.waitForTimeout(900)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      if (overflow > 1) problems.push(`${width}px ${hash}: horizontal overflow ${overflow}px`)

      // any element extending past the viewport?
      const wide = await page.evaluate((w) => {
        const out: string[] = []
        const inScroller = (el: Element) => {
          let p: Element | null = el.parentElement
          while (p) {
            const ox = getComputedStyle(p).overflowX
            if (ox === 'auto' || ox === 'scroll') return true
            p = p.parentElement
          }
          return false
        }
        document.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.right > w + 2 && getComputedStyle(el).overflowX !== 'auto' && !inScroller(el)) {
            const tag = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`
            if (!out.includes(tag)) out.push(tag)
          }
        })
        return out.slice(0, 3)
      }, width)
      if (wide.length) problems.push(`${width}px ${hash}: overflowing elements ${wide.join(', ')}`)
    }

    const real = errors.filter((e) => !e.includes('favicon') && !e.includes('fonts.g'))
    if (real.length) problems.push(`${width}px console errors: ${real.slice(0, 2).join(' | ')}`)

    await ctx.close()
    console.log(`✓ checked ${width}px`)
  }

  expect(problems, `\n${problems.join('\n')}`).toEqual([])
})

test('touch targets are large enough on mobile', async ({ browser }) => {
  test.setTimeout(120_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.waitForTimeout(1500)
  const small = await page.evaluate(() => {
    const bad: string[] = []
    document.querySelectorAll('nav a, nav button').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.height < 40) bad.push(`${el.textContent?.trim()} h=${Math.round(r.height)}`)
    })
    return bad
  })
  expect(small, `Small nav targets: ${small.join(', ')}`).toEqual([])
  console.log('✓ mobile nav touch targets >= 40px')
  await ctx.close()
})
