/** Shared helpers for printable documents (spec sheets and loom cards). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Opens a print window and prints once the images have decoded.
 * Returns false when the browser blocks the popup so the caller can explain
 * what happened instead of failing silently.
 */
export function openPrintDocument(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false

  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()

  let printed = false
  const printOnce = () => {
    if (printed) return
    printed = true
    try {
      win.print()
    } catch {
      /* the user can still print manually from the opened window */
    }
  }

  const images = Array.from(win.document.images ?? [])
  const decoded = images.map((img) =>
    img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
  )
  void Promise.all(decoded).then(() => window.setTimeout(printOnce, 250))
  // Safety net for browsers where decoding stalls: never leave a blank window.
  window.setTimeout(printOnce, 4000)
  return true
}

/** A4 page styles shared by every printed document. */
export const PRINT_PAGE_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #14181F; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6B7280; margin: 18px 0 6px; }
  .muted { color: #6B7280; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #14181F; padding-bottom: 10px; }
  .brand { font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 5px 8px; border-bottom: 1px solid #E4E4E1; text-align: start; vertical-align: top; }
  th { color: #6B7280; font-weight: 500; }
  .swatches { display: flex; gap: 5px; flex-wrap: wrap; }
  .sw { width: 26px; height: 26px; border-radius: 4px; border: 1px solid rgba(0,0,0,.12); }
  .foot { margin-top: 22px; padding-top: 8px; border-top: 1px solid #E4E4E1; font-size: 9.5px; color: #9CA3AF; display: flex; justify-content: space-between; }
  .qr { text-align: center; }
  .qr svg { width: 132px; height: 132px; display: block; }
  .qr-url { font-size: 8.5px; color: #6B7280; word-break: break-all; max-width: 150px; margin-top: 4px; }
  .avoid { page-break-inside: avoid; }
`
