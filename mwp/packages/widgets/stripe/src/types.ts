import type { MCPPrompt, MCPResource, MCPTool } from '@mwp/core';

export type StripeSegment = 'payments' | 'billing' | 'customers' | 'products' | 'webhooks';

export interface StripePaymentFlowStage {
  label: string;
  timestamp?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  details?: string;
}

export interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  customerId?: string;
  description?: string;
  status: string;
  stages?: StripePaymentFlowStage[];
  methodType?: string;
}

export interface StripeCustomer {
  id: string;
  name?: string;
  email?: string;
  createdAt: string;
  country?: string;
  mrr?: number;
  subscriptionCount?: number;
  delinquent?: boolean;
}

export interface StripeSubscriptionUsage {
  periodStart: string;
  periodEnd: string;
  quantity?: number;
  usage?: number;
  usageType?: 'metered' | 'licensed';
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  planName?: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  usage?: StripeSubscriptionUsage;
  renewalDate?: string;
}

export interface StripeInvoice {
  id: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  customerId: string;
  createdAt: string;
  dueDate?: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  requestId?: string;
  status?: 'pending' | 'delivered' | 'failed';
  payloadPreview?: string;
}

export interface StripeDashboardMetrics {
  totalMRR: number;
  activeSubscriptions: number;
  churnRate: number;
  paymentSuccessRate: number;
}

export interface StripeFilters {
  customerSearch: string;
  paymentStatus: string;
  subscriptionStatus: string;
}

export interface StripeState {
  loading: boolean;
  error: string | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  segment: StripeSegment;
  lastUpdated?: Date;
  payments: StripePayment[];
  invoices: StripeInvoice[];
  customers: StripeCustomer[];
  subscriptions: StripeSubscription[];
  webhookEvents: StripeWebhookEvent[];
  metrics: StripeDashboardMetrics;
  filters: StripeFilters;
  selectedPayment?: StripePayment | null;
  selectedCustomer?: StripeCustomer | null;
  selectedSubscription?: StripeSubscription | null;
}
