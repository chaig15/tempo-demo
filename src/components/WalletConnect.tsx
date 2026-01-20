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

  // Save address to localStorage for redirect flows (e.g., Amazon Pay)
  useEffect(() => {
    if (address) {
      localStorage.setItem('tempo_user_address', address)
    } else {
      localStorage.removeItem('tempo_user_address')
    }
  }, [address])

  // Show loading state only when actually connecting (not during SSR/hydration)
  if (!mounted || isReconnecting || (isConnecting && !address)) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] rounded-lg">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">{mounted ? 'Connecting...' : 'Loading...'}</span>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] rounded-lg">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">Connecting...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-red-400 text-sm">Error: {error.message}</div>
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
        <a
          href={`https://explore.tempo.xyz/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors"
          title={address}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-mono text-green-400">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </a>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
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
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
      >
        Sign Up
      </button>
      <button
        onClick={() => connect({ connector })}
        className="px-4 py-2 border border-[#3a3a3a] text-gray-300 rounded-lg hover:bg-[#2a2a2a] transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}
