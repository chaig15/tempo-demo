'use client'

import { useState } from 'react'

export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
            TESTNET
          </span>
          <span className="text-gray-400">
            Demo on Tempo Testnet. No real money.
          </span>
          <span className="text-amber-400">
            Test card: <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-xs">4242 4242 4242 4242</code>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
