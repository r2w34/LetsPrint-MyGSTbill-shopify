# LetsPrint - GST Invoice & Shipping Label App

A comprehensive Shopify app for Indian merchants to generate GST-compliant invoices and professional shipping labels.

## Features

### 🧾 GST Invoice Generation
- **Automatic Tax Calculation**: CGST, SGST, IGST based on seller-buyer location
- **HSN Code Management**: Map products to HSN codes with appropriate GST rates
- **Multiple Templates**: Classic, Modern, Minimal, and Detailed invoice designs
- **Sequential Numbering**: Automatic invoice numbering with customizable prefixes
- **Multi-Warehouse Support**: Generate invoices from different warehouse locations
- **Email Integration**: Auto-send invoices to customers
- **Credit Notes**: Generate credit notes for refunds

### 📦 Shipping Label Generation
- **Multiple Formats**: A4, A5, and 4x6 thermal label support
- **Courier Integration**: Support for major Indian couriers (Delhivery, Blue Dart, DTDC, etc.)
- **COD Labels**: Special handling for Cash on Delivery orders
- **Barcode & QR Codes**: Automatic generation for tracking
- **Return Labels**: Generate return shipping labels

### ⚙️ Automation & Workflows
- **Webhook Integration**: Auto-generate invoices on order fulfillment
- **Bulk Processing**: Generate multiple invoices/labels at once
- **Smart Filtering**: Filter orders by status, date, payment method
- **Activity Logging**: Complete audit trail of all actions

### 📊 Reports & Analytics
- **GST Summary Reports**: Monthly, quarterly, yearly GST collection
- **GSTR-1 Ready**: Export data in GSTR-1 format
- **Revenue Analytics**: Track sales by state, product, GST rate
- **Invoice Register**: Complete invoice history with search and filters

## Tech Stack

- **Frontend**: React Router v7 + Polaris Web Components
- **Backend**: Node.js with Express (internal)
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma
- **PDF Generation**: Puppeteer + Handlebars
- **Authentication**: Shopify OAuth
- **Billing**: Shopify Billing API

## Quick Start

### Prerequisites
- Node.js 20+ 
- Shopify CLI
- Shopify Partner account

### 1. Clone and Install
```bash
git clone <repository-url>
cd shopify-app-template-react-router
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your Shopify app credentials
```

### 3. Database Setup
```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Configure Shopify App
1. Create a new app in Shopify Partners
2. Set OAuth redirect URL: `https://your-app-url.com/auth/callback`
3. Configure webhooks:
   - `orders/fulfilled` → `https://your-app-url.com/webhooks/orders/fulfilled`
   - `app/uninstalled` → `https://your-app-url.com/webhooks/app/uninstalled`

## Configuration

### Business Settings
Complete your business setup in the app:
1. Legal business name and trading name
2. GSTIN (15-character GST number)
3. Complete business address
4. Bank details (optional, for invoice display)
5. Authorized signatory details

### Invoice Settings
Configure invoice generation:
- Invoice number prefix and format
- Default GST rates and HSN codes
- Invoice templates and customization
- Auto-generation and email settings

### HSN Code Mapping
Map your products to appropriate HSN codes:
1. Go to Products & HSN section
2. Map individual products or entire collections
3. Set GST rates (0%, 5%, 12%, 18%, 28%)

## API Endpoints

### Invoice Management
- `GET /api/invoices` - List invoices with pagination
- `POST /api/invoices` - Generate invoices for orders
- `GET /api/invoices/stats` - Get invoice statistics

### Order Management
- `GET /api/orders` - List orders with invoice status

### Settings
- `GET /api/settings/business` - Get business settings
- `POST /api/settings/business` - Save business settings

### Webhooks
- `POST /webhooks/orders/fulfilled` - Auto-generate invoice on fulfillment
- `POST /webhooks/app/uninstalled` - Cleanup on app uninstall

## Database Schema

### Core Models
- **BusinessSettings**: Store merchant business information
- **InvoiceSettings**: Configure invoice generation preferences
- **Invoice**: Store generated invoices with line items
- **ShippingLabel**: Store generated shipping labels
- **ProductHSNMapping**: Map products to HSN codes and GST rates
- **Warehouse**: Multi-location support
- **ActivityLog**: Audit trail of all actions

## Deployment

### Production Setup
1. **Database**: Switch to PostgreSQL
   ```bash
   # Update DATABASE_URL in .env
   DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   npx prisma migrate deploy
   ```

2. **File Storage**: Configure cloud storage for PDFs
   - AWS S3 (recommended)
   - Google Cloud Storage
   - Local storage (not recommended for production)

3. **Email Service**: Configure SMTP for invoice emails
   - Gmail SMTP
   - SendGrid
   - AWS SES

### Deployment Platforms
- **Render**: Easy deployment with PostgreSQL addon
- **Railway**: Simple setup with database included
- **Fly.io**: Global deployment with edge locations
- **AWS**: Full control with EC2 + RDS

### Environment Variables
```bash
# Production environment
NODE_ENV=production
DATABASE_URL="postgresql://..."
SHOPIFY_APP_URL="https://your-domain.com"
SMTP_HOST="smtp.gmail.com"
AWS_S3_BUCKET="your-bucket"
```

## GST Compliance

### Tax Calculation Logic
1. **Intra-State Transactions** (same state):
   - CGST = GST Rate ÷ 2
   - SGST = GST Rate ÷ 2
   - IGST = 0

2. **Inter-State Transactions** (different states):
   - IGST = GST Rate
   - CGST = 0
   - SGST = 0

3. **Shipping Charges**: 18% GST (standard rate)

### Invoice Requirements
- Sequential invoice numbering
- Complete seller and buyer details
- HSN/SAC codes for all items
- Tax breakup (CGST/SGST/IGST)
- Total amount in words
- Authorized signature

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

2. **Webhook Not Working**
   - Check webhook URL in Shopify Partner dashboard
   - Verify HTTPS certificate
   - Check webhook signature validation

3. **PDF Generation Fails**
   - Ensure Puppeteer dependencies are installed
   - Check memory limits in production
   - Verify template syntax

4. **GST Calculation Incorrect**
   - Verify HSN code mappings
   - Check state code configuration
   - Validate GSTIN format

### Debug Mode
Enable debug logging:
```bash
DEBUG=letsprint:* npm run dev
```

## Support

### Documentation
- [Shopify App Development](https://shopify.dev/docs/apps)
- [React Router v7](https://reactrouter.com/en/main)
- [Polaris Web Components](https://shopify.dev/docs/api/app-home)
- [Prisma ORM](https://www.prisma.io/docs)

### GST Resources
- [GST Portal](https://www.gst.gov.in/)
- [HSN Code Directory](https://cbic-gst.gov.in/gst-goods-services-rates.html)
- [GST Rates](https://cleartax.in/s/gst-rates)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v1.0.0 (Initial Release)
- GST-compliant invoice generation
- Basic shipping label support
- Shopify OAuth integration
- Multi-warehouse support
- HSN code mapping
- Automated workflows
- Comprehensive reporting

---

**Built with ❤️ for Indian Shopify merchants**