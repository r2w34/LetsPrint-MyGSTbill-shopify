-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "gstin" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "bank_name" TEXT,
    "account_holder_name" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "branch_name" TEXT,
    "account_type" TEXT,
    "logo_url" TEXT,
    "signature_url" TEXT,
    "signatory_name" TEXT,
    "signatory_designation" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InvoiceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'INV',
    "starting_number" INTEGER NOT NULL DEFAULT 1,
    "current_sequence" INTEGER NOT NULL DEFAULT 0,
    "reset_frequency" TEXT NOT NULL DEFAULT 'YEARLY',
    "template_type" TEXT NOT NULL DEFAULT 'CLASSIC',
    "due_days" INTEGER NOT NULL DEFAULT 30,
    "show_bank_details" BOOLEAN NOT NULL DEFAULT true,
    "show_signature" BOOLEAN NOT NULL DEFAULT true,
    "show_logo" BOOLEAN NOT NULL DEFAULT true,
    "show_hsn" BOOLEAN NOT NULL DEFAULT true,
    "show_customer_gst" BOOLEAN NOT NULL DEFAULT true,
    "terms_and_conditions" TEXT,
    "notes" TEXT,
    "payment_instructions" TEXT,
    "auto_generate" BOOLEAN NOT NULL DEFAULT false,
    "auto_email" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "invoice_date" DATETIME NOT NULL,
    "due_date" DATETIME NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT,
    "billing_address" TEXT NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "customer_gstin" TEXT,
    "warehouse_id" TEXT,
    "subtotal" REAL NOT NULL,
    "cgst_amount" REAL NOT NULL,
    "sgst_amount" REAL NOT NULL,
    "igst_amount" REAL NOT NULL,
    "shipping_charge" REAL NOT NULL,
    "shipping_tax" REAL NOT NULL,
    "discount_amount" REAL NOT NULL DEFAULT 0,
    "round_off" REAL NOT NULL DEFAULT 0,
    "total_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pdf_url" TEXT,
    "email_sent_at" DATETIME,
    "is_credit_note" BOOLEAN NOT NULL DEFAULT false,
    "original_invoice_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Invoice_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "hsn_code" TEXT NOT NULL,
    "gst_rate" REAL NOT NULL,
    "cgst_amount" REAL NOT NULL,
    "sgst_amount" REAL NOT NULL,
    "igst_amount" REAL NOT NULL,
    "taxable_value" REAL NOT NULL,
    "total_amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceLineItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "label_number" TEXT NOT NULL,
    "courier_partner" TEXT NOT NULL,
    "awb_number" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "shipping_address" TEXT NOT NULL,
    "return_address" TEXT NOT NULL,
    "product_count" INTEGER NOT NULL,
    "weight" REAL,
    "dimensions" TEXT,
    "is_cod" BOOLEAN NOT NULL DEFAULT false,
    "cod_amount" REAL,
    "label_size" TEXT NOT NULL DEFAULT 'A4',
    "pdf_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductHSNMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "product_id" TEXT,
    "collection_id" TEXT,
    "hsn_code" TEXT NOT NULL,
    "gst_rate" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "gstin" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "charge_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billing_interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "price" REAL NOT NULL,
    "invoice_limit" INTEGER NOT NULL,
    "invoices_used" INTEGER NOT NULL DEFAULT 0,
    "trial_ends_at" DATETIME,
    "next_billing_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_email" TEXT,
    "metadata" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_shop_key" ON "BusinessSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSettings_shop_key" ON "InvoiceSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "Invoice_shop_idx" ON "Invoice"("shop");

-- CreateIndex
CREATE INDEX "Invoice_order_id_idx" ON "Invoice"("order_id");

-- CreateIndex
CREATE INDEX "Invoice_invoice_date_idx" ON "Invoice"("invoice_date");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoice_id_idx" ON "InvoiceLineItem"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingLabel_label_number_key" ON "ShippingLabel"("label_number");

-- CreateIndex
CREATE INDEX "ShippingLabel_shop_idx" ON "ShippingLabel"("shop");

-- CreateIndex
CREATE INDEX "ShippingLabel_order_id_idx" ON "ShippingLabel"("order_id");

-- CreateIndex
CREATE INDEX "ProductHSNMapping_shop_idx" ON "ProductHSNMapping"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ProductHSNMapping_shop_product_id_key" ON "ProductHSNMapping"("shop", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductHSNMapping_shop_collection_id_key" ON "ProductHSNMapping"("shop", "collection_id");

-- CreateIndex
CREATE INDEX "Warehouse_shop_idx" ON "Warehouse"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shop_key" ON "Subscription"("shop");

-- CreateIndex
CREATE INDEX "ActivityLog_shop_idx" ON "ActivityLog"("shop");

-- CreateIndex
CREATE INDEX "ActivityLog_created_at_idx" ON "ActivityLog"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_shop_template_name_key" ON "EmailTemplate"("shop", "template_name");
