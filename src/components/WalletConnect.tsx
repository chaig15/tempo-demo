'use client'

import { useConnection, useConnect, useConnectors, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'

export function WalletConnect() {
  const { address, isConnecting, isReconnecting } = useConnection()
  const { connect, isPending, error } = useConnect()
  const [connector] = useConnectors()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading state only when actually connecting (not during SSR/hydration)
  if (!mounted || isReconnecting || (isConnecting && !address)) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600">{mounted ? 'Connecting...' : 'Loading...'}</span>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600">Connecting...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-red-500 text-sm">Error: {error.message}</div>
        <div className="flex gap-2">
          <button
            onClick={() => connect({ connector, capabilities: { type: 'sign-up' } })}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => connect({ connector, capabilities: { type: 'sign-up' } })}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Sign Up
      </button>
      <button
        onClick={() => connect({ connector })}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}
