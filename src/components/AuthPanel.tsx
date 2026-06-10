import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup";

const getRedirectUrl = () => {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
};

export function AuthPanel() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(true);

  useEffect(() => {
    try {
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      void supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null);
      });

      return () => subscription.subscription.unsubscribe();
    } catch (err) {
      console.error(err);
      setAuthReady(false);
      return undefined;
    }
  }, []);

  const resetMessages = () => {
    setError(null);
    setStatus(null);
  };

  const submitEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(),
          },
        });

        if (signUpError) throw signUpError;
        setUser(data.user ?? null);
        setStatus(data.session ? "Account created." : "Check your email to confirm the account.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        setStatus("Signed in.");
      }

      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    resetMessages();
    setLoading(true);

    try {
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl(),
          skipBrowserRedirect: true,
        },
      });

      if (googleError) throw googleError;
      if (!data.url) throw new Error("Supabase did not return a Google login URL.");

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed.");
      setLoading(false);
    }
  };

  const signOut = async () => {
    resetMessages();
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed right-3 top-3 z-[9999] w-[min(calc(100vw-1.5rem),22rem)] text-white">
      <div className="rounded-lg border border-white/15 bg-black/65 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.25em] text-white/45">ACCOUNT</p>
            <p className="truncate text-sm font-bold">{user?.email ?? "Guest"}</p>
          </div>

          {user ? (
            <button
              type="button"
              onClick={signOut}
              disabled={loading}
              className="rounded-md border border-white/15 px-3 py-2 text-xs font-black tracking-widest text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              SIGN OUT
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setOpen((value) => !value);
              }}
              className="rounded-md bg-white px-3 py-2 text-xs font-black tracking-widest text-black transition hover:scale-105"
            >
              SIGN IN
            </button>
          )}
        </div>

        {!authReady && (
          <p className="mt-3 text-xs leading-relaxed text-red-200">
            Supabase env is not configured. Add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
            VITE_SUPABASE_URL, and VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy.
          </p>
        )}

        {!user && open && authReady && (
          <form onSubmit={submitEmailAuth} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-white/5 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  resetMessages();
                }}
                className={`rounded px-3 py-2 text-xs font-black tracking-widest transition ${
                  mode === "signin" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
                }`}
              >
                LOGIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  resetMessages();
                }}
                className={`rounded px-3 py-2 text-xs font-black tracking-widest transition ${
                  mode === "signup" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
                }`}
              >
                SIGN UP
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold tracking-widest text-white/55">EMAIL</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold tracking-widest text-white/55">PASSWORD</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300"
                placeholder="minimum 6 characters"
              />
            </label>

            {error && <p className="text-xs leading-relaxed text-red-200">{error}</p>}
            {status && <p className="text-xs leading-relaxed text-cyan-100">{status}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-cyan-300 px-4 py-3 text-sm font-black tracking-widest text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "LOGIN" : "CREATE ACCOUNT"}
            </button>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-3 text-sm font-black tracking-widest text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "OPENING GOOGLE..." : "CONTINUE WITH GOOGLE"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
