import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set. Billing features will not work.');
}

// Lazy initialization to avoid build errors when STRIPE_SECRET_KEY is not set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// For backward compatibility - but will throw at runtime if used without key
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : (null as unknown as Stripe);

// Price IDs (configure in Stripe Dashboard)
export const PRICE_IDS = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || '',
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
  },
  enterprise: {
    monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
    annual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID || '',
  },
};

// Credit pack price IDs
export const CREDIT_PACK_PRICES = {
  small: process.env.STRIPE_CREDIT_PACK_SMALL_PRICE_ID || '',   // 100 credits - $10
  medium: process.env.STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID || '', // 500 credits - $45
  large: process.env.STRIPE_CREDIT_PACK_LARGE_PRICE_ID || '',   // 2000 credits - $160
};

// Credit amounts per pack
export const CREDIT_PACK_AMOUNTS = {
  small: 100,
  medium: 500,
  large: 2000,
};

export type PlanType = 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type CreditPackSize = 'small' | 'medium' | 'large';
