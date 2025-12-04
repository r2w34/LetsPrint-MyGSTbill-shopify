import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const fulfillmentStatus = url.searchParams.get("fulfillment_status") || undefined;
  const financialStatus = url.searchParams.get("financial_status") || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;

  try {
    // Build GraphQL query
    let query = `
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true`;

    // Add filters if provided
    const queryFilters = [];
    if (fulfillmentStatus) {
      queryFilters.push(`fulfillment_status:${fulfillmentStatus}`);
    }
    if (financialStatus) {
      queryFilters.push(`financial_status:${financialStatus}`);
    }

    if (queryFilters.length > 0) {
      query += `, query: "${queryFilters.join(' AND ')}"`;
    }

    query += `) {
          edges {
            node {
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
              lineItems(first: 5) {
                edges {
                  node {
                    id
                    title
                    quantity
                    product {
                      id
                      title
                    }
                  }
                }
              }
              tags
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: {
        first: limit,
        after: cursor,
      },
    });

    const orders = response.body?.data?.orders;

    if (!orders) {
      return json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Check which orders already have invoices
    const orderIds = orders.edges.map((edge: any) => edge.node.id);
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        shop: session.shop,
        order_id: { in: orderIds },
      },
      select: {
        order_id: true,
        invoice_number: true,
        status: true,
      },
    });

    const invoiceMap = new Map(
      existingInvoices.map(inv => [inv.order_id, inv])
    );

    // Transform orders and add invoice status
    const transformedOrders = orders.edges.map((edge: any) => {
      const order = edge.node;
      const existingInvoice = invoiceMap.get(order.id);

      return {
        id: order.id,
        name: order.name,
        email: order.email,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        total_price: order.totalPriceSet?.shopMoney?.amount || "0",
        currency: order.totalPriceSet?.shopMoney?.currencyCode || "INR",
        financial_status: order.financialStatus,
        fulfillment_status: order.fulfillmentStatus,
        customer: {
          id: order.customer?.id || "",
          email: order.customer?.email || "",
          first_name: order.customer?.firstName || "",
          last_name: order.customer?.lastName || "",
          phone: order.customer?.phone,
        },
        billing_address: order.billingAddress,
        shipping_address: order.shippingAddress,
        line_items_count: order.lineItems?.edges?.length || 0,
        line_items_preview: order.lineItems?.edges?.map((item: any) => ({
          title: item.node.title,
          quantity: item.node.quantity,
        })) || [],
        tags: order.tags,
        cursor: edge.cursor,
        // Invoice status
        invoice_status: existingInvoice ? {
          exists: true,
          invoice_number: existingInvoice.invoice_number,
          status: existingInvoice.status,
        } : {
          exists: false,
        },
      };
    });

    return json({
      orders: transformedOrders,
      pageInfo: orders.pageInfo,
    });

  } catch (error) {
    console.error("Error fetching orders:", error);
    return json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
};