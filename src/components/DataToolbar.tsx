import React, { useRef, useState } from 'react'
import { exportWorkouts, importWorkouts } from '../store.ts'

interface Props {
  onImported: () => void
}

export default function DataToolbar({ onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const count = await importWorkouts(file)
      onImported()
      setStatus(`Imported ${count} workout${count !== 1 ? 's' : ''}`)
    } catch {
      setStatus('Import failed — invalid file')
    }
    e.target.value = ''
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="data-toolbar">
      <button className="btn-data" onClick={exportWorkouts}>
        <span>↓</span> Export
      </button>
      <button className="btn-data" onClick={() => fileInputRef.current?.click()}>
        <span>↑</span> Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      {status && <span className="data-toolbar-status">{status}</span>}
    </div>
  )
}
