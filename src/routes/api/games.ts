import { createFileRoute } from "@tanstack/react-router";
import { queryDashGames } from "@/lib/dashboard";
import { authorizeDashboard, corsHeaders, jsonDash } from "@/lib/dashboard-http.server";

export const Route = createFileRoute("/api/games")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        if (!(await authorizeDashboard(request))) {
          return jsonDash(request, { success: false, error: "Unauthorized" }, 401);
        }
        const url = new URL(request.url);
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
        const { rows, total } = await queryDashGames({
          player: url.searchParams.get("player") || undefined,
          game: url.searchParams.get("game") || undefined,
          limit,
          offset,
          startDate: url.searchParams.get("startDate") || undefined,
          endDate: url.searchParams.get("endDate") || undefined,
        });
        return jsonDash(request, {
          success: true,
          data: rows,
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
        });
      },
    },
  },
});
