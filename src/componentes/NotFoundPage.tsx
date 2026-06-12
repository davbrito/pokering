import { Link } from "@tanstack/react-router";
import { ArrowLeft, Frown } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";

export function NotFoundPage() {
  return (
    <div className="error-page">
      <div className="error-card">
        <Frown size={64} className="error-icon" />
        <h1 className="error-code">404</h1>
        <h2 className="error-title">{m.error_not_found_title()}</h2>
        <p className="error-desc">{m.error_not_found_desc()}</p>
        <Link to="/" className="error-btn">
          <ArrowLeft size={18} />
          {m.error_go_home()}
        </Link>
      </div>
    </div>
  );
}
