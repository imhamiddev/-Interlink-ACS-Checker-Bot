import { handleApi } from "./api.js";
import leaderboardHtml from "./public/leaderboard.html";
import adminHtml from "./public/admin.html";
import themeCss from "./public/theme.css";

function html(body) {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function css(body) {
  return new Response(body, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      return handleApi(request, env);
    }

    if (path === "/leaderboard" || path === "/leaderboard/") {
      return html(leaderboardHtml);
    }

    if (path === "/admin" || path === "/admin/") {
      return html(adminHtml);
    }

    if (path === "/theme.css") {
      return css(themeCss);
    }

    return new Response("Not found", { status: 404 });
  },
};
