#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http import cookies
from urllib.parse import parse_qs, quote, unquote, urlsplit
import base64
import hashlib
import hmac
import http.client
import os
import time

LISTEN_HOST = os.environ.get("GATE_LISTEN_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("GATE_LISTEN_PORT", "3001"))
UPSTREAM = os.environ.get("GATE_UPSTREAM", "http://127.0.0.1:3101")
PASSWORD = os.environ["GATE_PASSWORD"]
SECRET = os.environ["GATE_COOKIE_SECRET"].encode("utf-8")
COOKIE_NAME = "atl_mcp_gate"
SESSION_SECONDS = int(os.environ.get("GATE_SESSION_SECONDS", "43200"))

up = urlsplit(UPSTREAM)
UPSTREAM_HOST = up.hostname or "127.0.0.1"
UPSTREAM_PORT = up.port or (443 if up.scheme == "https" else 80)
UPSTREAM_HTTPS = up.scheme == "https"

LOGIN_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>atl-mcp access</title>
<style>
:root { color-scheme: light; font-family: Arial, sans-serif; background:#f6f4ef; color:#171717; }
body { margin:0; min-height:100vh; display:grid; place-items:center; }
main { width:min(92vw, 380px); border:1px solid #c9c3b8; background:#fffdf8; padding:24px; box-shadow:0 12px 30px rgba(0,0,0,.08); }
h1 { margin:0 0 8px; font-size:20px; }
p { margin:0 0 18px; color:#4b4b4b; font-size:14px; line-height:1.45; }
label { display:block; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; margin-bottom:8px; }
input { box-sizing:border-box; width:100%; padding:12px; border:1px solid #a9a295; font-size:16px; background:white; }
button { margin-top:14px; width:100%; padding:12px; border:1px solid #171717; background:#171717; color:white; font-weight:700; cursor:pointer; }
.error { color:#9a1f1f; font-weight:700; }
</style>
</head>
<body><main>
<h1>atl-mcp access</h1>
<p>Enter the site password to continue.</p>
{error}
<form method="post" action="/gate/login">
<input type="hidden" name="next" value="{next}">
<label for="password">Password</label>
<input id="password" name="password" type="password" autofocus autocomplete="current-password">
<button type="submit">Open control plane</button>
</form>
</main></body></html>"""

HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def sign(expiry: str) -> str:
    return hmac.new(SECRET, expiry.encode("utf-8"), hashlib.sha256).hexdigest()


def make_cookie() -> str:
    expiry = str(int(time.time()) + SESSION_SECONDS)
    value = base64.urlsafe_b64encode(f"{expiry}:{sign(expiry)}".encode("utf-8")).decode("ascii")
    return f"{COOKIE_NAME}={value}; Max-Age={SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax"


def authorized(header: str | None) -> bool:
    if not header:
        return False
    jar = cookies.SimpleCookie()
    try:
        jar.load(header)
        morsel = jar.get(COOKIE_NAME)
        if not morsel:
            return False
        decoded = base64.urlsafe_b64decode(morsel.value.encode("ascii")).decode("utf-8")
        expiry, sig = decoded.split(":", 1)
        if int(expiry) < int(time.time()):
            return False
        return hmac.compare_digest(sig, sign(expiry))
    except Exception:
        return False


class Gate(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "atl-mcp-gate/0.2"

    def drain_request_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            length = 0
        if length > 0:
            self.rfile.read(length)

    def do_GET(self):
        if self.path.startswith("/gate/login"):
            self.login_page()
            return
        if self.path.startswith("/gate/logout"):
            self.send_response(302)
            self.send_header("Location", "/gate/login")
            self.send_header("Set-Cookie", f"{COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax")
            self.send_header("Content-Length", "0")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            return
        if not authorized(self.headers.get("Cookie")):
            self.redirect_login()
            return
        self.proxy()

    def do_HEAD(self):
        if self.path.startswith("/gate/login"):
            self.login_page()
            return
        if not authorized(self.headers.get("Cookie")):
            self.redirect_login()
            return
        self.proxy()

    def do_POST(self):
        if self.path.startswith("/gate/login"):
            self.handle_login()
            return
        if not authorized(self.headers.get("Cookie")):
            self.drain_request_body()
            self.respond_text(401, "password required")
            return
        self.proxy()

    def do_OPTIONS(self):
        if not authorized(self.headers.get("Cookie")):
            self.drain_request_body()
            self.respond_text(401, "password required")
            return
        self.proxy()

    def do_PUT(self):
        self.authenticated_proxy()

    def do_PATCH(self):
        self.authenticated_proxy()

    def do_DELETE(self):
        self.authenticated_proxy()

    def authenticated_proxy(self):
        if not authorized(self.headers.get("Cookie")):
            self.drain_request_body()
            self.respond_text(401, "password required")
            return
        self.proxy()

    def login_page(self, error: str = ""):
        query = parse_qs(urlsplit(self.path).query)
        nxt = query.get("next", ["/ui/"])[0]
        if not nxt.startswith("/") or nxt.startswith("//"):
            nxt = "/ui/"
        err_html = '<p class="error">Wrong password.</p>' if error else ""
        body = LOGIN_HTML.replace("{error}", err_html).replace("{next}", quote(nxt, safe="/%#?=&"))
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def redirect_login(self):
        self.send_response(302)
        self.send_header("Location", "/gate/login?next=" + quote(self.path, safe="/%#?=&"))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def handle_login(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8", "replace")
        fields = parse_qs(raw)
        supplied = fields.get("password", [""])[0]
        nxt = unquote(fields.get("next", ["/ui/"])[0])
        if not nxt.startswith("/") or nxt.startswith("//"):
            nxt = "/ui/"
        if not hmac.compare_digest(supplied, PASSWORD):
            self.path = "/gate/login?next=" + quote(nxt, safe="/%#?=&")
            self.login_page(error="1")
            return
        self.send_response(302)
        self.send_header("Location", nxt)
        self.send_header("Set-Cookie", make_cookie())
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def respond_text(self, status: int, text: str):
        data = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        self.close_connection = True

    def proxy(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else None
        conn_cls = http.client.HTTPSConnection if UPSTREAM_HTTPS else http.client.HTTPConnection
        conn = conn_cls(UPSTREAM_HOST, UPSTREAM_PORT, timeout=75)
        headers = {}
        for key, value in self.headers.items():
            lk = key.lower()
            if lk in HOP_BY_HOP or lk in {"host", "content-length"}:
                continue
            headers[key] = value
        headers["Host"] = f"{UPSTREAM_HOST}:{UPSTREAM_PORT}"
        headers["X-Forwarded-Host"] = self.headers.get("Host", "")
        headers["X-Forwarded-Proto"] = "https"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        conn.request(self.command, self.path, body=body, headers=headers)
        response = conn.getresponse()
        response_body = response.read()
        self.send_response(response.status, response.reason)
        for key, value in response.getheaders():
            lk = key.lower()
            if lk in HOP_BY_HOP or lk == "content-length":
                continue
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(response_body)
        conn.close()


def main():
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Gate)
    print(f"atl-mcp gate listening on {LISTEN_HOST}:{LISTEN_PORT}, upstream {UPSTREAM}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
