import { PrismaClient } from '@prisma/client';
import type { InvoiceSettings } from '../types/invoice';

export class InvoiceNumberGenerator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate next invoice number for a shop
   */
  async generateInvoiceNumber(shop: string): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      // Get invoice settings for the shop
      const settings = await tx.invoiceSettings.findUnique({
        where: { shop },
      });

      if (!settings) {
        throw new Error('Invoice settings not found for shop');
      }

      // Get current financial year and month
      const now = new Date();
      const { financialYear, month } = this.getCurrentPeriod(now);

      // Check if sequence needs to be reset
      const shouldReset = this.shouldResetSequence(
        settings.reset_frequency,
        settings.updated_at,
        now
      );

      let newSequence: number;
      if (shouldReset) {
        newSequence = 1;
      } else {
        newSequence = settings.current_sequence + 1;
      }

      // Generate invoice number
      const invoiceNumber = this.formatInvoiceNumber(
        settings.prefix,
        financialYear,
        month,
        newSequence
      );

      // Update sequence in database
      await tx.invoiceSettings.update({
        where: { shop },
        data: {
          current_sequence: newSequence,
          updated_at: now,
        },
      });

      return invoiceNumber;
    });
  }

  /**
   * Generate credit note number based on original invoice
   */
  async generateCreditNoteNumber(originalInvoiceNumber: string): Promise<string> {
    // Replace prefix with CN
    const parts = originalInvoiceNumber.split('-');
    if (parts.length >= 4) {
      parts[0] = 'CN';
      return parts.join('-');
    }
    
    // Fallback: prepend CN-
    return `CN-${originalInvoiceNumber}`;
  }

  /**
   * Check if invoice number already exists
   */
  async isInvoiceNumberExists(invoiceNumber: string): Promise<boolean> {
    const existing = await this.prisma.invoice.findUnique({
      where: { invoice_number: invoiceNumber },
    });
    
    return !!existing;
  }

  /**
   * Get current financial year and month
   */
  private getCurrentPeriod(date: Date): { financialYear: string; month: string } {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed

    // Indian financial year: April to March
    let financialYear: string;
    if (month >= 4) {
      // April to December: current year to next year
      financialYear = `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      // January to March: previous year to current year
      financialYear = `${year - 1}-${year.toString().slice(-2)}`;
    }

    return {
      financialYear,
      month: month.toString().padStart(2, '0'),
    };
  }

  /**
   * Check if sequence should be reset based on frequency
   */
  private shouldResetSequence(
    resetFrequency: string,
    lastUpdated: Date,
    currentDate: Date
  ): boolean {
    if (resetFrequency === 'NEVER') {
      return false;
    }

    const lastYear = lastUpdated.getFullYear();
    const lastMonth = lastUpdated.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    switch (resetFrequency) {
      case 'MONTHLY':
        return lastYear !== currentYear || lastMonth !== currentMonth;

      case 'QUARTERLY':
        const lastQuarter = Math.floor(lastMonth / 3);
        const currentQuarter = Math.floor(currentMonth / 3);
        return lastYear !== currentYear || lastQuarter !== currentQuarter;

      case 'YEARLY':
        // For financial year (April to March)
        const lastFinancialYear = this.getFinancialYear(lastUpdated);
        const currentFinancialYear = this.getFinancialYear(currentDate);
        return lastFinancialYear !== currentFinancialYear;

      default:
        return false;
    }
  }

  /**
   * Get financial year for a given date
   */
  private getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Format invoice number with prefix, year, month, and sequence
   */
  private formatInvoiceNumber(
    prefix: string,
    financialYear: string,
    month: string,
    sequence: number
  ): string {
    const paddedSequence = sequence.toString().padStart(5, '0');
    return `${prefix}-${financialYear}-${month}-${paddedSequence}`;
  }

  /**
   * Parse invoice number to extract components
   */
  static parseInvoiceNumber(invoiceNumber: string): {
    prefix: string;
    financialYear: string;
    month: string;
    sequence: number;
  } | null {
    const parts = invoiceNumber.split('-');
    
    if (parts.length !== 4) {
      return null;
    }

    const [prefix, financialYear, month, sequenceStr] = parts;
    const sequence = parseInt(sequenceStr, 10);

    if (isNaN(sequence)) {
      return null;
    }

    return {
      prefix,
      financialYear,
      month,
      sequence,
    };
  }

  /**
   * Get next expected invoice number (for preview)
   */
  async getNextInvoiceNumber(shop: string): Promise<string> {
    const settings = await this.prisma.invoiceSettings.findUnique({
      where: { shop },
    });

    if (!settings) {
      throw new Error('Invoice settings not found for shop');
    }

    const now = new Date();
    const { financialYear, month } = this.getCurrentPeriod(now);

    const shouldReset = this.shouldResetSequence(
      settings.reset_frequency,
      settings.updated_at,
      now
    );

    const nextSequence = shouldReset ? 1 : settings.current_sequence + 1;

    return this.formatInvoiceNumber(
      settings.prefix,
      financialYear,
      month,
      nextSequence
    );
  }

  /**
   * Initialize invoice settings for a new shop
   */
  async initializeInvoiceSettings(
    shop: string,
    settings: Partial<InvoiceSettings> = {}
  ): Promise<void> {
    const defaultSettings: InvoiceSettings = {
      prefix: 'INV',
      starting_number: 1,
      current_sequence: 0,
      reset_frequency: 'YEARLY',
      template_type: 'CLASSIC',
      due_days: 30,
      show_bank_details: true,
      show_signature: true,
      show_logo: true,
      show_hsn: true,
      show_customer_gst: true,
      auto_generate: false,
      auto_email: false,
      ...settings,
    };

    await this.prisma.invoiceSettings.upsert({
      where: { shop },
      update: defaultSettings,
      create: {
        shop,
        ...defaultSettings,
      },
    });
  }

  /**
   * Update invoice settings
   */
  async updateInvoiceSettings(
    shop: string,
    updates: Partial<InvoiceSettings>
  ): Promise<void> {
    await this.prisma.invoiceSettings.update({
      where: { shop },
      data: {
        ...updates,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get invoice statistics for a shop
   */
  async getInvoiceStats(shop: string): Promise<{
    total_invoices: number;
    this_month_invoices: number;
    current_sequence: number;
    next_invoice_number: string;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalInvoices, thisMonthInvoices, settings] = await Promise.all([
      this.prisma.invoice.count({
        where: { shop },
      }),
      this.prisma.invoice.count({
        where: {
          shop,
          created_at: {
            gte: startOfMonth,
          },
        },
      }),
      this.prisma.invoiceSettings.findUnique({
        where: { shop },
      }),
    ]);

    const nextInvoiceNumber = await this.getNextInvoiceNumber(shop);

    return {
      total_invoices: totalInvoices,
      this_month_invoices: thisMonthInvoices,
      current_sequence: settings?.current_sequence || 0,
      next_invoice_number: nextInvoiceNumber,
    };
  }
}