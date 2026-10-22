import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
    } catch (error) {
      // A transient auth/network failure should not strand the user on the root error page.
      if (typeof error === "object" && error !== null && "to" in error) throw error;
      console.error("[Auth] Session check failed; sending user to login:", error);
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
