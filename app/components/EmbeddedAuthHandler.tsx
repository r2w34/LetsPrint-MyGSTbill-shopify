import { useEffect } from "react";

interface EmbeddedAuthHandlerProps {
  oauthUrl: string;
  shop: string;
}

export function EmbeddedAuthHandler({ oauthUrl, shop }: EmbeddedAuthHandlerProps) {
  useEffect(() => {
    const handleEmbeddedAuth = () => {
      // Check if we're in an iframe (embedded app)
      const isEmbedded = window.top !== window.self;
      
      if (isEmbedded) {
        console.log("Embedded app detected, escaping iframe for OAuth...");
        
        // Use App Bridge to escape iframe and redirect to OAuth
        // This prevents ERR_BLOCKED_BY_RESPONSE errors
        try {
          // Method 1: Use parent window to redirect
          if (window.parent && window.parent.location) {
            window.parent.location.href = oauthUrl;
            return;
          }
        } catch (error) {
          console.warn("Could not access parent window:", error);
        }
        
        try {
          // Method 2: Use top window to redirect
          if (window.top && window.top.location) {
            window.top.location.href = oauthUrl;
            return;
          }
        } catch (error) {
          console.warn("Could not access top window:", error);
        }
        
        // Method 3: Post message to parent to handle redirect
        try {
          window.parent.postMessage({
            type: 'SHOPIFY_APP_OAUTH_REDIRECT',
            url: oauthUrl,
            shop: shop
          }, '*');
          
          // Show user message while waiting for redirect
          document.body.innerHTML = `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 20px;
            ">
              <h2>Redirecting to Shopify...</h2>
              <p>Please wait while we redirect you to complete the app installation.</p>
              <p style="color: #666; font-size: 14px;">
                If you're not redirected automatically, 
                <a href="${oauthUrl}" target="_top">click here</a>.
              </p>
            </div>
          `;
        } catch (error) {
          console.error("Failed to post message to parent:", error);
          // Fallback: try direct redirect anyway
          window.location.href = oauthUrl;
        }
      } else {
        // Not in iframe, safe to redirect normally
        console.log("Not embedded, redirecting normally...");
        window.location.href = oauthUrl;
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(handleEmbeddedAuth, 100);
    
    return () => clearTimeout(timer);
  }, [oauthUrl, shop]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h2>Connecting to Shopify...</h2>
      <p>Please wait while we set up your app authentication.</p>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '20px auto'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}