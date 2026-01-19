'use client'

import { useState } from 'react'
import { useConnection } from 'wagmi'
import { Hooks } from 'wagmi/tempo'
import { parseUnits, formatUnits } from 'viem'
import { ACME_USD_ADDRESS, ACME_TREASURY_ADDRESS } from '@/lib/wagmi'

export function OffRamp() {
  const { address } = useConnection()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'success'>('input')
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ burnTxHash: string; amount: number } | null>(null)

  const { data: balance, refetch: refetchBalance } = Hooks.token.useGetBalance({
    token: ACME_USD_ADDRESS,
    account: address,
  })

  const transfer = Hooks.token.useTransferSync()

  const maxAmount = balance ? parseFloat(formatUnits(balance, 6)) : 0

  const handleInitiate = async () => {
    if (!address || !amount || !ACME_USD_ADDRESS) return

    setError(null)

    try {
      const response = await fetch('/api/offramp/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          amountAcmeUsd: parseUnits(amount, 6).toString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate withdrawal')
      }

      setWithdrawalId(data.withdrawalId)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleTransfer = async () => {
    if (!address || !ACME_USD_ADDRESS || !ACME_TREASURY_ADDRESS || !withdrawalId) return

    setStep('processing')
    setError(null)

    try {
      // Transfer tokens to treasury (user pays fee in AcmeUSD)
      const transferResult = await transfer.mutateAsync({
        token: ACME_USD_ADDRESS,
        to: ACME_TREASURY_ADDRESS,
        amount: parseUnits(amount, 6),
        feeToken: ACME_USD_ADDRESS,
        memo: `0x${Buffer.from(withdrawalId).toString('hex').padEnd(64, '0')}` as `0x${string}`,
      })

      // Confirm with backend
      const response = await fetch('/api/offramp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId,
          transferTxHash: transferResult.receipt.transactionHash,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process withdrawal')
      }

      setResult({
        burnTxHash: data.burnTxHash,
        amount: parseFloat(amount),
      })
      setStep('success')
      refetchBalance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setStep('confirm')
    }
  }

  const resetForm = () => {
    setAmount('')
    setStep('input')
    setWithdrawalId(null)
    setResult(null)
    setError(null)
  }

  if (!address) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">Sell AcmeUSD</h2>
        <p className="text-gray-500">Connect your wallet to sell AcmeUSD</p>
      </div>
    )
  }

  if (!ACME_USD_ADDRESS || !ACME_TREASURY_ADDRESS) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">Sell AcmeUSD</h2>
        <p className="text-gray-500">AcmeUSD token not configured</p>
      </div>
    )
  }

  if (step === 'success' && result) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Withdrawal Complete!</h2>
          <p className="text-gray-600 mb-2">
            ${result.amount.toFixed(2)} AcmeUSD has been burned
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Your USD payout has been queued (simulated)
          </p>
          <a
            href={`https://explore.tempo.xyz/tx/${result.burnTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            View on Explorer →
          </a>
          <button
            onClick={resetForm}
            className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Make Another Withdrawal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-semibold mb-4">Sell AcmeUSD</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Amount (AcmeUSD)
              </label>
              <button
                onClick={() => setAmount(maxAmount.toString())}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                Max: ${maxAmount.toFixed(2)}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                max={maxAmount}
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">You will receive (simulated)</div>
            <div className="text-xl font-bold text-gray-900">
              ${amount ? parseFloat(amount).toFixed(2) : '0.00'} USD
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Sent to your payment method (demo)
            </div>
          </div>

          <button
            onClick={handleInitiate}
            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium text-amber-800 mb-2">Confirm Withdrawal</h3>
            <p className="text-sm text-amber-700">
              You are about to send <strong>${parseFloat(amount).toFixed(2)} AcmeUSD</strong> to ACME treasury.
              This will be burned and you'll receive USD to your payment method (simulated).
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount</span>
              <span className="font-medium">${parseFloat(amount).toFixed(2)} AcmeUSD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Network fee</span>
              <span className="font-medium">~$0.001 AcmeUSD</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">You receive</span>
              <span className="font-bold">${parseFloat(amount).toFixed(2)} USD</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Sign & Send
            </button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Processing withdrawal...</p>
          <p className="text-sm text-gray-500">Please confirm the transaction in your wallet</p>
        </div>
      )}
    </div>
  )
}
