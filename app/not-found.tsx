import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function NotFound() {
  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary error-card">
        <p className="error-code">404</p>
        <div className="secondary-heading">
          <h1>Page not found</h1>
          <p>The page you were looking for isn’t part of the login portal.</p>
        </div>
        <Link className="primary-button button-link" href="/">
          Return to sign in
        </Link>
      </section>
    </AuthShell>
  );
}
