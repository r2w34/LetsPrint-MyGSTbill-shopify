import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import type { InvoiceData, ShippingLabelData } from '../types/invoice';
import { formatCurrency, formatInvoiceDate, numberToWords } from '../utils/gst-calculator';

export class PDFGenerator {
  private static browser: puppeteer.Browser | null = null;

  /**
   * Initialize browser instance
   */
  private static async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Generate invoice PDF
   */
  static async generateInvoicePDF(
    invoiceData: InvoiceData,
    templateType: string = 'CLASSIC'
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set page size to A4
      await page.setViewport({ width: 794, height: 1123 }); // A4 in pixels at 96 DPI

      // Get HTML template
      const htmlContent = this.generateInvoiceHTML(invoiceData, templateType);

      // Set content and generate PDF
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      });

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Generate shipping label PDF
   */
  static async generateShippingLabelPDF(
    labelData: ShippingLabelData
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set page size based on label size
      const dimensions = this.getLabelDimensions(labelData.label_size);
      await page.setViewport(dimensions);

      // Get HTML template
      const htmlContent = this.generateLabelHTML(labelData);

      // Set content and generate PDF
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        width: dimensions.width,
        height: dimensions.height,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Get label dimensions based on size
   */
  private static getLabelDimensions(labelSize: string): { width: number; height: number } {
    switch (labelSize) {
      case 'A4':
        return { width: 794, height: 1123 }; // A4 in pixels
      case 'A5':
        return { width: 559, height: 794 }; // A5 in pixels
      case 'THERMAL_4X6':
        return { width: 288, height: 432 }; // 4x6 inches in pixels at 72 DPI
      default:
        return { width: 794, height: 1123 };
    }
  }

  /**
   * Generate invoice HTML content
   */
  private static generateInvoiceHTML(invoiceData: InvoiceData, templateType: string): string {
    // Register Handlebars helpers
    this.registerHandlebarsHelpers();

    // Get template based on type
    const template = this.getInvoiceTemplate(templateType);
    const compiledTemplate = Handlebars.compile(template);

    // Prepare template data
    const templateData = {
      ...invoiceData,
      formatted_invoice_date: formatInvoiceDate(invoiceData.invoice_date),
      formatted_due_date: formatInvoiceDate(invoiceData.due_date),
      formatted_grand_total: formatCurrency(invoiceData.totals.grand_total),
      total_in_words: numberToWords(invoiceData.totals.grand_total),
      current_date: formatInvoiceDate(new Date()),
    };

    return compiledTemplate(templateData);
  }

  /**
   * Generate shipping label HTML content
   */
  private static generateLabelHTML(labelData: ShippingLabelData): string {
    this.registerHandlebarsHelpers();

    const template = this.getShippingLabelTemplate(labelData.label_size);
    const compiledTemplate = Handlebars.compile(template);

    return compiledTemplate(labelData);
  }

  /**
   * Register Handlebars helpers
   */
  private static registerHandlebarsHelpers(): void {
    // Format currency helper
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return formatCurrency(amount);
    });

    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return formatInvoiceDate(date);
    });

    // Math helpers
    Handlebars.registerHelper('add', (a: number, b: number) => a + b);
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    Handlebars.registerHelper('toFixed', (num: number, decimals: number) => num.toFixed(decimals));

    // Conditional helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // Array helpers
    Handlebars.registerHelper('length', (array: any[]) => array?.length || 0);
  }

  /**
   * Get invoice template HTML
   */
  private static getInvoiceTemplate(templateType: string): string {
    switch (templateType) {
      case 'CLASSIC':
        return this.getClassicInvoiceTemplate();
      case 'MODERN':
        return this.getModernInvoiceTemplate();
      case 'MINIMAL':
        return this.getMinimalInvoiceTemplate();
      case 'DETAILED':
        return this.getDetailedInvoiceTemplate();
      default:
        return this.getClassicInvoiceTemplate();
    }
  }

  /**
   * Classic invoice template
   */
  private static getClassicInvoiceTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tax Invoice - {{invoice_number}}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 10pt;
            line-height: 1.4;
        }
        .header {
            background-color: #f5f5f5;
            padding: 15px;
            border-bottom: 2px solid #008060;
        }
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo {
            max-width: 150px;
            max-height: 60px;
        }
        .invoice-title {
            text-align: right;
        }
        .invoice-title h1 {
            margin: 0;
            font-size: 18pt;
            color: #008060;
        }
        .invoice-number {
            font-size: 14pt;
            font-weight: bold;
            color: #008060;
        }
        .party-details {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
        }
        .party-box {
            width: 48%;
            border: 1px solid #ddd;
            padding: 15px;
        }
        .party-title {
            font-weight: bold;
            font-size: 12pt;
            margin-bottom: 10px;
            color: #333;
        }
        .order-bar {
            background-color: #008060;
            color: white;
            padding: 10px 15px;
            margin: 20px 0;
            display: flex;
            justify-content: space-between;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .items-table th {
            background-color: #008060;
            color: white;
            padding: 10px 5px;
            text-align: center;
            font-size: 9pt;
        }
        .items-table td {
            padding: 8px 5px;
            border-bottom: 1px solid #ddd;
            text-align: center;
            font-size: 9pt;
        }
        .items-table .text-left {
            text-align: left;
        }
        .items-table .text-right {
            text-align: right;
        }
        .tax-summary {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .tax-summary th, .tax-summary td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: right;
        }
        .tax-summary th {
            background-color: #f5f5f5;
        }
        .totals {
            float: right;
            width: 300px;
            margin: 20px 0;
        }
        .totals table {
            width: 100%;
            border-collapse: collapse;
        }
        .totals td {
            padding: 5px 10px;
            border-bottom: 1px solid #ddd;
        }
        .totals .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
            font-size: 12pt;
        }
        .total-words {
            clear: both;
            margin: 20px 0;
            font-weight: bold;
            font-style: italic;
        }
        .bank-details {
            border: 1px solid #ddd;
            padding: 15px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .terms {
            width: 60%;
            font-size: 8pt;
        }
        .signature {
            width: 35%;
            text-align: right;
        }
        .signature-img {
            max-width: 100px;
            max-height: 50px;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="header-content">
            <div class="logo-section">
                {{#if seller_details.logo_url}}
                <img src="{{seller_details.logo_url}}" alt="Logo" class="logo">
                {{/if}}
            </div>
            <div class="invoice-title">
                <h1>TAX INVOICE</h1>
                <div class="invoice-number">{{invoice_number}}</div>
                <div>Date: {{formatted_invoice_date}}</div>
                <div>Due: {{formatted_due_date}}</div>
            </div>
        </div>
    </div>

    <!-- Party Details -->
    <div class="party-details">
        <div class="party-box">
            <div class="party-title">Sold By</div>
            <strong>{{seller_details.legal_name}}</strong><br>
            {{#if seller_details.trading_name}}
            {{seller_details.trading_name}}<br>
            {{/if}}
            {{seller_details.address_line_1}}<br>
            {{#if seller_details.address_line_2}}
            {{seller_details.address_line_2}}<br>
            {{/if}}
            {{seller_details.city}}, {{seller_details.state}} {{seller_details.pin_code}}<br>
            <strong>GSTIN:</strong> {{seller_details.gstin}}<br>
            Phone: {{seller_details.phone}}<br>
            Email: {{seller_details.email}}
        </div>
        <div class="party-box">
            <div class="party-title">Bill To</div>
            <strong>{{buyer_details.name}}</strong><br>
            {{buyer_details.billing_address.address1}}<br>
            {{#if buyer_details.billing_address.address2}}
            {{buyer_details.billing_address.address2}}<br>
            {{/if}}
            {{buyer_details.billing_address.city}}, {{buyer_details.billing_address.province}} {{buyer_details.billing_address.zip}}<br>
            {{#if buyer_details.gstin}}
            <strong>GSTIN:</strong> {{buyer_details.gstin}}<br>
            {{/if}}
            {{#if buyer_details.phone}}
            Phone: {{buyer_details.phone}}<br>
            {{/if}}
            Email: {{buyer_details.email}}
        </div>
    </div>

    <!-- Order Details Bar -->
    <div class="order-bar">
        <span><strong>Order:</strong> {{order_details.name}}</span>
        <span><strong>Date:</strong> {{formatDate order_details.created_at}}</span>
        <span><strong>Payment:</strong> {{order_details.financial_status}}</span>
    </div>

    <!-- Line Items Table -->
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%">Sr</th>
                <th style="width: 30%" class="text-left">Product Description</th>
                <th style="width: 8%">HSN</th>
                <th style="width: 6%">Qty</th>
                <th style="width: 10%">Rate</th>
                <th style="width: 8%">Disc</th>
                <th style="width: 10%">Taxable</th>
                <th style="width: 6%">GST%</th>
                <th style="width: 8%">Tax</th>
                <th style="width: 9%">Total</th>
            </tr>
        </thead>
        <tbody>
            {{#each line_items}}
            <tr>
                <td>{{@index}}</td>
                <td class="text-left">{{title}}{{#if sku}} ({{sku}}){{/if}}</td>
                <td>{{hsn_code}}</td>
                <td>{{quantity}}</td>
                <td class="text-right">{{formatCurrency unit_price}}</td>
                <td class="text-right">{{formatCurrency discount}}</td>
                <td class="text-right">{{formatCurrency taxable_value}}</td>
                <td>{{gst_rate}}%</td>
                <td class="text-right">{{formatCurrency total_tax}}</td>
                <td class="text-right">{{formatCurrency total_amount}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    <!-- Tax Summary -->
    {{#if tax_summary}}
    <table class="tax-summary" style="width: 60%;">
        <thead>
            <tr>
                <th>GST Rate</th>
                <th>Taxable Value</th>
                {{#if (eq transaction_type 'INTRA_STATE')}}
                <th>CGST</th>
                <th>SGST</th>
                {{else}}
                <th>IGST</th>
                {{/if}}
                <th>Total Tax</th>
            </tr>
        </thead>
        <tbody>
            {{#each tax_summary}}
            <tr>
                <td>{{gst_rate}}%</td>
                <td>{{formatCurrency taxable_value}}</td>
                {{#if (eq ../transaction_type 'INTRA_STATE')}}
                <td>{{formatCurrency cgst_amount}}</td>
                <td>{{formatCurrency sgst_amount}}</td>
                {{else}}
                <td>{{formatCurrency igst_amount}}</td>
                {{/if}}
                <td>{{formatCurrency total_tax}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>
    {{/if}}

    <!-- Totals -->
    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td class="text-right">{{formatCurrency totals.subtotal}}</td>
            </tr>
            {{#if (gt totals.total_cgst 0)}}
            <tr>
                <td>CGST:</td>
                <td class="text-right">{{formatCurrency totals.total_cgst}}</td>
            </tr>
            <tr>
                <td>SGST:</td>
                <td class="text-right">{{formatCurrency totals.total_sgst}}</td>
            </tr>
            {{/if}}
            {{#if (gt totals.total_igst 0)}}
            <tr>
                <td>IGST:</td>
                <td class="text-right">{{formatCurrency totals.total_igst}}</td>
            </tr>
            {{/if}}
            {{#if (gt totals.shipping_charge 0)}}
            <tr>
                <td>Shipping:</td>
                <td class="text-right">{{formatCurrency totals.shipping_charge}}</td>
            </tr>
            {{/if}}
            {{#if (gt totals.discount_amount 0)}}
            <tr>
                <td>Discount:</td>
                <td class="text-right">-{{formatCurrency totals.discount_amount}}</td>
            </tr>
            {{/if}}
            {{#if totals.round_off}}
            <tr>
                <td>Round Off:</td>
                <td class="text-right">{{formatCurrency totals.round_off}}</td>
            </tr>
            {{/if}}
            <tr class="total-row">
                <td><strong>Grand Total:</strong></td>
                <td class="text-right"><strong>{{formatCurrency totals.grand_total}}</strong></td>
            </tr>
        </table>
    </div>

    <!-- Total in Words -->
    <div class="total-words">
        Total in Words: {{total_in_words}}
    </div>

    <!-- Bank Details -->
    {{#if seller_details.bank_details}}
    <div class="bank-details">
        <strong>Bank Details for Payment</strong><br>
        Bank: {{seller_details.bank_details.bank_name}}<br>
        A/c Holder: {{seller_details.bank_details.account_holder_name}}<br>
        A/c No: {{seller_details.bank_details.account_number}}<br>
        IFSC: {{seller_details.bank_details.ifsc_code}}<br>
        Branch: {{seller_details.bank_details.branch_name}}
    </div>
    {{/if}}

    <!-- Footer -->
    <div class="footer">
        <div class="terms">
            {{#if seller_details.terms_and_conditions}}
            <strong>Terms & Conditions:</strong><br>
            {{seller_details.terms_and_conditions}}
            {{/if}}
        </div>
        <div class="signature">
            <strong>For {{seller_details.legal_name}}</strong><br><br>
            {{#if seller_details.signature_url}}
            <img src="{{seller_details.signature_url}}" alt="Signature" class="signature-img"><br>
            {{/if}}
            {{#if seller_details.signatory_name}}
            {{seller_details.signatory_name}}<br>
            {{seller_details.signatory_designation}}
            {{/if}}
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Modern invoice template (simplified version)
   */
  private static getModernInvoiceTemplate(): string {
    // For now, return the classic template
    // In a full implementation, this would have a different design
    return this.getClassicInvoiceTemplate();
  }

  /**
   * Minimal invoice template (simplified version)
   */
  private static getMinimalInvoiceTemplate(): string {
    // For now, return the classic template
    // In a full implementation, this would have a minimal design
    return this.getClassicInvoiceTemplate();
  }

  /**
   * Detailed invoice template (simplified version)
   */
  private static getDetailedInvoiceTemplate(): string {
    // For now, return the classic template
    // In a full implementation, this would have more detailed information
    return this.getClassicInvoiceTemplate();
  }

  /**
   * Get shipping label template
   */
  private static getShippingLabelTemplate(labelSize: string): string {
    // Basic shipping label template
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Shipping Label</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px;
            font-size: 12pt;
        }
        .label-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .courier-logo {
            max-width: 100px;
            max-height: 40px;
        }
        .cod-badge {
            background-color: red;
            color: white;
            padding: 5px 10px;
            font-weight: bold;
            border-radius: 3px;
        }
        .deliver-to {
            margin: 15px 0;
        }
        .deliver-to h3 {
            margin: 0 0 10px 0;
            font-size: 14pt;
        }
        .customer-name {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 5px 0;
        }
        .address {
            line-height: 1.4;
            margin: 10px 0;
        }
        .pin-code {
            font-size: 18pt;
            font-weight: bold;
        }
        .separator {
            border-top: 1px dashed #000;
            margin: 15px 0;
        }
        .from-section {
            margin: 15px 0;
        }
        .from-section h4 {
            margin: 0 0 5px 0;
            font-size: 10pt;
        }
        .order-details {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-size: 10pt;
        }
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
        }
        .qr-code {
            width: 60px;
            height: 60px;
            border: 1px solid #000;
        }
        .instructions {
            font-size: 8pt;
            text-align: right;
        }
        .barcode {
            text-align: center;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="label-header">
        <div class="courier-info">
            <strong>{{courier_partner}}</strong>
        </div>
        {{#if is_cod}}
        <div class="cod-badge">COD ₹{{cod_amount}}</div>
        {{else}}
        <div class="cod-badge" style="background-color: green;">PREPAID</div>
        {{/if}}
    </div>

    <!-- AWB Barcode -->
    {{#if awb_number}}
    <div class="barcode">
        <div style="font-family: 'Libre Barcode 128', monospace; font-size: 24pt;">{{awb_number}}</div>
        <div style="font-size: 10pt;">{{awb_number}}</div>
    </div>
    {{/if}}

    <!-- Deliver To -->
    <div class="deliver-to">
        <h3>DELIVER TO:</h3>
        <div class="customer-name">{{customer_name}}</div>
        <div class="address">
            {{shipping_address.address1}}<br>
            {{#if shipping_address.address2}}{{shipping_address.address2}}<br>{{/if}}
            {{shipping_address.city}}, {{shipping_address.province}}<br>
            <span class="pin-code">{{shipping_address.zip}}</span>
        </div>
        {{#if customer_phone}}
        <div><strong>Phone:</strong> {{customer_phone}}</div>
        {{/if}}
    </div>

    <!-- Separator -->
    <div class="separator"></div>

    <!-- From -->
    <div class="from-section">
        <h4>FROM:</h4>
        <div>
            {{return_address.address1}}<br>
            {{#if return_address.address2}}{{return_address.address2}}<br>{{/if}}
            {{return_address.city}}, {{return_address.province}} {{return_address.zip}}<br>
            {{#if return_address.phone}}Phone: {{return_address.phone}}{{/if}}
        </div>
    </div>

    <!-- Order Details -->
    <div class="order-details">
        <div>
            <strong>Order:</strong> {{order_details.name}}<br>
            <strong>Date:</strong> {{formatDate order_details.created_at}}
        </div>
        <div>
            <strong>Items:</strong> {{product_count}}<br>
            {{#if weight}}<strong>Weight:</strong> {{weight}}kg{{/if}}
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="qr-code">
            <!-- QR Code placeholder -->
            <div style="width: 100%; height: 100%; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 8pt;">
                QR
            </div>
        </div>
        <div class="instructions">
            Scan to track<br>
            Handle with care<br>
            <small>Powered by LetsPrint</small>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Close browser instance
   */
  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}