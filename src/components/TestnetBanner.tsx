'use client'

import { useState } from 'react'

export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
            TESTNET
          </span>
          <span>
            This is a demo on Tempo Testnet. No real money is involved.
          </span>
          <span className="text-amber-600">
            Test card: <code className="bg-amber-100 px-1 rounded">4242 4242 4242 4242</code>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
