import type { LoaderFunctionArgs } from "react-router";

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
  
  // Return HTML that handles iframe escape
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connecting to Shopify</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f6f6f7;
            text-align: center;
            padding: 20px;
        }
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
        h2 { color: #333; margin-bottom: 10px; }
        p { color: #666; margin: 10px 0; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .debug { 
            font-size: 12px; 
            color: #999; 
            margin-top: 20px; 
            padding: 10px;
            background: #f0f0f0;
            border-radius: 5px;
            max-width: 600px;
        }
    </style>
</head>
<body>
    <h2>🔗 Connecting to Shopify...</h2>
    <p>Please wait while we set up your app authentication.</p>
    <div class="spinner"></div>
    <p style="font-size: 14px;">
        If you're not redirected automatically, 
        <a href="${oauthUrl}" target="_top">click here</a>.
    </p>
    
    <div class="debug">
        <strong>Debug Info:</strong><br>
        Shop: ${shop}<br>
        Embedded: Yes<br>
        OAuth URL: ${oauthUrl.substring(0, 80)}...
    </div>
    
    <script>
        (function() {
            const oauthUrl = "${oauthUrl}";
            const shop = "${shop}";
            
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
        })();
    </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
};

export default function EmbedAuth() {
  // This component won't be rendered since we return HTML from the loader
  return null;
}