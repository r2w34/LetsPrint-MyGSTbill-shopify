import { useRouteError, isRouteErrorResponse } from "react-router";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <s-page heading="Application Error">
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text variant="headingLg">
              {error.status} {error.statusText}
            </s-text>
            {error.data && (
              <s-box padding="base" borderWidth="base" borderRadius="base" background="critical-subdued">
                <s-text variant="bodyMd">{error.data}</s-text>
              </s-box>
            )}
            <s-button 
              onClick={() => window.location.reload()}
              variant="primary"
            >
              Reload Page
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  let errorMessage = "Unknown error";
  if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <s-page heading="Application Error">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-text variant="headingLg">Something went wrong</s-text>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="critical-subdued">
            <s-text variant="bodyMd">{errorMessage}</s-text>
          </s-box>
          <s-stack direction="inline" gap="base">
            <s-button 
              onClick={() => window.location.reload()}
              variant="primary"
            >
              Reload Page
            </s-button>
            <s-button 
              onClick={() => window.history.back()}
              variant="secondary"
            >
              Go Back
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}