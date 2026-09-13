"use strict";

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const GAME_ROOT = path.resolve(__dirname);
const GAME_PORT = Number(process.env.SUNDAY_SHOWDOWN_PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};
const PUBLIC_FILES = new Set([
  "index.html", "styles.css", "app.js", "core.js", "data.js", "sample-questions.csv", "WOW YOUTH.png"
]);

function send(response, status, body, type) {
  response.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

const server = http.createServer(function (request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch (_) { send(response, 400, "Bad request"); return; }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (!PUBLIC_FILES.has(relative.replace(/\\/g, "/"))) {
    send(response, 404, "Not found");
    return;
  }
  const requestedPath = path.resolve(GAME_ROOT, relative);
  if (requestedPath !== GAME_ROOT && !requestedPath.startsWith(GAME_ROOT + path.sep)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.stat(requestedPath, function (statError, stats) {
    if (statError || !stats.isFile()) {
      send(response, 404, "Not found");
      return;
    }
    fs.readFile(requestedPath, function (readError, data) {
      if (readError) { send(response, 500, "Could not read file"); return; }
      send(response, 200, data, TYPES[path.extname(requestedPath).toLowerCase()] || "application/octet-stream");
    });
  });
});

server.listen(GAME_PORT, "127.0.0.1", function () {
  console.log("Sunday Showdown is ready at http://localhost:" + GAME_PORT);
  console.log("Press Ctrl+C to stop the game server.");
});
