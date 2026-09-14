import { createFileRoute } from "@tanstack/react-router";
import { queryDashPlayers } from "@/lib/dashboard";
import { authorizeDashboard, corsHeaders, jsonDash } from "@/lib/dashboard-http.server";

export const Route = createFileRoute("/api/players")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        if (!(await authorizeDashboard(request))) {
          return jsonDash(request, { success: false, error: "Unauthorized" }, 401);
        }
        const data = await queryDashPlayers();
        return jsonDash(request, { success: true, data });
      },
    },
  },
});
