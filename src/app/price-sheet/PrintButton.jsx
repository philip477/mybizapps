'use client'

// Small client island so the otherwise-static server-rendered price sheet
// can trigger the browser print dialog.
export default function PrintButton() {
  return (
    <button className="btn-print" onClick={() => window.print()}>
      🖨️ Print this sheet
    </button>
  )
}
