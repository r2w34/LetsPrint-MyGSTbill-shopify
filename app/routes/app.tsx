import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Try to authenticate first
    await authenticate.admin(request);
    
    // If authentication succeeds, return the API key
    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    // If authentication fails, check if this is an embedded app installation request
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    
    if (shop) {
      // Redirect to embedded auth handler to prevent iframe blocking
      throw new Response(null, {
        status: 302,
        headers: {
          Location: `/embed-auth?shop=${shop}`,
        },
      });
    }
    
    // If no shop parameter and authentication failed, re-throw the error
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/orders">Orders</s-link>
        <s-link href="/app/invoices">Invoices</s-link>
        <s-link href="/app/labels">Labels</s-link>
        <s-link href="/app/products">Products & HSN</s-link>
        <s-link href="/app/reports">Reports</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
