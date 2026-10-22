import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user) return;
      const { data: anonymous, error: anonymousError } = await supabase.auth.signInAnonymously();
      if (anonymousError || !anonymous.user) {
        console.error("[Auth] Anonymous session could not be created:", anonymousError);
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "to" in error) throw error;
      console.error("[Auth] Session initialization failed:", error);
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
