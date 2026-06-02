import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthBadge() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setName("");
      return;
    }
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? user.email ?? ""));
  }, [user]);

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur">
      {user ? (
        <>
          <span className="opacity-80">👤 {name}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
          >
            Выйти
          </button>
        </>
      ) : (
        <Link to="/auth" className="rounded-full bg-primary px-3 py-0.5 text-primary-foreground">
          Войти / Регистрация
        </Link>
      )}
    </div>
  );
}
