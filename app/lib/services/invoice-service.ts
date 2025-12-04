import { PrismaClient } from '@prisma/client';
import type {
  ShopifyOrder,
  InvoiceData,
  InvoiceLineItemCalculation,
  BusinessDetails,
  CustomerDetails,
  HSNMapping,
  InvoiceTotals,
  TaxSummary,
} from '../types/invoice';
import { GSTCalculator } from '../utils/gst-calculator';
import { InvoiceNumberGenerator } from '../utils/invoice-number-generator';
import { PDFGenerator } from './pdf-generator';

export class InvoiceService {
  private prisma: PrismaClient;
  private invoiceNumberGenerator: InvoiceNumberGenerator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.invoiceNumberGenerator = new InvoiceNumberGenerator(prisma);
  }

  /**
   * Generate invoice for a Shopify order
   */
  async generateInvoice(
    shop: string,
    orderData: ShopifyOrder,
    options: {
      warehouseId?: string;
      templateType?: string;
      autoEmail?: boolean;
    } = {}
  ): Promise<{ invoiceId: string; pdfBuffer: Buffer }> {
    // Check if invoice already exists
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        shop,
        order_id: orderData.id,
      },
    });

    if (existingInvoice) {
      throw new Error(`Invoice already exists for order ${orderData.name}`);
    }

    // Get business settings
    const businessSettings = await this.prisma.businessSettings.findUnique({
      where: { shop },
    });

    if (!businessSettings) {
      throw new Error('Business settings not configured. Please complete setup first.');
    }

    // Get invoice settings
    const invoiceSettings = await this.prisma.invoiceSettings.findUnique({
      where: { shop },
    });

    if (!invoiceSettings) {
      throw new Error('Invoice settings not configured.');
    }

    // Get HSN mappings
    const hsnMappings = await this.prisma.productHSNMapping.findMany({
      where: { shop },
    });

    // Get warehouse details (if specified)
    let warehouseDetails = null;
    if (options.warehouseId) {
      warehouseDetails = await this.prisma.warehouse.findFirst({
        where: {
          shop,
          id: options.warehouseId,
        },
      });
    }

    // Use default warehouse if none specified
    if (!warehouseDetails) {
      warehouseDetails = await this.prisma.warehouse.findFirst({
        where: {
          shop,
          is_default: true,
        },
      });
    }

    // Generate invoice data
    const invoiceData = await this.buildInvoiceData(
      orderData,
      businessSettings,
      warehouseDetails,
      hsnMappings,
      invoiceSettings
    );

    // Generate PDF
    const pdfBuffer = await PDFGenerator.generateInvoicePDF(
      invoiceData,
      options.templateType || invoiceSettings.template_type
    );

    // Save invoice to database
    const invoice = await this.saveInvoiceToDatabase(
      shop,
      invoiceData,
      orderData,
      pdfBuffer,
      options.warehouseId
    );

    // Send email if requested
    if (options.autoEmail && invoiceSettings.auto_email) {
      await this.sendInvoiceEmail(invoice.id, invoiceData.buyer_details.email);
    }

    // Log activity
    await this.logActivity(shop, 'invoice', invoice.id, 'created');

    return {
      invoiceId: invoice.id,
      pdfBuffer,
    };
  }

  /**
   * Build invoice data from order and settings
   */
  private async buildInvoiceData(
    orderData: ShopifyOrder,
    businessSettings: any,
    warehouseDetails: any,
    hsnMappings: HSNMapping[],
    invoiceSettings: any
  ): Promise<InvoiceData> {
    // Generate invoice number
    const invoiceNumber = await this.invoiceNumberGenerator.generateInvoiceNumber(
      businessSettings.shop
    );

    // Determine transaction type
    const sellerState = warehouseDetails?.state || businessSettings.state;
    const buyerState = orderData.shipping_address.province;
    const transactionType = GSTCalculator.determineTransactionType(sellerState, buyerState);

    // Calculate line items
    const lineItems: InvoiceLineItemCalculation[] = [];
    
    for (const lineItem of orderData.line_items) {
      // Get HSN and GST rate for product
      const { hsn_code, gst_rate } = GSTCalculator.getProductHSN(
        lineItem.product_id,
        [], // TODO: Get collection IDs from Shopify API
        hsnMappings,
        '99999', // Default HSN
        18 // Default GST rate
      );

      // Calculate GST for line item
      const calculatedItem = GSTCalculator.calculateLineItemGST(
        lineItem,
        gst_rate,
        hsn_code,
        transactionType,
        true // Assuming prices include tax
      );

      lineItems.push(calculatedItem);
    }

    // Calculate shipping GST
    const shippingCharge = parseFloat(orderData.shipping_lines[0]?.price || '0');
    const shippingGST = GSTCalculator.calculateShippingGST(
      shippingCharge,
      transactionType,
      true
    );

    // Calculate totals
    const discountAmount = orderData.discount_codes.reduce(
      (sum, discount) => sum + parseFloat(discount.amount),
      0
    );

    const totals = GSTCalculator.calculateInvoiceTotals(
      lineItems,
      shippingGST,
      shippingCharge,
      discountAmount
    );

    // Generate tax summary
    const taxSummary = GSTCalculator.generateTaxSummary(lineItems);

    // Build seller details
    const sellerDetails: BusinessDetails = {
      legal_name: businessSettings.legal_name,
      trading_name: businessSettings.trading_name,
      gstin: businessSettings.gstin,
      state_code: businessSettings.state_code,
      address_line_1: warehouseDetails?.address_line_1 || businessSettings.address_line_1,
      address_line_2: warehouseDetails?.address_line_2 || businessSettings.address_line_2,
      city: warehouseDetails?.city || businessSettings.city,
      state: warehouseDetails?.state || businessSettings.state,
      pin_code: warehouseDetails?.pin_code || businessSettings.pin_code,
      country: businessSettings.country,
      phone: warehouseDetails?.phone || businessSettings.phone,
      email: warehouseDetails?.email || businessSettings.email,
      website: businessSettings.website,
      logo_url: businessSettings.logo_url,
      signature_url: businessSettings.signature_url,
      signatory_name: businessSettings.signatory_name,
      signatory_designation: businessSettings.signatory_designation,
    };

    // Add bank details if available
    if (businessSettings.bank_name) {
      sellerDetails.bank_details = {
        bank_name: businessSettings.bank_name,
        account_holder_name: businessSettings.account_holder_name,
        account_number: businessSettings.account_number,
        ifsc_code: businessSettings.ifsc_code,
        branch_name: businessSettings.branch_name,
        account_type: businessSettings.account_type,
      };
    }

    // Build buyer details
    const buyerDetails: CustomerDetails = {
      name: `${orderData.customer.first_name} ${orderData.customer.last_name}`.trim(),
      email: orderData.customer.email,
      phone: orderData.customer.phone,
      billing_address: orderData.billing_address,
      shipping_address: orderData.shipping_address,
      // TODO: Extract GSTIN from order if available
    };

    // Calculate dates
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + invoiceSettings.due_days);

    return {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      order_details: orderData,
      seller_details: sellerDetails,
      buyer_details: buyerDetails,
      line_items: lineItems,
      totals,
      tax_summary: taxSummary,
      transaction_type: transactionType,
    };
  }

  /**
   * Save invoice to database
   */
  private async saveInvoiceToDatabase(
    shop: string,
    invoiceData: InvoiceData,
    orderData: ShopifyOrder,
    pdfBuffer: Buffer,
    warehouseId?: string
  ): Promise<any> {
    // TODO: Upload PDF to cloud storage and get URL
    const pdfUrl = `https://storage.example.com/invoices/${invoiceData.invoice_number}.pdf`;

    return await this.prisma.invoice.create({
      data: {
        shop,
        invoice_number: invoiceData.invoice_number,
        order_id: orderData.id,
        order_number: orderData.name,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        customer_name: invoiceData.buyer_details.name,
        customer_email: invoiceData.buyer_details.email,
        customer_phone: invoiceData.buyer_details.phone,
        billing_address: JSON.stringify(invoiceData.buyer_details.billing_address),
        shipping_address: JSON.stringify(invoiceData.buyer_details.shipping_address),
        customer_gstin: invoiceData.buyer_details.gstin,
        warehouse_id: warehouseId,
        subtotal: invoiceData.totals.subtotal,
        cgst_amount: invoiceData.totals.total_cgst,
        sgst_amount: invoiceData.totals.total_sgst,
        igst_amount: invoiceData.totals.total_igst,
        shipping_charge: invoiceData.totals.shipping_charge,
        shipping_tax: invoiceData.totals.shipping_tax,
        discount_amount: invoiceData.totals.discount_amount,
        round_off: invoiceData.totals.round_off,
        total_amount: invoiceData.totals.grand_total,
        status: 'SENT',
        pdf_url: pdfUrl,
        line_items: {
          create: invoiceData.line_items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            hsn_code: item.hsn_code,
            gst_rate: item.gst_rate,
            cgst_amount: item.cgst_amount,
            sgst_amount: item.sgst_amount,
            igst_amount: item.igst_amount,
            taxable_value: item.taxable_value,
            total_amount: item.total_amount,
          })),
        },
      },
      include: {
        line_items: true,
      },
    });
  }

  /**
   * Generate credit note for refund
   */
  async generateCreditNote(
    shop: string,
    originalInvoiceId: string,
    refundData: any
  ): Promise<{ creditNoteId: string; pdfBuffer: Buffer }> {
    // Get original invoice
    const originalInvoice = await this.prisma.invoice.findFirst({
      where: {
        shop,
        id: originalInvoiceId,
      },
      include: {
        line_items: true,
      },
    });

    if (!originalInvoice) {
      throw new Error('Original invoice not found');
    }

    // Generate credit note number
    const creditNoteNumber = await this.invoiceNumberGenerator.generateCreditNoteNumber(
      originalInvoice.invoice_number
    );

    // Create credit note (simplified - would need full refund logic)
    const creditNote = await this.prisma.invoice.create({
      data: {
        ...originalInvoice,
        id: undefined, // Let Prisma generate new ID
        invoice_number: creditNoteNumber,
        is_credit_note: true,
        original_invoice_id: originalInvoiceId,
        status: 'SENT',
        total_amount: -originalInvoice.total_amount, // Negative amount
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // TODO: Generate credit note PDF
    const pdfBuffer = Buffer.from('Credit Note PDF placeholder');

    return {
      creditNoteId: creditNote.id,
      pdfBuffer,
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(shop: string, invoiceId: string): Promise<any> {
    return await this.prisma.invoice.findFirst({
      where: {
        shop,
        id: invoiceId,
      },
      include: {
        line_items: true,
      },
    });
  }

  /**
   * Get invoices for a shop with pagination
   */
  async getInvoices(
    shop: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
    } = {}
  ): Promise<{ invoices: any[]; total: number; page: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 25;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { shop };

    if (options.status) {
      where.status = options.status;
    }

    if (options.dateFrom || options.dateTo) {
      where.invoice_date = {};
      if (options.dateFrom) {
        where.invoice_date.gte = options.dateFrom;
      }
      if (options.dateTo) {
        where.invoice_date.lte = options.dateTo;
      }
    }

    if (options.search) {
      where.OR = [
        { invoice_number: { contains: options.search } },
        { order_number: { contains: options.search } },
        { customer_name: { contains: options.search } },
        { customer_email: { contains: options.search } },
      ];
    }

    // Get invoices and total count
    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          line_items: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      invoices,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Send invoice email
   */
  private async sendInvoiceEmail(invoiceId: string, customerEmail: string): Promise<void> {
    // TODO: Implement email sending logic
    console.log(`Sending invoice ${invoiceId} to ${customerEmail}`);
  }

  /**
   * Log activity
   */
  private async logActivity(
    shop: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: any
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        shop,
        entity_type: entityType,
        entity_id: entityId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(shop: string): Promise<{
    total_invoices: number;
    this_month_invoices: number;
    pending_invoices: number;
    total_revenue: number;
    total_gst_collected: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalInvoices,
      thisMonthInvoices,
      pendingInvoices,
      revenueResult,
      gstResult,
    ] = await Promise.all([
      this.prisma.invoice.count({
        where: { shop, is_credit_note: false },
      }),
      this.prisma.invoice.count({
        where: {
          shop,
          is_credit_note: false,
          created_at: { gte: startOfMonth },
        },
      }),
      this.prisma.invoice.count({
        where: {
          shop,
          is_credit_note: false,
          status: { in: ['DRAFT', 'SENT'] },
        },
      }),
      this.prisma.invoice.aggregate({
        where: { shop, is_credit_note: false },
        _sum: { total_amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { shop, is_credit_note: false },
        _sum: {
          cgst_amount: true,
          sgst_amount: true,
          igst_amount: true,
        },
      }),
    ]);

    const totalRevenue = revenueResult._sum.total_amount || 0;
    const totalGSTCollected = 
      (gstResult._sum.cgst_amount || 0) +
      (gstResult._sum.sgst_amount || 0) +
      (gstResult._sum.igst_amount || 0);

    return {
      total_invoices: totalInvoices,
      this_month_invoices: thisMonthInvoices,
      pending_invoices: pendingInvoices,
      total_revenue: totalRevenue,
      total_gst_collected: totalGSTCollected,
    };
  }
}