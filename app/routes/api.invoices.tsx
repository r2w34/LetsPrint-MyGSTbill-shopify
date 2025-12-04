import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "../lib/services/invoice-service";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") 
    ? new Date(url.searchParams.get("dateFrom")!) 
    : undefined;
  const dateTo = url.searchParams.get("dateTo") 
    ? new Date(url.searchParams.get("dateTo")!) 
    : undefined;

  const invoiceService = new InvoiceService(prisma);

  try {
    const result = await invoiceService.getInvoices(session.shop, {
      page,
      limit,
      status,
      search,
      dateFrom,
      dateTo,
    });

    return json(result);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const method = request.method;

  if (method === "POST") {
    return await handleCreateInvoice(request, session, admin);
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

async function handleCreateInvoice(request: Request, session: any, admin: any) {
  try {
    const body = await request.json();
    const { orderIds, options = {} } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json(
        { error: "Order IDs are required" },
        { status: 400 }
      );
    }

    const invoiceService = new InvoiceService(prisma);
    const results = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        // Fetch order from Shopify
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
          variables: { id: orderId }
        });

        const orderData = orderResponse.body?.data?.order;
        
        if (!orderData) {
          errors.push({
            orderId,
            error: "Order not found"
          });
          continue;
        }

        // Transform Shopify GraphQL response to our format
        const transformedOrder = transformShopifyOrder(orderData);

        // Generate invoice
        const result = await invoiceService.generateInvoice(
          session.shop,
          transformedOrder,
          options
        );

        results.push({
          orderId,
          invoiceId: result.invoiceId,
          success: true
        });

      } catch (error) {
        console.error(`Error generating invoice for order ${orderId}:`, error);
        errors.push({
          orderId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return json({
      success: results.length > 0,
      results,
      errors,
      summary: {
        total: orderIds.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error("Error in invoice creation:", error);
    return json(
      { error: "Failed to create invoices" },
      { status: 500 }
    );
  }
}

function transformShopifyOrder(shopifyOrder: any): any {
  return {
    id: shopifyOrder.id,
    name: shopifyOrder.name,
    email: shopifyOrder.email,
    created_at: shopifyOrder.createdAt,
    updated_at: shopifyOrder.updatedAt,
    total_price: shopifyOrder.totalPriceSet?.shopMoney?.amount || "0",
    subtotal_price: shopifyOrder.subtotalPriceSet?.shopMoney?.amount || "0",
    total_tax: shopifyOrder.totalTaxSet?.shopMoney?.amount || "0",
    currency: shopifyOrder.totalPriceSet?.shopMoney?.currencyCode || "INR",
    financial_status: shopifyOrder.financialStatus,
    fulfillment_status: shopifyOrder.fulfillmentStatus,
    customer: {
      id: shopifyOrder.customer?.id || "",
      email: shopifyOrder.customer?.email || "",
      first_name: shopifyOrder.customer?.firstName || "",
      last_name: shopifyOrder.customer?.lastName || "",
      phone: shopifyOrder.customer?.phone,
    },
    billing_address: shopifyOrder.billingAddress || {},
    shipping_address: shopifyOrder.shippingAddress || {},
    line_items: shopifyOrder.lineItems?.edges?.map((edge: any) => ({
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
    shipping_lines: shopifyOrder.shippingLines?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      price: edge.node.priceSet?.shopMoney?.amount || "0",
      code: edge.node.code,
      tax_lines: [],
    })) || [],
    tax_lines: [],
    discount_codes: shopifyOrder.discountCodes || [],
    tags: shopifyOrder.tags || "",
  };
}