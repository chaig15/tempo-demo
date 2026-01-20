'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function OnRampSuccess() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const paymentIntent = searchParams.get('payment_intent')
    const redirectStatus = searchParams.get('redirect_status')

    if (!paymentIntent) {
      setStatus('error')
      setError('Missing payment information')
      return
    }

    if (redirectStatus !== 'succeeded') {
      setStatus('error')
      setError('Payment was not successful')
      return
    }

    // Confirm payment and mint tokens
    const confirmPayment = async () => {
      try {
        // Get the user's address from localStorage (set during wallet connect)
        const userAddress = localStorage.getItem('tempo_user_address')

        if (!userAddress) {
          setStatus('error')
          setError('Wallet not connected. Please return home and connect your wallet.')
          return
        }

        const response = await fetch('/api/onramp/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent,
            userAddress,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to mint tokens')
        }

        setTxHash(data.txHash)
        setStatus('success')
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    }

    confirmPayment()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Processing Payment</h1>
            <p className="text-gray-400">Minting your AcmeUSD tokens...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Purchase Complete!</h1>
            <p className="text-gray-400 mb-4">Your AcmeUSD tokens have been minted.</p>
            {txHash && (
              <a
                href={`https://explore.tempo.xyz/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block mb-6"
              >
                View on Explorer →
              </a>
            )}
            <Link
              href="/"
              className="inline-block w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-center"
            >
              Return Home
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Something Went Wrong</h1>
            <p className="text-red-400 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-center"
            >
              Return Home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
