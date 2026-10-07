/**
 * Novex Stream — secure TMDB proxy for Cloudflare Workers
 *
 * Required Worker secret:
 *   TMDB_API_KEY = your TMDB API key
 *
 * Optional:
 *   TMDB_ACCESS_TOKEN = your TMDB API Read Access Token
 */
const ALLOWED_ORIGIN = "https://novextech77-debug.github.io";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    const incoming = new URL(request.url);
    const endpoint = incoming.searchParams.get("endpoint");

    if (!endpoint || endpoint.includes("://") || endpoint.includes("..")) {
      return json({ error: "Invalid TMDB endpoint" }, 400, cors);
    }

    const tmdb = new URL(
      "https://api.themoviedb.org/3/" + endpoint.replace(/^\/+/, "")
    );

    incoming.searchParams.forEach((value, key) => {
      if (key !== "endpoint") tmdb.searchParams.set(key, value);
    });

    const options = {};

    if (env.TMDB_ACCESS_TOKEN) {
      options.headers = {
        Authorization: "Bearer " + env.TMDB_ACCESS_TOKEN
      };
    } else if (env.TMDB_API_KEY) {
      tmdb.searchParams.set("api_key", env.TMDB_API_KEY);
    } else {
      return json({ error: "TMDB credential is not configured" }, 500, cors);
    }

    const response = await fetch(tmdb.toString(), options);
    const body = await response.text();

    const headers = new Headers(cors);
    headers.set(
      "Content-Type",
      response.headers.get("Content-Type") || "application/json"
    );
    headers.set("Cache-Control", "public, max-age=60");

    return new Response(body, {
      status: response.status,
      headers
    });
  }
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });
}
