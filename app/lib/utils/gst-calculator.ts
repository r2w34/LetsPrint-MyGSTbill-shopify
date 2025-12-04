import type {
  ShopifyOrder,
  ShopifyLineItem,
  GSTCalculation,
  InvoiceLineItemCalculation,
  InvoiceTotals,
  TaxSummary,
  HSNMapping,
  BusinessDetails,
} from '../types/invoice';

// Indian state codes mapping
const INDIAN_STATES = {
  'ANDHRA PRADESH': '37',
  'ARUNACHAL PRADESH': '12',
  'ASSAM': '18',
  'BIHAR': '10',
  'CHHATTISGARH': '22',
  'GOA': '30',
  'GUJARAT': '24',
  'HARYANA': '06',
  'HIMACHAL PRADESH': '02',
  'JHARKHAND': '20',
  'KARNATAKA': '29',
  'KERALA': '32',
  'MADHYA PRADESH': '23',
  'MAHARASHTRA': '27',
  'MANIPUR': '14',
  'MEGHALAYA': '17',
  'MIZORAM': '15',
  'NAGALAND': '13',
  'ODISHA': '21',
  'PUNJAB': '03',
  'RAJASTHAN': '08',
  'SIKKIM': '11',
  'TAMIL NADU': '33',
  'TELANGANA': '36',
  'TRIPURA': '16',
  'UTTAR PRADESH': '09',
  'UTTARAKHAND': '05',
  'WEST BENGAL': '19',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'CHANDIGARH': '04',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': '26',
  'DELHI': '07',
  'JAMMU AND KASHMIR': '01',
  'LADAKH': '38',
  'LAKSHADWEEP': '31',
  'PUDUCHERRY': '34',
};

export class GSTCalculator {
  /**
   * Determine transaction type based on seller and buyer states
   */
  static determineTransactionType(
    sellerState: string,
    buyerState: string
  ): 'INTRA_STATE' | 'INTER_STATE' {
    const normalizedSellerState = sellerState.toUpperCase().trim();
    const normalizedBuyerState = buyerState.toUpperCase().trim();
    
    return normalizedSellerState === normalizedBuyerState ? 'INTRA_STATE' : 'INTER_STATE';
  }

  /**
   * Get state code from state name
   */
  static getStateCode(stateName: string): string {
    const normalizedState = stateName.toUpperCase().trim();
    return INDIAN_STATES[normalizedState as keyof typeof INDIAN_STATES] || '00';
  }

