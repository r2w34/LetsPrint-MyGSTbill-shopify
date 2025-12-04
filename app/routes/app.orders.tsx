import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaClient } from "@prisma/client";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const cursor = url.searchParams.get("cursor") || undefined;
  const fulfillmentStatus = url.searchParams.get("fulfillment_status") || undefined;

  try {
    // Check if business settings are configured
    const businessSettings = await prisma.businessSettings.findUnique({
      where: { shop: session.shop },
    });

    if (!businessSettings?.gstin) {
      return json({
        isConfigured: false,
        orders: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
      });
    }

    // Build GraphQL query
    let query = `
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true`;

    // Add filters if provided
    const queryFilters = [];
    if (fulfillmentStatus) {
      queryFilters.push(`fulfillment_status:${fulfillmentStatus}`);
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
      isConfigured: true,
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

export default function Orders() {
  const { isConfigured, orders, pageInfo, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const handleSelectOrder = (orderId: string, selected: boolean) => {
    if (selected) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const eligibleOrders = orders
        .filter((order: any) => !order.invoice_status.exists && order.fulfillment_status === 'FULFILLED')
        .map((order: any) => order.id);
      setSelectedOrders(eligibleOrders);
    } else {
      setSelectedOrders([]);
    }
  };

  const handleBulkInvoiceGeneration = () => {
    if (selectedOrders.length === 0) {
      shopify.toast.show("Please select orders to generate invoices", { isError: true });
      return;
    }

    const formData = new FormData();
    formData.append("orderIds", JSON.stringify(selectedOrders));
    
    fetcher.submit(formData, {
      method: "POST",
      action: "/api/invoices",
    });
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(`Successfully generated ${fetcher.data.results.length} invoices!`);
      setSelectedOrders([]);
      // Reload the page to refresh order data
      window.location.reload();
    }
  }, [fetcher.data?.success, shopify]);

  useEffect(() => {
    if (fetcher.data?.errors?.length > 0) {
      shopify.toast.show(`${fetcher.data.errors.length} orders failed to generate invoices`, { isError: true });
    }
  }, [fetcher.data?.errors, shopify]);

  if (error) {
    return (
      <s-page heading="Orders - Error">
        <s-section>
          <s-banner status="critical">
            <s-text>Error: {error}</s-text>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  if (!isConfigured) {
    return (
      <s-page heading="Orders">
        <s-section>
          <s-banner status="warning">
            <s-text>⚠️ Setup Required</s-text>
            <s-paragraph>
              Please complete your business setup to start generating invoices.
            </s-paragraph>
            <s-button variant="primary" href="/app/settings/business">
              Complete Setup
            </s-button>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  const eligibleOrdersCount = orders.filter((order: any) => 
    !order.invoice_status.exists && order.fulfillment_status === 'FULFILLED'
  ).length;

  return (
    <s-page heading="Orders">
      {selectedOrders.length > 0 && (
        <s-button 
          slot="primary-action" 
          variant="primary" 
          onClick={handleBulkInvoiceGeneration}
          {...(fetcher.state === "submitting" ? { loading: true } : {})}
        >
          Generate {selectedOrders.length} Invoice{selectedOrders.length > 1 ? 's' : ''}
        </s-button>
      )}

      {eligibleOrdersCount > 0 && (
        <s-section>
          <s-banner status="info">
            <s-text>
              {eligibleOrdersCount} fulfilled orders are ready for invoice generation.
            </s-text>
          </s-banner>
        </s-section>
      )}

      <s-section>
        <s-card>
          <s-data-table>
            <s-table>
              <s-thead>
                <s-tr>
                  <s-th>
                    <s-checkbox
                      onChange={(checked) => handleSelectAll(checked)}
                      checked={selectedOrders.length > 0 && selectedOrders.length === eligibleOrdersCount}
                    />
                  </s-th>
                  <s-th>Order</s-th>
                  <s-th>Customer</s-th>
                  <s-th>Date</s-th>
                  <s-th>Items</s-th>
                  <s-th>Amount</s-th>
                  <s-th>Payment</s-th>
                  <s-th>Fulfillment</s-th>
                  <s-th>Invoice</s-th>
                </s-tr>
              </s-thead>
              <s-tbody>
                {orders.map((order: any) => {
                  const isEligible = !order.invoice_status.exists && order.fulfillment_status === 'FULFILLED';
                  const isSelected = selectedOrders.includes(order.id);
                  
                  return (
                    <s-tr key={order.id}>
                      <s-td>
                        <s-checkbox
                          checked={isSelected}
                          onChange={(checked) => handleSelectOrder(order.id, checked)}
                          disabled={!isEligible}
                        />
                      </s-td>
                      <s-td>
                        <s-text variant="body-md" fontWeight="semibold">
                          {order.name}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-stack direction="block" gap="tight">
                          <s-text>
                            {order.customer.first_name && order.customer.last_name ? 
                              `${order.customer.first_name} ${order.customer.last_name}`.trim() : 
                              'Guest'
                            }
                          </s-text>
                          {order.customer.email && (
                            <s-text variant="body-sm" color="subdued">
                              {order.customer.email}
                            </s-text>
                          )}
                        </s-stack>
                      </s-td>
                      <s-td>
                        <s-text>
                          {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-stack direction="block" gap="tight">
                          <s-text>{order.line_items_count} items</s-text>
                          {order.line_items_preview.length > 0 && (
                            <s-text variant="body-sm" color="subdued">
                              {order.line_items_preview.map((item: any) => 
                                `${item.title} (${item.quantity})`
                              ).join(', ')}
                            </s-text>
                          )}
                        </s-stack>
                      </s-td>
                      <s-td>
                        <s-text>
                          ₹{parseFloat(order.total_price).toLocaleString('en-IN')}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-badge 
                          status={order.financial_status === 'PAID' ? 'success' : 'warning'}
                        >
                          {order.financial_status}
                        </s-badge>
                      </s-td>
                      <s-td>
                        <s-badge 
                          status={order.fulfillment_status === 'FULFILLED' ? 'success' : 'warning'}
                        >
                          {order.fulfillment_status || 'UNFULFILLED'}
                        </s-badge>
                      </s-td>
                      <s-td>
                        {order.invoice_status.exists ? (
                          <s-badge status="success">
                            ✓ {order.invoice_status.invoice_number}
                          </s-badge>
                        ) : order.fulfillment_status === 'FULFILLED' ? (
                          <s-badge status="warning">
                            Ready
                          </s-badge>
                        ) : (
                          <s-badge status="subdued">
                            Pending
                          </s-badge>
                        )}
                      </s-td>
                    </s-tr>
                  );
                })}
              </s-tbody>
            </s-table>
          </s-data-table>
        </s-card>

        {pageInfo.hasNextPage && (
          <s-stack direction="inline" alignment="center">
            <s-button 
              variant="secondary" 
              href={`/app/orders?cursor=${orders[orders.length - 1]?.cursor}`}
            >
              Load More Orders
            </s-button>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};