import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTHORIZED_EMAIL = "madeprimermarketing@gmail.com";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
      if (data.user.email?.toLowerCase() !== AUTHORIZED_EMAIL) {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "to" in error) throw error;
      console.error("[Auth] Session check failed; sending user to login:", error);
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
