import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";

interface ErrorScreenProps {
  error?: Error;
  reset?: () => void;
}

export function ErrorScreen({ error, reset }: ErrorScreenProps) {
  const router = useRouter();

  return (
    <div className="error-page">
      <div className="error-card">
        <AlertTriangle size={64} className="error-icon error-icon--alert" />
        <h1 className="error-code error-code--small">{m.error_ooops()}</h1>
        <h2 className="error-title">{m.error_default_title()}</h2>
        <p className="error-desc">{m.error_default_desc()}</p>

        {error && import.meta.env.DEV && (
          <details className="error-details">
            <summary className="error-details-summary">{m.error_details()}</summary>
            <pre className="error-details-pre">{error.message}</pre>
          </details>
        )}

        <div className="error-actions">
          {reset && (
            <button className="error-btn error-btn--secondary" type="button" onClick={reset}>
              <RefreshCw size={18} />
              {m.error_retry()}
            </button>
          )}
          <button
            className="error-btn"
            type="button"
            onClick={() => {
              router.invalidate();
            }}
          >
            <Home size={18} />
            {m.error_go_home()}
          </button>
        </div>
      </div>
    </div>
  );
}
