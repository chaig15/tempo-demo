'use client'

import { useState } from 'react'
import { useConnection } from 'wagmi'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'

interface OnRampFormProps {
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onCancel: () => void
}

function OnRampForm({ amount, onSuccess, onCancel }: OnRampFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/onramp/success`,
      },
      redirect: 'if_required',
    })

    if (submitError) {
      setError(submitError.message ?? 'Payment failed')
      setIsProcessing(false)
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="text-sm text-blue-400">You will receive</div>
        <div className="text-2xl font-bold text-white">
          ${amount.toFixed(2)} AcmeUSD
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-[#3a3a3a] text-gray-300 rounded-lg hover:bg-[#2a2a2a] transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}

export function OnRamp() {
  const { address } = useConnection()
  const [amount, setAmount] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<{ txHash: string; amount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInitiate = async () => {
    if (!address || !amount) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onramp/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          amountUsd: parseFloat(amount),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate payment')
      }

      setClientSecret(data.clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onramp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          userAddress: address,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mint tokens')
      }

      setSuccess({
        txHash: data.txHash,
        amount: parseFloat(amount),
      })
      setClientSecret(null)
      setAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mint tokens')
    } finally {
      setIsLoading(false)
    }
  }

  if (!address) {
    return (
      <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        <h2 className="text-xl font-semibold text-white mb-4">Buy AcmeUSD</h2>
        <p className="text-gray-500">Connect your wallet to buy AcmeUSD</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Purchase Complete!</h2>
          <p className="text-gray-400 mb-4">
            You received ${success.amount.toFixed(2)} AcmeUSD
          </p>
          <a
            href={`https://explore.tempo.xyz/tx/${success.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View on Explorer →
          </a>
          <button
            onClick={() => setSuccess(null)}
            className="mt-4 w-full px-4 py-2 border border-[#3a3a3a] text-gray-300 rounded-lg hover:bg-[#2a2a2a]"
          >
            Buy More
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
      <h2 className="text-xl font-semibold text-white mb-4">Buy AcmeUSD</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {clientSecret && stripePromise ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: '#1a1a1a',
                colorText: '#ffffff',
                colorTextSecondary: '#888888',
                borderRadius: '8px',
              },
            },
          }}
        >
          <OnRampForm
            amount={parseFloat(amount)}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setClientSecret(null)}
          />
        </Elements>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 bg-[#0f0f0f] border border-[#3a3a3a] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {[10, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset.toString())}
                className="flex-1 px-3 py-2 border border-[#3a3a3a] rounded-lg hover:bg-[#2a2a2a] text-sm text-gray-300"
              >
                ${preset}
              </button>
            ))}
          </div>

          <button
            onClick={handleInitiate}
            disabled={!amount || parseFloat(amount) <= 0 || isLoading}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Loading...' : 'Continue to Payment'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            1 USD = 1 AcmeUSD
          </p>
        </div>
      )}
    </div>
  )
}
