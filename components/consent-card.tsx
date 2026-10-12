type ConsentCardProps = {
  clientName: string;
  scopes: string[];
  eyebrow?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
};

const scopeLabels: Record<string, string> = {
  openid: "Account identity",
  email: "Email address",
  profile: "Name and profile",
};

export function ConsentCard({
  clientName,
  scopes,
  eyebrow = "Connect your account",
  title = `Continue to ${clientName}`,
  description = "Allow this trusted Robotics Center application to use the account information listed below.",
  children,
}: ConsentCardProps) {
  return (
    <section
      className="auth-card auth-card-secondary consent-card"
      aria-labelledby="consent-title"
    >
      <div className="secondary-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="consent-title">{title}</h1>
        <p>{description}</p>
      </div>
      {scopes.length > 0 && (
        <ul className="consent-scopes" aria-label="Account information requested">
          {scopes.map((scope) => (
            <li key={scope}>{scopeLabels[scope] ?? scope}</li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
