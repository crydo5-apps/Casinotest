import { createFileRoute } from "@tanstack/react-router";
import { queryLatestGame } from "@/lib/dashboard";
import { authorizeDashboard, corsHeaders, jsonDash } from "@/lib/dashboard-http.server";

export const Route = createFileRoute("/api/games/latest")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        if (!(await authorizeDashboard(request))) {
          return jsonDash(request, { success: false, error: "Unauthorized" }, 401);
        }
        const latest = await queryLatestGame();
        if (!latest) return jsonDash(request, { success: false, error: "No games found" }, 404);
        return jsonDash(request, { success: true, data: latest });
      },
    },
  },
});
