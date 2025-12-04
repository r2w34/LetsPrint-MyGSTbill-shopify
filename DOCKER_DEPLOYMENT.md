# Docker Deployment Guide for Shopify App

This guide provides comprehensive instructions for deploying your Shopify app using Docker containers with production-ready configuration.

## 🚀 Quick Start

### Prerequisites
- Ubuntu 22.04+ server with root access
- Domain name pointing to your server (e.g., shopconnect.mygstbill.com)
- Shopify Partner account with app credentials

### One-Command Deployment
```bash
# Clone and deploy
git clone https://github.com/r2w34/shopify-app-template-react-router.git
cd shopify-app-template-react-router
./docker-deploy.sh production
```

## 📋 Architecture Overview

### Container Stack
- **App Container**: Node.js application (React Router + Express)
- **Database Container**: PostgreSQL 15 with persistent storage
- **Nginx Container**: Reverse proxy with SSL termination

### Network Flow
```
Internet → Nginx (SSL) → Node.js App → PostgreSQL
```

## 🔧 Configuration Files

### 1. docker-compose.yml
Production-ready multi-container setup with:
- Health checks
- Restart policies
- Volume persistence
- Environment variable management

### 2. nginx.conf
Nginx configuration with:
- SSL termination
- HTTP to HTTPS redirect
- Shopify-specific headers
- Proxy configuration
- Security headers

### 3. docker-deploy.sh
Automated deployment script that:
- Installs Docker if needed
- Creates SSL certificates
- Sets up environment
- Runs migrations
- Health checks

## 🛠️ Manual Setup

### Step 1: Server Preparation
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Step 2: Application Setup
```bash
# Clone repository
git clone https://github.com/r2w34/shopify-app-template-react-router.git
cd shopify-app-template-react-router

# Create environment file
cp .env.example .env
# Edit .env with your Shopify credentials
```

### Step 3: SSL Configuration
```bash
# Create SSL directory
mkdir -p ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=IN/ST=State/L=City/O=Organization/CN=shopconnect.mygstbill.com"

# For production, use Let's Encrypt:
# certbot certonly --standalone -d shopconnect.mygstbill.com
# cp /etc/letsencrypt/live/shopconnect.mygstbill.com/fullchain.pem ssl/cert.pem
# cp /etc/letsencrypt/live/shopconnect.mygstbill.com/privkey.pem ssl/key.pem
```

### Step 4: Deploy Application
```bash
# Start all services
docker-compose up -d --build

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Generate Prisma client
docker-compose exec app npx prisma generate
```

## 🔐 Environment Variables

### Required Variables (.env)
```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SCOPES=write_products,read_customers,write_orders
HOST=https://shopconnect.mygstbill.com

# Database
DATABASE_URL=postgresql://postgres:password@db:5432/shopify_app

# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=generate_random_32_char_string
WEBHOOK_SECRET=generate_random_32_char_string
```

### Shopify Partner Dashboard Settings
Update your app settings in Shopify Partner Dashboard:
- **App URL**: `https://shopconnect.mygstbill.com`
- **Allowed redirection URLs**: `https://shopconnect.mygstbill.com/auth/callback`
- **Webhook endpoints**: `https://shopconnect.mygstbill.com/webhooks`

## 📊 Monitoring & Management

### Container Management
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f nginx

# Restart services
docker-compose restart app

# Stop all services
docker-compose down

# Update and redeploy
git pull origin main
docker-compose up -d --build
```

### Database Management
```bash
# Access PostgreSQL
docker-compose exec db psql -U postgres -d shopify_app

# Backup database
docker-compose exec db pg_dump -U postgres shopify_app > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres shopify_app < backup.sql
```

### Health Checks
```bash
# Application health
curl -k https://shopconnect.mygstbill.com/health

# Database health
docker-compose exec db pg_isready -U postgres

# Nginx status
docker-compose exec nginx nginx -t
```

## 🔄 Updates & Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Run new migrations if any
docker-compose exec app npx prisma migrate deploy
```

### SSL Certificate Renewal
```bash
# If using Let's Encrypt
certbot renew
cp /etc/letsencrypt/live/shopconnect.mygstbill.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/shopconnect.mygstbill.com/privkey.pem ssl/key.pem
docker-compose restart nginx
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check logs
docker-compose logs app

# Check environment variables
docker-compose exec app env | grep SHOPIFY
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose exec db pg_isready -U postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

#### 3. SSL Certificate Issues
```bash
# Test SSL
openssl s_client -connect shopconnect.mygstbill.com:443

# Regenerate certificates
rm ssl/*
./docker-deploy.sh production
```

#### 4. Nginx Configuration Issues
```bash
# Test nginx config
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Connect to database
docker-compose exec db psql -U postgres -d shopify_app

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
```

#### 2. Application Optimization
```bash
# Enable production optimizations in .env
NODE_ENV=production
SHOPIFY_LOG_LEVEL=error
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use Docker Swarm or Kubernetes for multi-node deployment
- Implement Redis for session storage across multiple app instances
- Use external PostgreSQL service (AWS RDS, Google Cloud SQL)

### Vertical Scaling
```yaml
# In docker-compose.yml, add resource limits
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 🔒 Security Best Practices

### 1. Environment Security
- Use Docker secrets for sensitive data
- Regularly update base images
- Implement proper firewall rules
- Use non-root users in containers

### 2. Application Security
- Enable HTTPS only
- Implement rate limiting
- Regular security updates
- Monitor for vulnerabilities

### 3. Database Security
- Use strong passwords
- Enable SSL connections
- Regular backups
- Access control

## 📞 Support

For deployment issues or questions:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs -f`
3. Verify environment variables and configuration
4. Ensure domain DNS is properly configured

## 🎯 Production Checklist

Before going live:
- [ ] SSL certificates properly configured
- [ ] Environment variables set correctly
- [ ] Database migrations completed
- [ ] Shopify Partner Dashboard URLs updated
- [ ] Health checks passing
- [ ] Backup strategy implemented
- [ ] Monitoring setup
- [ ] Security headers configured
- [ ] Performance testing completed
- [ ] Documentation updated