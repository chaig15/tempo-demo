'use client'

import { useConnection } from 'wagmi'
import {
  WalletConnect,
  TokenBalance,
  TestnetBanner,
  OnRamp,
  OffRamp,
  TransactionHistory,
} from '@/components'
import { ACME_USD_ADDRESS } from '@/lib/wagmi'

export default function Home() {
  const { address } = useConnection()

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <TestnetBanner />

      {/* Header */}
      <header className="bg-[#0f0f0f] border-b border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <span className="font-semibold text-xl text-white">AcmeUSD</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {!address ? (
          // Not connected state
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Welcome to AcmeUSD
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-md mx-auto">
              Buy and sell AcmeUSD stablecoins on the Tempo network. Fast, secure, and fully backed.
            </p>
            <div className="flex justify-center">
              <WalletConnect />
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
              <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">Easy On-Ramp</h3>
                <p className="text-gray-400 text-sm">
                  Buy AcmeUSD with your credit card. Tokens delivered instantly to your wallet.
                </p>
              </div>

              <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">Simple Off-Ramp</h3>
                <p className="text-gray-400 text-sm">
                  Sell your AcmeUSD and receive USD directly to your bank account.
                </p>
              </div>

              <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">100% Backed</h3>
                <p className="text-gray-400 text-sm">
                  Every AcmeUSD is fully backed by USD deposits. Transparent and secure.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Connected state
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Your Balance</p>
                  {ACME_USD_ADDRESS ? (
                    <TokenBalance tokenAddress={ACME_USD_ADDRESS} tokenSymbol="AcmeUSD" />
                  ) : (
                    <p className="text-2xl font-bold text-white">$0.00</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">1 AcmeUSD = 1 USD</p>
                </div>
              </div>
            </div>

            {/* On/Off Ramp Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OnRamp />
              <OffRamp />
            </div>

            {/* Transaction History */}
            <TransactionHistory />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              AcmeUSD on Tempo Network
            </div>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="https://docs.tempo.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                Docs
              </a>
              <a
                href="https://explore.tempo.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                Explorer
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
