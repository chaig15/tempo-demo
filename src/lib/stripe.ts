import { loadStripe } from '@stripe/stripe-js'

// Stripe publishable key (test mode)
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

if (!stripePublishableKey) {
  console.warn('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY - Stripe will not work')
}

export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null

// Test card numbers for demo
export const TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
}
