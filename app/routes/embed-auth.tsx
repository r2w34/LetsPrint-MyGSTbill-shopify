import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Shop parameter is required", { status: 400 });
  }

  console.log(`Embedded app OAuth request for shop: ${shop}`);
  
  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SCOPES || "write_products,read_customers,read_orders";
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/auth/callback`;
  const oauthUrl = `https://admin.shopify.com/store/${shop}/oauth/install?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return {
    shop,
    oauthUrl,
    apiKey,
    scopes,
    redirectUri
  };
};

export default function EmbedAuth() {
  const { shop, oauthUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    console.log("🚀 Embedded app iframe escape handler starting...");
    console.log("Shop:", shop);
    console.log("OAuth URL:", oauthUrl);
    
    // Check if we're in an iframe (embedded app)
    const isEmbedded = window.top !== window.self;
    console.log("Is embedded:", isEmbedded);
    
    if (isEmbedded) {
      console.log("✅ In iframe, attempting to escape...");
      
      // Method 1: Try to access parent window
      try {
        if (window.parent && window.parent.location) {
          console.log("🎯 Method 1: Redirecting parent window");
          window.parent.location.href = oauthUrl;
          return;
        }
      } catch (error) {
        console.warn("❌ Method 1 failed:", error);
      }
      
      // Method 2: Try to access top window
      try {
        if (window.top && window.top.location) {
          console.log("🎯 Method 2: Redirecting top window");
          window.top.location.href = oauthUrl;
          return;
        }
      } catch (error) {
        console.warn("❌ Method 2 failed:", error);
      }
      
      // Method 3: Post message to parent
      try {
        console.log("🎯 Method 3: Posting message to parent");
        window.parent.postMessage({
          type: 'SHOPIFY_APP_OAUTH_REDIRECT',
          url: oauthUrl,
          shop: shop
        }, '*');
        
        console.log("✅ Posted message to parent window");
      } catch (error) {
        console.error("❌ Method 3 failed:", error);
      }
      
      // Method 4: Use target="_top" link as fallback
      console.log("🎯 Method 4: Setting up fallback redirect in 3 seconds");
      setTimeout(function() {
        console.log("⏰ Fallback redirect executing...");
        const link = document.createElement('a');
        link.href = oauthUrl;
        link.target = '_top';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 3000);
    } else {
      // Not in iframe, redirect normally
      console.log("✅ Not embedded, redirecting normally...");
      window.location.href = oauthUrl;
    }
  }, [shop, oauthUrl]);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      margin: 0,
      background: '#f6f6f7',
      textAlign: 'center',
      padding: '20px'
    }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
      
      <h2 style={{ color: '#333', marginBottom: '10px' }}>
        🔗 Connecting to Shopify...
      </h2>
      <p style={{ color: '#666', margin: '10px 0' }}>
        Please wait while we set up your app authentication.
      </p>
      <div className="spinner"></div>
      <p style={{ fontSize: '14px', color: '#666', margin: '10px 0' }}>
        If you're not redirected automatically,{' '}
        <a 
          href={oauthUrl} 
          target="_top"
          style={{ color: '#3498db', textDecoration: 'none' }}
        >
          click here
        </a>.
      </p>
      
      <div style={{
        fontSize: '12px',
        color: '#999',
        marginTop: '20px',
        padding: '10px',
        background: '#f0f0f0',
        borderRadius: '5px',
        maxWidth: '600px'
      }}>
        <strong>Debug Info:</strong><br />
        Shop: {shop}<br />
        Embedded: Yes<br />
        OAuth URL: {oauthUrl.substring(0, 80)}...
      </div>
    </div>
  );
}