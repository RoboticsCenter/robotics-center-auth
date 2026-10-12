import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Sign out",
};

type Props = {
  searchParams: Promise<{ return_to?: string }>;
};

export default async function LogoutPage({ searchParams }: Props) {
  const { return_to: returnTo } = await searchParams;

  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary">
        <div className="secondary-heading">
          <p className="eyebrow">Secure sign out</p>
          <h1>Sign out everywhere?</h1>
          <p>
            This ends your Robotics Center session in this browser and revokes
            the shared session used by connected applications.
          </p>
        </div>
        <form className="auth-form" action="/api/logout" method="post">
          {returnTo ? (
            <input type="hidden" name="return_to" value={returnTo} />
          ) : null}
          <button className="primary-button" type="submit">
            Sign out
          </button>
        </form>
        <Link className="back-link" href="/launcher">
          Keep me signed in
        </Link>
      </section>
    </AuthShell>
  );
}
