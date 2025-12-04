import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "../lib/services/invoice-service";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    // Check if business settings are configured
    const businessSettings = await prisma.businessSettings.findUnique({
      where: { shop: session.shop },
    });

    const isConfigured = !!businessSettings?.gstin;

    let stats = null;
    let recentOrders = null;

    if (isConfigured) {
      // Get invoice statistics
      const invoiceService = new InvoiceService(prisma);
      stats = await invoiceService.getInvoiceStats(session.shop);

      // Get recent orders
      const ordersResponse = await admin.graphql(`
        query getRecentOrders {
          orders(first: 10, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                financialStatus
                fulfillmentStatus
                customer {
                  firstName
                  lastName
                  email
                }
              }
            }
          }
        }
      `);

      recentOrders = ordersResponse.body?.data?.orders?.edges?.map((edge: any) => edge.node) || [];

      // Check which orders have invoices
      const orderIds = recentOrders.map((order: any) => order.id);
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

      recentOrders = recentOrders.map((order: any) => ({
        ...order,
        invoice: invoiceMap.get(order.id) || null,
      }));
    }

    return {
      isConfigured,
      stats,
      recentOrders,
    };
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return {
      isConfigured: false,
      stats: null,
      recentOrders: null,
      error: "Failed to load dashboard data",
    };
  }
};

export default function Dashboard() {
  const { isConfigured, stats, recentOrders, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <s-page heading="LetsPrint - Error">
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
      <s-page heading="Welcome to LetsPrint">
        <s-section>
          <s-paragraph>
            GST Invoice & Shipping Label App for Indian Merchants
          </s-paragraph>
          
          <s-banner status="warning">
            <s-text>⚠️ Setup Required</s-text>
            <s-paragraph>
              Please complete your business setup to start generating GST-compliant invoices and shipping labels.
            </s-paragraph>
            <s-button variant="primary" href="/app/settings/business">
              Complete Setup
            </s-button>
          </s-banner>
        </s-section>

        <s-section heading="Features">
          <s-unordered-list>
            <s-list-item>✅ GST-compliant invoice generation</s-list-item>
            <s-list-item>✅ Automatic tax calculation (CGST, SGST, IGST)</s-list-item>
            <s-list-item>✅ Professional shipping labels</s-list-item>
            <s-list-item>✅ HSN code mapping</s-list-item>
            <s-list-item>✅ Multi-warehouse support</s-list-item>
            <s-list-item>✅ Automated workflows</s-list-item>
            <s-list-item>✅ Email notifications</s-list-item>
            <s-list-item>✅ Comprehensive reports</s-list-item>
          </s-unordered-list>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="LetsPrint Dashboard">
      {/* Quick Stats */}
      {stats && (
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-card>
              <s-stack direction="block" gap="tight">
                <s-text variant="heading-lg" color="success">
                  {stats.this_month_invoices}
                </s-text>
                <s-text variant="body-sm" color="subdued">
                  Invoices This Month
                </s-text>
              </s-stack>
            </s-card>
            
            <s-card>
              <s-stack direction="block" gap="tight">
                <s-text variant="heading-lg" color="warning">
                  {stats.pending_invoices}
                </s-text>
                <s-text variant="body-sm" color="subdued">
                  Pending Invoices
                </s-text>
              </s-stack>
            </s-card>
            
            <s-card>
              <s-stack direction="block" gap="tight">
                <s-text variant="heading-lg" color="success">
                  ₹{stats.total_revenue.toLocaleString('en-IN')}
                </s-text>
                <s-text variant="body-sm" color="subdued">
                  Total Revenue
                </s-text>
              </s-stack>
            </s-card>
            
            <s-card>
              <s-stack direction="block" gap="tight">
                <s-text variant="heading-lg" color="primary">
                  ₹{stats.total_gst_collected.toLocaleString('en-IN')}
                </s-text>
                <s-text variant="body-sm" color="subdued">
                  GST Collected
                </s-text>
              </s-stack>
            </s-card>
          </s-stack>
        </s-section>
      )}

      {/* Quick Actions */}
      <s-section heading="Quick Actions">
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" href="/app/invoices/generate">
            📄 Generate Invoices
          </s-button>
          
          <s-button variant="secondary" href="/app/labels/generate">
            📦 Generate Labels
          </s-button>
          
          <s-button variant="secondary" href="/app/orders">
            📋 View Orders
          </s-button>
          
          <s-button variant="secondary" href="/app/reports">
            📊 View Reports
          </s-button>
        </s-stack>
      </s-section>

      {/* Recent Orders */}
      {recentOrders && recentOrders.length > 0 && (
        <s-section heading="Recent Orders">
          <s-card>
            <s-data-table>
              <s-table>
                <s-thead>
                  <s-tr>
                    <s-th>Order</s-th>
                    <s-th>Customer</s-th>
                    <s-th>Date</s-th>
                    <s-th>Amount</s-th>
                    <s-th>Status</s-th>
                    <s-th>Invoice</s-th>
                  </s-tr>
                </s-thead>
                <s-tbody>
                  {recentOrders.map((order: any) => (
                    <s-tr key={order.id}>
                      <s-td>
                        <s-text variant="body-md" fontWeight="semibold">
                          {order.name}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-text>
                          {order.customer ? 
                            `${order.customer.firstName} ${order.customer.lastName}`.trim() : 
                            'Guest'
                          }
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-text>
                          {new Date(order.createdAt).toLocaleDateString('en-IN')}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-text>
                          ₹{parseFloat(order.totalPriceSet?.shopMoney?.amount || '0').toLocaleString('en-IN')}
                        </s-text>
                      </s-td>
                      <s-td>
                        <s-badge 
                          status={order.fulfillmentStatus === 'FULFILLED' ? 'success' : 'warning'}
                        >
                          {order.fulfillmentStatus || 'UNFULFILLED'}
                        </s-badge>
                      </s-td>
                      <s-td>
                        {order.invoice ? (
                          <s-badge status="success">
                            ✓ {order.invoice.invoice_number}
                          </s-badge>
                        ) : (
                          <s-badge status="warning">
                            Pending
                          </s-badge>
                        )}
                      </s-td>
                    </s-tr>
                  ))}
                </s-tbody>
              </s-table>
            </s-data-table>
          </s-card>
          
          <s-stack direction="inline" alignment="center">
            <s-link href="/app/orders">
              View All Orders →
            </s-link>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
