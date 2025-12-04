export interface Address {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  customer: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  billing_address: Address;
  shipping_address: Address;
  line_items: ShopifyLineItem[];
  shipping_lines: ShopifyShippingLine[];
  tax_lines: ShopifyTaxLine[];
  discount_codes: ShopifyDiscountCode[];
  tags: string;
}

export interface ShopifyLineItem {
  id: string;
  product_id: string;
  variant_id: string;
  title: string;
  name: string;
  sku: string;
  quantity: number;
  price: string;
  total_discount: string;
  fulfillment_status: string;
  tax_lines: ShopifyTaxLine[];
}

export interface ShopifyShippingLine {
  id: string;
  title: string;
  price: string;
  code: string;
  tax_lines: ShopifyTaxLine[];
}

export interface ShopifyTaxLine {
  title: string;
  price: string;
  rate: number;
}

export interface ShopifyDiscountCode {
  code: string;
  amount: string;
  type: string;
}

export interface GSTCalculation {
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  gst_rate: number;
  hsn_code: string;
}

export interface InvoiceLineItemCalculation extends GSTCalculation {
  product_id: string;
  variant_id?: string;
  title: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_amount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  shipping_charge: number;
  shipping_tax: number;
  discount_amount: number;
  round_off: number;
  grand_total: number;
}

export interface TaxSummary {
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  order_details: ShopifyOrder;
  seller_details: BusinessDetails;
  buyer_details: CustomerDetails;
  line_items: InvoiceLineItemCalculation[];
  totals: InvoiceTotals;
  tax_summary: TaxSummary[];
  transaction_type: 'INTRA_STATE' | 'INTER_STATE';
}

export interface BusinessDetails {
  legal_name: string;
  trading_name?: string;
  gstin: string;
  state_code: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pin_code: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  bank_details?: BankDetails;
  logo_url?: string;
  signature_url?: string;
  signatory_name?: string;
  signatory_designation?: string;
}

export interface BankDetails {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  account_type: string;
}

export interface CustomerDetails {
  name: string;
  email: string;
  phone?: string;
  billing_address: Address;
  shipping_address: Address;
  gstin?: string;
}

export interface HSNMapping {
  product_id?: string;
  collection_id?: string;
  hsn_code: string;
  gst_rate: number;
}

export interface InvoiceSettings {
  prefix: string;
  starting_number: number;
  current_sequence: number;
  reset_frequency: 'NEVER' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  template_type: 'CLASSIC' | 'MODERN' | 'MINIMAL' | 'DETAILED';
  due_days: number;
  show_bank_details: boolean;
  show_signature: boolean;
  show_logo: boolean;
  show_hsn: boolean;
  show_customer_gst: boolean;
  terms_and_conditions?: string;
  notes?: string;
  payment_instructions?: string;
  auto_generate: boolean;
  auto_email: boolean;
}

export interface ShippingLabelData {
  label_number: string;
  order_details: ShopifyOrder;
  courier_partner: string;
  awb_number?: string;
  customer_details: CustomerDetails;
  return_address: Address;
  product_count: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  is_cod: boolean;
  cod_amount?: number;
  label_size: 'A4' | 'A5' | 'THERMAL_4X6';
}

export interface CourierPartner {
  id: string;
  name: string;
  logo_url: string;
  tracking_url_template: string;
  supported_services: string[];
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  invoice_limit: number;
  label_limit: number;
  features: string[];
  trial_days?: number;
}