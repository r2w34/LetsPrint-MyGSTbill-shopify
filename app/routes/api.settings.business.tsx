import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schema for business settings
const BusinessSettingsSchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  trading_name: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format"),
  state_code: z.string().min(2, "State code is required"),
  address_line_1: z.string().min(1, "Address line 1 is required"),
  address_line_2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pin_code: z.string().regex(/^[1-9][0-9]{5}$/, "Invalid PIN code format"),
  country: z.string().default("India"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email format"),
  website: z.string().url().optional().or(z.literal("")),
  bank_name: z.string().optional(),
  account_holder_name: z.string().optional(),
  account_number: z.string().optional(),
  ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional().or(z.literal("")),
  branch_name: z.string().optional(),
  account_type: z.enum(["SAVINGS", "CURRENT"]).optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
  signature_url: z.string().url().optional().or(z.literal("")),
  signatory_name: z.string().optional(),
  signatory_designation: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const businessSettings = await prisma.businessSettings.findUnique({
      where: { shop: session.shop },
    });

    if (!businessSettings) {
      return json({ settings: null, isConfigured: false });
    }

    return json({ 
      settings: businessSettings, 
      isConfigured: true 
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
  const method = request.method;

  if (method === "POST" || method === "PUT") {
    return await handleSaveSettings(request, session);
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

async function handleSaveSettings(request: Request, session: any) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = BusinessSettingsSchema.safeParse(body);
    
    if (!validationResult.success) {
      return json(
        { 
          error: "Validation failed", 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Save or update business settings
    const businessSettings = await prisma.businessSettings.upsert({
      where: { shop: session.shop },
      update: {
        ...validatedData,
        updated_at: new Date(),
      },
      create: {
        shop: session.shop,
        ...validatedData,
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
          address_line_1: validatedData.address_line_1,
          address_line_2: validatedData.address_line_2,
          city: validatedData.city,
          state: validatedData.state,
          state_code: validatedData.state_code,
          pin_code: validatedData.pin_code,
          gstin: validatedData.gstin,
          phone: validatedData.phone,
          email: validatedData.email,
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
}