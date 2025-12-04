import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "../lib/services/invoice-service";

const prisma = new PrismaClient();

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (topic !== "ORDERS_FULFILLED") {
      return new Response("Invalid webhook topic", { status: 400 });
    }

    console.log(`Received ${topic} webhook for shop ${shop}`);

    // Check if auto-generation is enabled
    const invoiceSettings = await prisma.invoiceSettings.findUnique({
      where: { shop },
    });

    if (!invoiceSettings?.auto_generate) {
      console.log("Auto-generation disabled for shop:", shop);
      return new Response("Auto-generation disabled", { status: 200 });
    }

    // Check if business settings are configured
    const businessSettings = await prisma.businessSettings.findUnique({
      where: { shop },
    });

    if (!businessSettings?.gstin) {
      console.log("Business settings not configured for shop:", shop);
      return new Response("Business settings not configured", { status: 200 });
    }

    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        shop,
        order_id: payload.id,
      },
    });

    if (existingInvoice) {
      console.log("Invoice already exists for order:", payload.id);
      return new Response("Invoice already exists", { status: 200 });
    }

    // Fetch complete order details from Shopify
    const orderResponse = await admin.graphql(`
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          email
          createdAt
          updatedAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          financialStatus
          fulfillmentStatus
          customer {
            id
            email
            firstName
            lastName
            phone
          }
          billingAddress {
            name
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          shippingAddress {
            name
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                name
                sku
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalDiscountSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                product {
                  id
                }
                variant {
                  id
                }
              }
            }
          }
          shippingLines(first: 10) {
            edges {
              node {
                id
                title
                priceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                code
              }
            }
          }
          discountCodes {
            code
            amount
            type
          }
          tags
        }
      }
    `, {
      variables: { id: `gid://shopify/Order/${payload.id}` }
    });

    const orderData = orderResponse.body?.data?.order;
    
    if (!orderData) {
      console.error("Order not found:", payload.id);
      return new Response("Order not found", { status: 404 });
    }

    // Transform Shopify GraphQL response to our format
    const transformedOrder = {
      id: orderData.id,
      name: orderData.name,
      email: orderData.email,
      created_at: orderData.createdAt,
      updated_at: orderData.updatedAt,
      total_price: orderData.totalPriceSet?.shopMoney?.amount || "0",
      subtotal_price: orderData.subtotalPriceSet?.shopMoney?.amount || "0",
      total_tax: orderData.totalTaxSet?.shopMoney?.amount || "0",
      currency: orderData.totalPriceSet?.shopMoney?.currencyCode || "INR",
      financial_status: orderData.financialStatus,
      fulfillment_status: orderData.fulfillmentStatus,
      customer: {
        id: orderData.customer?.id || "",
        email: orderData.customer?.email || "",
        first_name: orderData.customer?.firstName || "",
        last_name: orderData.customer?.lastName || "",
        phone: orderData.customer?.phone,
      },
      billing_address: orderData.billingAddress || {},
      shipping_address: orderData.shippingAddress || {},
      line_items: orderData.lineItems?.edges?.map((edge: any) => ({
        id: edge.node.id,
        product_id: edge.node.product?.id || "",
        variant_id: edge.node.variant?.id || "",
        title: edge.node.title,
        name: edge.node.name,
        sku: edge.node.sku || "",
        quantity: edge.node.quantity,
        price: edge.node.originalUnitPriceSet?.shopMoney?.amount || "0",
        total_discount: edge.node.totalDiscountSet?.shopMoney?.amount || "0",
        fulfillment_status: null,
        tax_lines: [],
      })) || [],
      shipping_lines: orderData.shippingLines?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.priceSet?.shopMoney?.amount || "0",
        code: edge.node.code,
        tax_lines: [],
      })) || [],
      tax_lines: [],
      discount_codes: orderData.discountCodes || [],
      tags: orderData.tags || "",
    };

    // Generate invoice
    const invoiceService = new InvoiceService(prisma);
    const result = await invoiceService.generateInvoice(
      shop,
      transformedOrder,
      {
        autoEmail: invoiceSettings.auto_email,
        templateType: invoiceSettings.template_type,
      }
    );

    console.log(`Successfully generated invoice ${result.invoiceId} for order ${payload.id}`);

    // Update Shopify order with invoice information (optional)
    try {
      await admin.graphql(`
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            id: orderData.id,
            tags: `${orderData.tags || ""} invoice-generated`.trim(),
          }
        }
      });
    } catch (updateError) {
      console.error("Failed to update order tags:", updateError);
      // Don't fail the webhook for this
    }

    return new Response("Invoice generated successfully", { status: 200 });

  } catch (error) {
    console.error("Error processing order fulfillment webhook:", error);
    
    // Return 500 so Shopify will retry the webhook
    return new Response("Internal server error", { status: 500 });
  }
};