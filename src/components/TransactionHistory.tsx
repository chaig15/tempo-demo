'use client'

import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'

interface Transaction {
  id: string
  type: 'onramp' | 'offramp'
  status: string
  amountUsd: number
  amountToken: string
  mintTxHash?: string
  burnTxHash?: string
  transferTxHash?: string
  createdAt: string
}

export function TransactionHistory() {
  const { address } = useConnection()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) return

    const fetchTransactions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/transactions?userAddress=${address}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch transactions')
        }

        setTransactions(data.transactions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [address])

  if (!address) {
    return null
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      processing: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    }

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status}
      </span>
    )
  }

  const getTxHash = (tx: Transaction) => {
    if (tx.type === 'onramp') return tx.mintTxHash
    return tx.burnTxHash || tx.transferTxHash
  }

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">
          Loading transactions...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-400">
          {error}
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No transactions yet
        </div>
      ) : (
        <div className="divide-y divide-[#2a2a2a]">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'onramp' ? 'bg-green-500/20' : 'bg-blue-500/20'
                }`}>
                  {tx.type === 'onramp' ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">
                    {tx.type === 'onramp' ? 'Bought' : 'Sold'} AcmeUSD
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`font-medium ${tx.type === 'onramp' ? 'text-green-400' : 'text-white'}`}>
                  {tx.type === 'onramp' ? '+' : '-'}${tx.amountUsd.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  {getStatusBadge(tx.status)}
                  {getTxHash(tx) && (
                    <a
                      href={`https://explore.tempo.xyz/tx/${getTxHash(tx)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                      title="View on Explorer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
