# =========================
# HTTPS SERVER
# =========================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name botswa.message.co.il;

    root /var/www/project-bots/frontend/dist;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/botswa.message.co.il/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/botswa.message.co.il/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_timeout 10m;

    # Client body size limit (for file uploads)
    client_max_body_size 50M;

    # Logging
    access_log /var/log/nginx/botswa.message.co.il-access.log;
    error_log /var/log/nginx/botswa.message.co.il-error.log;

    # ========= Uploads (אם יש העלאות קבצים) =========
    location /uploads/ {
        alias /var/www/project-bots/backend/uploads/;
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ========= Static assets =========
    location /assets/ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Cache static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ========= API =========
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_hxxxxxxxxxxxction 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxxxxxxxxct_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # ========= Frontend SPA =========
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Disable access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

# =========================
# HTTP → HTTPS REDIRECT
# =========================
server {
    listen 80;
    listen [::]:80;
    server_name botswa.message.co.il;
    return 301 https://$host$request_uri;
}
