import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaClient } from "@prisma/client";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const businessSettings = await prisma.businessSettings.findUnique({
      where: { shop: session.shop },
    });

    return json({
      settings: businessSettings,
      isConfigured: !!businessSettings?.gstin,
    });
  } catch (error) {
    console.error("Error fetching business settings:", error);
    return json(
      { error: "Failed to fetch business settings" },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    // Basic validation
    if (!data.legal_name || !data.gstin || !data.state_code) {
      return json(
        { error: "Legal name, GSTIN, and state code are required" },
        { status: 400 }
      );
    }

    // Validate GSTIN format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(data.gstin as string)) {
      return json(
        { error: "Invalid GSTIN format" },
        { status: 400 }
      );
    }

    // Save business settings
    const businessSettings = await prisma.businessSettings.upsert({
      where: { shop: session.shop },
      update: {
        legal_name: data.legal_name as string,
        trading_name: data.trading_name as string || undefined,
        gstin: data.gstin as string,
        state_code: data.state_code as string,
        address_line_1: data.address_line_1 as string,
        address_line_2: data.address_line_2 as string || undefined,
        city: data.city as string,
        state: data.state as string,
        pin_code: data.pin_code as string,
        phone: data.phone as string,
        email: data.email as string,
        website: data.website as string || undefined,
        bank_name: data.bank_name as string || undefined,
        account_holder_name: data.account_holder_name as string || undefined,
        account_number: data.account_number as string || undefined,
        ifsc_code: data.ifsc_code as string || undefined,
        branch_name: data.branch_name as string || undefined,
        account_type: data.account_type as string || undefined,
        signatory_name: data.signatory_name as string || undefined,
        signatory_designation: data.signatory_designation as string || undefined,
        updated_at: new Date(),
      },
      create: {
        shop: session.shop,
        legal_name: data.legal_name as string,
        trading_name: data.trading_name as string || undefined,
        gstin: data.gstin as string,
        state_code: data.state_code as string,
        address_line_1: data.address_line_1 as string,
        address_line_2: data.address_line_2 as string || undefined,
        city: data.city as string,
        state: data.state as string,
        pin_code: data.pin_code as string,
        country: "India",
        phone: data.phone as string,
        email: data.email as string,
        website: data.website as string || undefined,
        bank_name: data.bank_name as string || undefined,
        account_holder_name: data.account_holder_name as string || undefined,
        account_number: data.account_number as string || undefined,
        ifsc_code: data.ifsc_code as string || undefined,
        branch_name: data.branch_name as string || undefined,
        account_type: data.account_type as string || undefined,
        signatory_name: data.signatory_name as string || undefined,
        signatory_designation: data.signatory_designation as string || undefined,
      },
    });

    // Initialize invoice settings if they don't exist
    await prisma.invoiceSettings.upsert({
      where: { shop: session.shop },
      update: {},
      create: {
        shop: session.shop,
        prefix: "INV",
        starting_number: 1,
        current_sequence: 0,
        reset_frequency: "YEARLY",
        template_type: "CLASSIC",
        due_days: 30,
        show_bank_details: true,
        show_signature: true,
        show_logo: true,
        show_hsn: true,
        show_customer_gst: true,
        auto_generate: false,
        auto_email: false,
      },
    });

    // Create default warehouse if none exists
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: { shop: session.shop },
    });

    if (!existingWarehouse) {
      await prisma.warehouse.create({
        data: {
          shop: session.shop,
          name: "Main Warehouse",
          address_line_1: data.address_line_1 as string,
          address_line_2: data.address_line_2 as string || undefined,
          city: data.city as string,
          state: data.state as string,
          state_code: data.state_code as string,
          pin_code: data.pin_code as string,
          gstin: data.gstin as string,
          phone: data.phone as string,
          email: data.email as string,
          is_default: true,
        },
      });
    }

    return json({
      success: true,
      settings: businessSettings,
      message: "Business settings saved successfully",
    });

  } catch (error) {
    console.error("Error saving business settings:", error);
    return json(
      { error: "Failed to save business settings" },
      { status: 500 }
    );
  }
};

