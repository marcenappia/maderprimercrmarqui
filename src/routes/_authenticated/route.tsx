import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Temporary single-operator mode.
 *
 * Authentication is intentionally bypassed while the CRM's auth service is
 * being repaired. Do not use this mode for a public or multi-user deployment.
 * Restore the authenticated route guard before inviting other users.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => <Outlet />,
});
