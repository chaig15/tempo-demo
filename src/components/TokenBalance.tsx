'use client'

import { useConnection } from 'wagmi'
import { Hooks } from 'wagmi/tempo'
import { formatUnits } from 'viem'
import { ACME_USD_ADDRESS, ALPHA_USD_ADDRESS } from '@/lib/wagmi'

interface TokenBalanceProps {
  tokenAddress?: `0x${string}`
  tokenSymbol?: string
  showRefresh?: boolean
}

export function TokenBalance({
  tokenAddress = ACME_USD_ADDRESS,
  tokenSymbol = 'AcmeUSD',
  showRefresh = true,
}: TokenBalanceProps) {
  const { address } = useConnection()

  const { data: balance, isLoading, refetch } = Hooks.token.useGetBalance({
    token: tokenAddress,
    account: address,
  })

  const { data: metadata } = Hooks.token.useGetMetadata({
    token: tokenAddress,
  })

  if (!address) {
    return null
  }

  if (!tokenAddress) {
    return (
      <div className="text-sm text-gray-500">
        Token not configured
      </div>
    )
  }

  const decimals = metadata?.decimals ?? 6
  const formattedBalance = balance ? formatUnits(balance, decimals) : '0'
  const displayBalance = parseFloat(formattedBalance).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="flex items-center gap-2">
      <div className="text-2xl font-bold text-white">
        {isLoading ? (
          <span className="text-gray-500">Loading...</span>
        ) : (
          <span>${displayBalance}</span>
        )}
      </div>
      <span className="text-sm text-gray-400">{tokenSymbol}</span>
      {showRefresh && (
        <button
          onClick={() => refetch()}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          title="Refresh balance"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function MultiTokenBalance() {
  const { address } = useConnection()

  if (!address) {
    return null
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-sm font-medium text-gray-500 mb-3">Your Balances</h3>
      <div className="space-y-3">
        {ACME_USD_ADDRESS && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">AcmeUSD</span>
            <TokenBalance tokenAddress={ACME_USD_ADDRESS} tokenSymbol="ACME" showRefresh={false} />
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">AlphaUSD</span>
          <TokenBalance tokenAddress={ALPHA_USD_ADDRESS} tokenSymbol="aUSD" showRefresh={false} />
        </div>
      </div>
    </div>
  )
}
