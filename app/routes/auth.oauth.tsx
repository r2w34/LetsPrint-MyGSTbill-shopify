import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { EmbeddedAuthHandler } from "../components/EmbeddedAuthHandler";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Shop parameter is required", { status: 400 });
  }

  // Manually construct the OAuth URL to avoid automatic redirects
  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SCOPES || "write_products,read_customers,read_orders";
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/auth/callback`;
  
  const oauthUrl = `https://admin.shopify.com/store/${shop}/oauth/install?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  console.log(`Generated OAuth URL for embedded app - shop: ${shop}`);
  
  return {
    oauthUrl,
    shop,
    embedded: url.searchParams.get("embedded") === "1",
  };
};

export default function AuthOAuth() {
  const { oauthUrl, shop } = useLoaderData<typeof loader>();

  return <EmbeddedAuthHandler oauthUrl={oauthUrl} shop={shop} />;
}