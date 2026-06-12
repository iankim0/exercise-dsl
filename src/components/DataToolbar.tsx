import React, { useRef, useState } from 'react'
import { exportWorkouts, importWorkouts } from '../store.ts'

interface Props {
  onImported: () => void
}

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={e => e.stopPropagation()}>
        <div className="guide-header">
          <span className="guide-title">How to write a workout</span>
          <button className="guide-close" onClick={onClose}>✕</button>
        </div>

        <div className="guide-body">
          <p className="guide-intro">
            Each session is plain text. Write one exercise per line using a simple shorthand.
            Unrecognized lines are ignored, so you can write a partial plan and fill in the rest later.
          </p>

          <div className="guide-section">
            <div className="guide-section-title">Line types</div>
            <table className="guide-table">
              <tbody>
                <tr>
                  <td><code>D: MM/DD/YY</code></td>
                  <td>Session date</td>
                </tr>
                <tr>
                  <td><code>N: text</code></td>
                  <td>Note attached to the session</td>
                </tr>
                <tr>
                  <td><code>// text</code></td>
                  <td>Comment, ignored by the parser</td>
                </tr>
                <tr>
                  <td><code>Name NxM @ weight</code></td>
                  <td>Exercise</td>
                </tr>
                <tr>
                  <td><code>S: ex, ex, ...</code></td>
                  <td>Superset</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="guide-section">
            <div className="guide-section-title">Reps</div>
            <table className="guide-table">
              <tbody>
                <tr>
                  <td><code>3x5</code></td>
                  <td>3 sets of 5</td>
                </tr>
                <tr>
                  <td><code>3x[5,3,1]</code></td>
                  <td>Different reps each set</td>
                </tr>
                <tr>
                  <td><code>3x45sec</code></td>
                  <td>Timed sets (seconds)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="guide-section">
            <div className="guide-section-title">Weight</div>
            <table className="guide-table">
              <tbody>
                <tr>
                  <td><code>@ 135</code></td>
                  <td>Same weight every set, defaults to lbs</td>
                </tr>
                <tr>
                  <td><code>@ 60kg</code></td>
                  <td>Explicit unit</td>
                </tr>
                <tr>
                  <td><code>@ [135,155,185]</code></td>
                  <td>Different weight each set</td>
                </tr>
                <tr>
                  <td><em>omitted</em></td>
                  <td>Bodyweight or plan placeholder</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="guide-section">
            <div className="guide-section-title">Full example</div>
            <pre className="guide-example">{`D: 06/15/25
N: Back and bis, felt good
// skipping deadlifts today
Front Squat 4x[5,5,3,1] @ [185,205,225,245]lbs
BB RDL 3x8 @ 135
S: Curls 3x[10,8,6] @ [40,45,50], Skull crushers 3x10 @ 60
Plank 3x45sec @ 25kg
Pull Ups 3x8`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DataToolbar({ onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

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
    <>
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
        <button className="btn-data" onClick={() => setGuideOpen(true)}>
          ? Guide
        </button>
        {status && <span className="data-toolbar-status">{status}</span>}
      </div>

      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </>
  )
}
