import { type FormEvent, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";

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
    setPassword(""); setToken(""); setError(""); setNotice("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "login") await login(email.trim(), password);
      else {
        await apiJson("/api/auth/reset", { token: token.trim(), new_password: password });
        setToken(""); setMode("login");
        setNotice("Password reset successfully. Sign in with your new password.");
      }
      setPassword("");
    } catch (err) { setError(getApiErrorMessage(err, mode === "login" ? "Sign in failed." : "Password reset failed.")); }
    finally { setBusy(false); }
  };
  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm";
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-700 bg-white p-8 shadow-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-slate-900 p-3 text-white"><ShieldCheck className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-black text-slate-900">{mode === "login" ? "SciAI sign in" : "Reset your password"}</h1><p className="text-xs text-slate-500">Research Intelligence workspace</p></div>
      </div>
      {(error || sessionError) && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error || sessionError}</p>}
      {signOutFailed && <button type="button" onClick={() => void logout()} className="mb-4 text-sm font-semibold underline">Retry sign out</button>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {mode === "login" ? <label className="mb-3 block text-xs font-bold text-slate-700">Email<input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
        : <><p className="mb-3 text-xs text-slate-600">Request a single-use token from your administrator and paste it here. Tokens expire and cannot be reused.</p><label className="mb-3 block text-xs font-bold text-slate-700">Reset token<input required type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} /></label></>}
      <label className="mb-5 block text-xs font-bold text-slate-700">{mode === "login" ? "Password" : "New password (12+ characters)"}<input required minLength={mode === "reset" ? 12 : undefined} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} /></label>
      <button disabled={busy || signOutFailed} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><LogIn className="h-4 w-4" />{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Reset password"}</button>
      <button disabled={busy || signOutFailed} type="button" onClick={switchMode} className="mt-4 w-full text-xs font-semibold text-slate-600 underline">{mode === "login" ? "Use a password reset token" : "Back to sign in"}</button>
    </form>
  </main>;
}
