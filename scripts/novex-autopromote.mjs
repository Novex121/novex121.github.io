import fs from "node:fs/promises";

const SITE = "https://novextech77-debug.github.io/novex121.github.io/";
const CHANNEL = "https://whatsapp.com/channel/0029Vb9JkUrBPzjRTRPSb71Y";
const API_KEY = process.env.TMDB_API_KEY || "";
const TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const today = new Date();
const dateLabel = new Intl.DateTimeFormat("en-ZM", { dateStyle: "long", timeZone: "Africa/Lusaka" }).format(today);
const isFriday = today.toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Lusaka" }) === "Friday";

async function tmdb(path) {
  const headers = { accept: "application/json" };
  let url = "https://api.themoviedb.org/3" + path;
  if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
  else if (API_KEY) url += (url.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(API_KEY);
  else throw new Error("Missing TMDB_API_KEY or TMDB_ACCESS_TOKEN GitHub Actions secret.");
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error("TMDB request failed: " + response.status + " " + path);
  return response.json();
}

function esc(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function titleOf(item) { return item.title || item.name || item.original_title || item.original_name || "Untitled"; }
function yearOf(item) {
  const d = item.release_date || item.first_air_date || "";
  return d ? d.slice(0, 4) : "New";
}
function kindOf(item) { return item.media_type === "tv" || item.first_air_date ? "Series" : "Movie"; }
function ratingOf(item) { return Number(item.vote_average || 0).toFixed(1); }
function posterUrl(item) { return item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : ""; }

async function loadState() {
  try { return JSON.parse(await fs.readFile("promotions/seen-titles.json", "utf8")); }
  catch { return { seen: [] }; }
}
async function writePoster(item, filename, eyebrow = "NEW ON NOVEX") {
  const title = titleOf(item);
  const subtitle = [yearOf(item), kindOf(item), "★ " + ratingOf(item)].join("  •  ");
  const poster = posterUrl(item);
  const posterMarkup = poster
    ? '<image href="' + esc(poster) + '" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" opacity="0.64"/>'
    : '<rect width="1080" height="1350" fill="#19172a"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#100d1b" stop-opacity=".18"/><stop offset=".56" stop-color="#100d1b" stop-opacity=".6"/><stop offset="1" stop-color="#08070d" stop-opacity="1"/></linearGradient></defs>
  <rect width="1080" height="1350" fill="#100d1b"/> ${posterMarkup}
  <rect width="1080" height="1350" fill="url(#shade)"/>
  <rect x="64" y="66" width="10" height="70" rx="5" fill="#ff2638"/>
  <text x="98" y="112" font-family="Arial,sans-serif" font-size="43" font-weight="800" fill="#fff">NOVEX <tspan fill="#ff2638">STREAM</tspan></text>
  <text x="68" y="860" font-family="Arial,sans-serif" font-size="28" font-weight="700" letter-spacing="6" fill="#ff5261">${esc(eyebrow)}</text>
  <text x="68" y="950" font-family="Arial,sans-serif" font-size="${title.length > 25 ? 54 : 70}" font-weight="800" fill="#fff">${esc(title.slice(0, 38))}</text>
  <text x="70" y="1005" font-family="Arial,sans-serif" font-size="28" fill="#e7e3ee">${esc(subtitle)}</text>
  <foreignObject x="68" y="1045" width="930" height="130"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#eee;font-size:25px;line-height:1.35">${esc((item.overview || "Discover your next favourite on Novex Stream.").slice(0, 150))}</div></foreignObject>
  <rect x="68" y="1200" width="340" height="76" rx="38" fill="#ff2638"/><text x="238" y="1248" text-anchor="middle" font-family="Arial,sans-serif" font-size="29" font-weight="800" fill="#fff">WATCH ON NOVEX</text>
  <text x="68" y="1312" font-family="Arial,sans-serif" font-size="20" fill="#c8c2d4">Open the Novex Stream website • Availability may vary</text>
  </svg>`;
  await fs.writeFile(filename, svg, "utf8");
}

async function main() {
  if (!API_KEY && !TOKEN) throw new Error("Set TMDB_API_KEY or TMDB_ACCESS_TOKEN in repository Settings → Secrets and variables → Actions.");
  await fs.mkdir("promotions/posters", { recursive: true });
  const [trendingMovies, trendingTV, nowPlaying, popularTV] = await Promise.all([
    tmdb("/trending/movie/week?language=en-US"),
    tmdb("/trending/tv/week?language=en-US"),
    tmdb("/movie/now_playing?language=en-US&page=1"),
    tmdb("/tv/on_the_air?language=en-US&page=1")
  ]);
  const combine = [
    ...(nowPlaying.results || []).map(x => ({...x, media_type:"movie"})),
    ...(popularTV.results || []).map(x => ({...x, media_type:"tv"})),
    ...(trendingMovies.results || []).map(x => ({...x, media_type:"movie"})),
    ...(trendingTV.results || []).map(x => ({...x, media_type:"tv"}))
  ];
  const unique = [...new Map(combine.filter(x => x.poster_path && x.overview).map(x => [String(x.media_type)+":"+x.id, x])).values()];
  const state = await loadState();
  const seen = new Set(state.seen || []);
  const fresh = unique.filter(x => !seen.has(String(x.media_type)+":"+x.id)).slice(0, 3);
  const picks = fresh.length ? fresh : unique.slice(0, 3);
  let post = `🍿✨ WHAT'S NEW & TRENDING ON NOVEX STREAM\n📅 ${dateLabel}\n\n`;
  for (const item of picks) {
    post += `🎬 ${titleOf(item)} (${yearOf(item)})\n⭐ TMDB rating: ${ratingOf(item)}/10 • ${kindOf(item)}\n${(item.overview || "").slice(0, 180).trim()}\n\n`;
  }
  post += `▶️ Explore on Novex: ${SITE}\n📲 Join the Novex WhatsApp Channel for updates: ${CHANNEL}\n\n#NovexStream #WhatToWatch`;
  await fs.writeFile("promotions/whatsapp-daily-post.txt", post, "utf8");
  for (let i=0;i<picks.length;i++) {
    const item = picks[i];
    const file = "promotions/posters/daily-" + (i+1) + "-" + item.id + ".svg";
    await writePoster(item, file, fresh.length ? "NEW ON NOVEX" : "TRENDING ON NOVEX");
  }
  if (isFriday) {
    const watchlist = unique.slice(0, 5);
    let weekend = `🎉 YOUR NOVEX WEEKEND WATCHLIST\n\nA little something for your next watch session:\n\n`;
    for (const item of watchlist) weekend += `🍿 ${titleOf(item)} (${yearOf(item)}) — ${kindOf(item)}, ⭐ ${ratingOf(item)}/10\n`;
    weekend += `\nFind these and more on Novex: ${SITE}\nJoin our channel: ${CHANNEL}\n\nWhat are you watching this weekend? 👇\n#NovexWeekend #NovexStream`;
    await fs.writeFile("promotions/whatsapp-weekend-watchlist.txt", weekend, "utf8");
    if (watchlist[0]) await writePoster(watchlist[0], "promotions/posters/weekend-watchlist.svg", "WEEKEND WATCHLIST");
  }
  const nextSeen = [...new Set([...(state.seen || []), ...unique.map(x => String(x.media_type)+":"+x.id)])].slice(-1000);
  await fs.writeFile("promotions/seen-titles.json", JSON.stringify({ updatedAt: new Date().toISOString(), seen: nextSeen }, null, 2) + "\n");
  const readme = `# Novex AutoPromote\n\nGenerated automatically on ${dateLabel}.\n\n- Daily WhatsApp-ready copy: ` + "`whatsapp-daily-post.txt`" + `\n- Weekend watchlist on Fridays: ` + "`whatsapp-weekend-watchlist.txt`" + `\n- Branded poster artwork: ` + "`posters/`" + `\n\nContent is prepared for review/manual posting. This workflow does not publish to WhatsApp because no authorized WhatsApp Channels publishing integration is configured. Confirm titles are available in the Novex catalogue before posting.\n\nSite: ${SITE}\nChannel: ${CHANNEL}\n`;
  await fs.writeFile("promotions/README.md", readme, "utf8");
  console.log(`Generated promotion copy and ${picks.length} poster(s). New titles detected: ${fresh.length}.`);
}
main().catch(error => { console.error(error); process.exit(1); });
