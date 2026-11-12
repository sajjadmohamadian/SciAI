import { type FormEvent, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { BRAND } from "../brand.js";
import { useAuth } from "../context/AuthContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { AlertBanner, Button, Input } from "./CommonUI.js";

export function LoginView() {
  const { login, logout, error: sessionError, signOutFailed } = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = () => {
    setMode(mode === "login" ? "reset" : "login");
    setPassword("");
    setToken("");
    setError("");
    setNotice("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await apiJson("/api/auth/reset", { token: token.trim(), new_password: password });
        setToken("");
        setMode("login");
        setNotice("Password reset successfully. Sign in with your new password.");
      }
      setPassword("");
    } catch (err) {
      setError(
        getApiErrorMessage(err, mode === "login" ? "Sign in failed." : "Password reset failed.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-dark px-4 py-8">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-border-default bg-surface-canvas p-8 shadow-elevated"
      >
        {/* Brand & Gate Header */}
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-ink-primary text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-ink-primary">
                {mode === "login" ? `${BRAND.name} sign in` : "Reset your password"}
              </h1>
              <span className="rounded-md border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary">
                {BRAND.version}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {BRAND.shellDescriptor || "Research Intelligence workspace"}
            </p>
          </div>
        </div>

        {/* Error & Status Feedback */}
        {(error || sessionError) && (
          <div className="mb-4">
            <AlertBanner tone="danger">{error || sessionError}</AlertBanner>
          </div>
        )}

        {signOutFailed && (
          <div className="mb-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void logout()}
              className="w-full"
            >
              Retry sign out
            </Button>
          </div>
        )}

        {notice && (
          <div className="mb-4">
            <AlertBanner tone="success">{notice}</AlertBanner>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {mode === "login" ? (
            <Input
              label="Email"
              required
              type="email"
              autoComplete="username"
              placeholder="researcher@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : (
            <>
              <p className="rounded-xl border border-border-subtle bg-surface-subtle p-3 text-xs leading-relaxed text-ink-secondary">
                Request a single-use token from your administrator and paste it here. Tokens expire
                and cannot be reused.
              </p>
              <Input
                label="Reset token"
                required
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste single-use reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </>
          )}

          <Input
            label={mode === "login" ? "Password" : "New password (12+ characters)"}
            required
            minLength={mode === "reset" ? 12 : undefined}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Enter your password" : "Minimum 12 characters"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={busy || signOutFailed}
            icon={<LogIn className="h-4 w-4" />}
            className="w-full"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Reset password"}
          </Button>

          <button
            disabled={busy || signOutFailed}
            type="button"
            onClick={switchMode}
            className="w-full py-1 text-center text-xs font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-brand-500 hover:underline disabled:opacity-50 cursor-pointer"
          >
            {mode === "login" ? "Use a password reset token" : "Back to sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}