  /**
   * Calculate GST for a single line item
   */
  static calculateLineItemGST(
    lineItem: ShopifyLineItem,
    gstRate: number,
    hsnCode: string,
    transactionType: 'INTRA_STATE' | 'INTER_STATE',
    priceIncludesTax: boolean = true
  ): InvoiceLineItemCalculation {
    const quantity = lineItem.quantity;
    const unitPrice = parseFloat(lineItem.price);
    const discount = parseFloat(lineItem.total_discount) || 0;
    
    // Calculate line price after discount
    const linePrice = (unitPrice * quantity) - discount;
    
    // Calculate taxable value
    let taxableValue: number;
    if (priceIncludesTax) {
      // Reverse calculation: price includes tax
      taxableValue = linePrice / (1 + gstRate / 100);
    } else {
      // Forward calculation: price excludes tax
      taxableValue = linePrice;
    }

    // Calculate tax components based on transaction type
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (transactionType === 'INTRA_STATE') {
      const halfRate = gstRate / 2;
      cgstAmount = (taxableValue * halfRate) / 100;
      sgstAmount = (taxableValue * halfRate) / 100;
      igstAmount = 0;
    } else {
      cgstAmount = 0;
      sgstAmount = 0;
      igstAmount = (taxableValue * gstRate) / 100;
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const totalAmount = taxableValue + totalTax;

    return {
      product_id: lineItem.product_id,
      variant_id: lineItem.variant_id,
      title: lineItem.title,
      sku: lineItem.sku,
      quantity,
      unit_price: unitPrice,
      discount,
      hsn_code: hsnCode,
      gst_rate: gstRate,
      taxable_value: Math.round(taxableValue * 100) / 100,
      cgst_amount: Math.round(cgstAmount * 100) / 100,
      sgst_amount: Math.round(sgstAmount * 100) / 100,
      igst_amount: Math.round(igstAmount * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Calculate shipping GST (standard 18% rate)
   */
  static calculateShippingGST(
    shippingCharge: number,
    transactionType: 'INTRA_STATE' | 'INTER_STATE',
    priceIncludesTax: boolean = true
  ): GSTCalculation {
    const gstRate = 18; // Standard GST rate for shipping in India
    
    if (shippingCharge <= 0) {
      return {
        taxable_value: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_tax: 0,
        gst_rate: 0,
        hsn_code: '996511', // HSN code for freight services
      };
    }

    // Calculate taxable value
    let taxableValue: number;
    if (priceIncludesTax) {
      taxableValue = shippingCharge / 1.18; // Reverse calculation
    } else {
      taxableValue = shippingCharge;
    }

    // Calculate tax components
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (transactionType === 'INTRA_STATE') {
      cgstAmount = (taxableValue * 9) / 100; // 9% CGST
      sgstAmount = (taxableValue * 9) / 100; // 9% SGST
    } else {
      igstAmount = (taxableValue * 18) / 100; // 18% IGST
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount;

    return {
      taxable_value: Math.round(taxableValue * 100) / 100,
      cgst_amount: Math.round(cgstAmount * 100) / 100,
      sgst_amount: Math.round(sgstAmount * 100) / 100,
      igst_amount: Math.round(igstAmount * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      gst_rate: gstRate,
      hsn_code: '996511',
    };
  }

  /**
   * Calculate invoice totals from line items and shipping
   */
  static calculateInvoiceTotals(
    lineItems: InvoiceLineItemCalculation[],
    shippingGST: GSTCalculation,
    shippingCharge: number,
    discountAmount: number = 0
  ): InvoiceTotals {
    // Sum up line item totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.taxable_value, 0);
    const totalCGST = lineItems.reduce((sum, item) => sum + item.cgst_amount, 0) + shippingGST.cgst_amount;
    const totalSGST = lineItems.reduce((sum, item) => sum + item.sgst_amount, 0) + shippingGST.sgst_amount;
    const totalIGST = lineItems.reduce((sum, item) => sum + item.igst_amount, 0) + shippingGST.igst_amount;
    
    const totalTax = totalCGST + totalSGST + totalIGST;
    const totalBeforeRounding = subtotal + totalTax + shippingCharge - discountAmount;
    
    // Calculate round off (to nearest rupee)
    const roundedTotal = Math.round(totalBeforeRounding);
    const roundOff = roundedTotal - totalBeforeRounding;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      total_cgst: Math.round(totalCGST * 100) / 100,
      total_sgst: Math.round(totalSGST * 100) / 100,
      total_igst: Math.round(totalIGST * 100) / 100,
      shipping_charge: Math.round(shippingCharge * 100) / 100,
      shipping_tax: Math.round(shippingGST.total_tax * 100) / 100,
      discount_amount: Math.round(discountAmount * 100) / 100,
      round_off: Math.round(roundOff * 100) / 100,
      grand_total: roundedTotal,
    };
  }

  /**
   * Generate tax summary grouped by GST rates
   */
  static generateTaxSummary(lineItems: InvoiceLineItemCalculation[]): TaxSummary[] {
    const summaryMap = new Map<number, TaxSummary>();

    lineItems.forEach(item => {
      const rate = item.gst_rate;
      
      if (summaryMap.has(rate)) {
        const existing = summaryMap.get(rate)!;
        existing.taxable_value += item.taxable_value;
        existing.cgst_amount += item.cgst_amount;
        existing.sgst_amount += item.sgst_amount;
        existing.igst_amount += item.igst_amount;
        existing.total_tax += item.total_tax;
      } else {
        summaryMap.set(rate, {
          gst_rate: rate,
          taxable_value: item.taxable_value,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_tax: item.total_tax,
        });
      }
    });

    // Convert to array and sort by GST rate
    return Array.from(summaryMap.values())
      .map(summary => ({
        ...summary,
        taxable_value: Math.round(summary.taxable_value * 100) / 100,
        cgst_amount: Math.round(summary.cgst_amount * 100) / 100,
        sgst_amount: Math.round(summary.sgst_amount * 100) / 100,
        igst_amount: Math.round(summary.igst_amount * 100) / 100,
        total_tax: Math.round(summary.total_tax * 100) / 100,
      }))
      .sort((a, b) => a.gst_rate - b.gst_rate);
  }

  /**
   * Get HSN code and GST rate for a product
   */
  static getProductHSN(
    productId: string,
    collectionIds: string[],
    hsnMappings: HSNMapping[],
    defaultHSN: string = '99999',
    defaultGSTRate: number = 18
  ): { hsn_code: string; gst_rate: number } {
    // First, check for direct product mapping
    const productMapping = hsnMappings.find(mapping => mapping.product_id === productId);
    if (productMapping) {
      return {
        hsn_code: productMapping.hsn_code,
        gst_rate: productMapping.gst_rate,
      };
    }

    // Then, check for collection mapping
    for (const collectionId of collectionIds) {
      const collectionMapping = hsnMappings.find(mapping => mapping.collection_id === collectionId);
      if (collectionMapping) {
        return {
          hsn_code: collectionMapping.hsn_code,
          gst_rate: collectionMapping.gst_rate,
        };
      }
    }

    // Return default values
    return {
      hsn_code: defaultHSN,
      gst_rate: defaultGSTRate,
    };
  }

  /**
   * Validate GST calculations
   */
  static validateCalculations(
    lineItems: InvoiceLineItemCalculation[],
    totals: InvoiceTotals
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if CGST + SGST and IGST are not both present
    const hasCGSTSGST = totals.total_cgst > 0 || totals.total_sgst > 0;
    const hasIGST = totals.total_igst > 0;

    if (hasCGSTSGST && hasIGST) {
      errors.push('Invoice cannot have both CGST/SGST and IGST');
    }

    // Check if round off is within acceptable range (-1 to +1)
    if (Math.abs(totals.round_off) > 1) {
      errors.push('Round off amount exceeds acceptable range (±1 rupee)');
    }

    // Check if all amounts are positive
    lineItems.forEach((item, index) => {
      if (item.taxable_value < 0) {
        errors.push(`Line item ${index + 1} has negative taxable value`);
      }
      if (item.total_tax < 0) {
        errors.push(`Line item ${index + 1} has negative tax amount`);
      }
    });

    // Check if GST rates are valid (0, 5, 12, 18, 28)
    const validGSTRates = [0, 5, 12, 18, 28];
    lineItems.forEach((item, index) => {
      if (!validGSTRates.includes(item.gst_rate)) {
        errors.push(`Line item ${index + 1} has invalid GST rate: ${item.gst_rate}%`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Utility function to convert number to words (for invoice total)
 */
export function numberToWords(amount: number): string {
  const toWords = require('number-to-words');
  
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let result = toWords.toWords(rupees).toUpperCase() + ' RUPEES';
  
  if (paise > 0) {
    result += ' AND ' + toWords.toWords(paise).toUpperCase() + ' PAISE';
  }
  
  result += ' ONLY';
  
  return result;
}

/**
 * Utility function to format currency
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Utility function to format date for invoice
 */
export function formatInvoiceDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}