export default function BusinessSettings() {
  const { settings, isConfigured, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [formData, setFormData] = useState(settings || {});

  const isLoading = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success;

  useEffect(() => {
    if (isSuccess) {
      shopify.toast.show("Business settings saved successfully!");
    }
  }, [isSuccess, shopify]);

  useEffect(() => {
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data?.error, shopify]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value) form.append(key, value as string);
    });
    fetcher.submit(form, { method: "POST" });
  };

  if (error) {
    return (
      <s-page heading="Business Settings - Error">
        <s-section>
          <s-banner status="critical">
            <s-text>Error: {error}</s-text>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Business Settings">
      <s-button 
        slot="primary-action" 
        variant="primary" 
        onClick={handleSubmit}
        {...(isLoading ? { loading: true } : {})}
      >
        Save Settings
      </s-button>

      {!isConfigured && (
        <s-section>
          <s-banner status="info">
            <s-text>Complete your business setup to start generating GST-compliant invoices.</s-text>
          </s-banner>
        </s-section>
      )}

      <s-section heading="Business Information">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Legal Business Name *"
            value={formData.legal_name || ""}
            onChange={(value) => handleInputChange("legal_name", value)}
            required
          />
          
          <s-text-field
            label="Trading Name (if different)"
            value={formData.trading_name || ""}
            onChange={(value) => handleInputChange("trading_name", value)}
          />
          
          <s-text-field
            label="GSTIN *"
            value={formData.gstin || ""}
            onChange={(value) => handleInputChange("gstin", value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            helpText="15-character GST Identification Number"
            required
          />
          
          <s-text-field
            label="State Code *"
            value={formData.state_code || ""}
            onChange={(value) => handleInputChange("state_code", value)}
            placeholder="27"
            helpText="2-digit state code from GSTIN"
            required
          />
        </s-stack>
      </s-section>

      <s-section heading="Address Details">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Address Line 1 *"
            value={formData.address_line_1 || ""}
            onChange={(value) => handleInputChange("address_line_1", value)}
            required
          />
          
          <s-text-field
            label="Address Line 2"
            value={formData.address_line_2 || ""}
            onChange={(value) => handleInputChange("address_line_2", value)}
          />
          
          <s-stack direction="inline" gap="base">
            <s-text-field
              label="City *"
              value={formData.city || ""}
              onChange={(value) => handleInputChange("city", value)}
              required
            />
            
            <s-text-field
              label="State *"
              value={formData.state || ""}
              onChange={(value) => handleInputChange("state", value)}
              required
            />
          </s-stack>
          
          <s-text-field
            label="PIN Code *"
            value={formData.pin_code || ""}
            onChange={(value) => handleInputChange("pin_code", value)}
            placeholder="400001"
            required
          />
        </s-stack>
      </s-section>

      <s-section heading="Contact Information">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Phone Number *"
            value={formData.phone || ""}
            onChange={(value) => handleInputChange("phone", value)}
            placeholder="+91 9876543210"
            required
          />
          
          <s-text-field
            label="Email Address *"
            value={formData.email || ""}
            onChange={(value) => handleInputChange("email", value)}
            type="email"
            required
          />
          
          <s-text-field
            label="Website"
            value={formData.website || ""}
            onChange={(value) => handleInputChange("website", value)}
            type="url"
            placeholder="https://example.com"
          />
        </s-stack>
      </s-section>

      <s-section heading="Bank Details (Optional)">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Bank Name"
            value={formData.bank_name || ""}
            onChange={(value) => handleInputChange("bank_name", value)}
          />
          
          <s-text-field
            label="Account Holder Name"
            value={formData.account_holder_name || ""}
            onChange={(value) => handleInputChange("account_holder_name", value)}
          />
          
          <s-text-field
            label="Account Number"
            value={formData.account_number || ""}
            onChange={(value) => handleInputChange("account_number", value)}
          />
          
          <s-stack direction="inline" gap="base">
            <s-text-field
              label="IFSC Code"
              value={formData.ifsc_code || ""}
              onChange={(value) => handleInputChange("ifsc_code", value.toUpperCase())}
              placeholder="SBIN0000123"
            />
            
            <s-select
              label="Account Type"
              value={formData.account_type || ""}
              onChange={(value) => handleInputChange("account_type", value)}
            >
              <s-option value="">Select Account Type</s-option>
              <s-option value="SAVINGS">Savings</s-option>
              <s-option value="CURRENT">Current</s-option>
            </s-select>
          </s-stack>
          
          <s-text-field
            label="Branch Name"
            value={formData.branch_name || ""}
            onChange={(value) => handleInputChange("branch_name", value)}
          />
        </s-stack>
      </s-section>

      <s-section heading="Authorized Signatory (Optional)">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Signatory Name"
            value={formData.signatory_name || ""}
            onChange={(value) => handleInputChange("signatory_name", value)}
          />
          
          <s-text-field
            label="Designation"
            value={formData.signatory_designation || ""}
            onChange={(value) => handleInputChange("signatory_designation", value)}
            placeholder="Director, Manager, etc."
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};