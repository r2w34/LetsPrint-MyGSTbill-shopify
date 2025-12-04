import { useEffect } from "react";

export function EmbeddedAppListener() {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from our app
      if (event.data && event.data.type === 'SHOPIFY_APP_OAUTH_REDIRECT') {
        console.log('Received OAuth redirect message:', event.data);
        
        // Redirect the parent window to the OAuth URL
        if (event.data.url) {
          window.location.href = event.data.url;
        }
      }
    };

    // Listen for messages from embedded iframe
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return null; // This component doesn't render anything
}