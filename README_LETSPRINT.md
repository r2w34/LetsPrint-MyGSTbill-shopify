# LetsPrint - MyGSTbill Shopify App

A comprehensive Shopify app for GST billing and invoice management, built with React Router v7 and modern web technologies.

## 🚀 Features

### Core Functionality
- **GST Billing Management**: Complete GST calculation and compliance
- **Invoice Generation**: Professional PDF invoice generation
- **Order Management**: Seamless integration with Shopify orders
- **Business Settings**: Configurable business information and GST details
- **Dashboard Analytics**: Real-time insights and statistics

### Technical Features
- **React Router v7**: Modern routing and navigation
- **Polaris Web Components**: Shopify's design system
- **Shopify App Bridge**: Embedded app experience
- **PostgreSQL**: Production database with Prisma ORM
- **TypeScript**: Type-safe development
- **Responsive Design**: Mobile-friendly interface

## 🛠️ Tech Stack

- **Frontend**: React Router v7, Polaris Web Components, TypeScript
- **Backend**: Node.js, Express (internal), Shopify Admin GraphQL API
- **Database**: PostgreSQL (production), SQLite (development)
- **ORM**: Prisma
- **Authentication**: Shopify OAuth
- **Billing**: Shopify Billing API
- **Deployment**: Docker, PM2, Nginx

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL (for production)
- Shopify Partner account
- Shopify CLI

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/r2w34/LetsPrint-MyGSTbill-shopify.git
cd LetsPrint-MyGSTbill-shopify
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```

Configure your `.env` file with:
```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_products,write_orders,read_customers
SHOPIFY_APP_URL=https://your-app-url.com
DATABASE_URL=postgresql://user:password@localhost:5432/letsprint_db
```

### 4. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### 5. Development
```bash
# Start development server
shopify app dev

# Or run locally
npm run dev
```

## 🏗️ Project Structure

```
├── app/
│   ├── routes/                 # React Router routes
│   │   ├── app._index.tsx     # Dashboard
│   │   ├── app.orders.tsx     # Order management
│   │   ├── app.settings.business.tsx # Business settings
│   │   └── api.*.tsx          # API endpoints
│   ├── lib/
│   │   ├── services/          # Business logic
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utility functions
│   └── shopify.server.ts      # Shopify configuration
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── public/                    # Static assets
└── extensions/                # Shopify extensions
```

## 📊 Database Schema

### Core Tables
- **Session**: Shopify session management
- **BusinessSettings**: Company and GST information
- **Invoice**: Generated invoices
- **InvoiceItem**: Invoice line items

### Key Features
- Automatic GST calculations
- Invoice number generation
- Order synchronization
- Business configuration

## 🔧 Configuration

### Shopify App Configuration
Update `shopify.app.toml`:
```toml
name = "LetsPrint MyGSTbill"
client_id = "your_client_id"
application_url = "https://your-app-url.com"
embedded = true

[access_scopes]
scopes = "write_products,write_orders,read_customers"

[auth]
redirect_urls = [
  "https://your-app-url.com/auth/callback"
]

[webhooks]
api_version = "2024-10"
```

## 🚀 Deployment

### Production Deployment
1. **Server Setup**: Ubuntu 22.04+ with Node.js, PostgreSQL, Nginx
2. **Environment**: Configure production environment variables
3. **Database**: Set up PostgreSQL and run migrations
4. **Build**: `npm run build`
5. **Process Manager**: Use PM2 for process management
6. **SSL**: Configure SSL certificates
7. **Nginx**: Set up reverse proxy

### Docker Deployment
```bash
# Build image
docker build -t letsprint-shopify-app .

# Run container
docker run -d \
  --name letsprint-app \
  -p 3000:3000 \
  -e DATABASE_URL=your_postgres_url \
  -e SHOPIFY_API_KEY=your_key \
  -e SHOPIFY_API_SECRET=your_secret \
  letsprint-shopify-app
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## 📝 API Endpoints

### Business Settings
- `GET /api/settings/business` - Get business settings
- `POST /api/settings/business` - Update business settings

### Orders
- `GET /api/orders` - Get orders with pagination
- `POST /api/orders/:id/invoice` - Generate invoice for order

### Invoices
- `GET /api/invoices` - Get invoices
- `GET /api/invoices/stats` - Get invoice statistics
- `POST /api/invoices` - Create new invoice

## 🔐 Security

- Shopify OAuth authentication
- CSRF protection
- Input validation and sanitization
- Secure session management
- Environment variable protection

## 📚 Documentation

- [Shopify App Development](https://shopify.dev/docs/apps)
- [React Router v7](https://reactrouter.com/en/main)
- [Polaris Web Components](https://polaris.shopify.com/components)
- [Prisma Documentation](https://www.prisma.io/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [Shopify Community](https://community.shopify.com/)
- Review the [documentation](./LETSPRINT_README.md)

## 🎯 Roadmap

- [ ] Advanced GST reporting
- [ ] Multi-currency support
- [ ] Bulk invoice generation
- [ ] Email automation
- [ ] Advanced analytics
- [ ] Mobile app companion

---

**Built with ❤️ for the Shopify ecosystem**