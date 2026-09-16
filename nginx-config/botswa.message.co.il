# =========================
# DOMAIN MIGRATED -> app.message.co.il
# This host is retired. Everything (pages AND /api/* calls) is redirected
# to the new domain so old bookmarks / cached clients always land in the
# right place. 308 preserves the HTTP method + body (needed for POST
# requests like /api/auth/login), unlike a 301/302.
# =========================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name botswa.message.co.il;

    ssl_certificate /etc/letsencrypt/live/botswa.message.co.il/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/botswa.message.co.il/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_timeout 10m;

    access_log /var/log/nginx/botswa.message.co.il-access.log;
    error_log /var/log/nginx/botswa.message.co.il-error.log;

    location / {
        return 308 https://app.message.co.il$request_uri;
    }
}

# =========================
# HTTP → HTTPS (then redirected above to app.message.co.il)
# =========================
server {
    listen 80;
    listen [::]:80;
    server_name botswa.message.co.il;
    return 301 https://app.message.co.il$request_uri;
}
