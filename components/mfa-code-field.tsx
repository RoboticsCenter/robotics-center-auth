export function MfaCodeField({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <label className="field-label">
      <span>6-digit code</span>
      <input
        className="text-input mfa-code-input"
        type="text"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        placeholder="123 456"
        autoFocus={autoFocus}
        required
      />
    </label>
  );
}
