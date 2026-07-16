#!/bin/bash
# Setup script for uploads directory in production server
# Run this on your server: bash setup-uploads.sh

echo "🚀 FlowBot - Setup Uploads Directory"
echo "======================================"

# 1. Navigate to backend directory
if [ ! -d "/var/www/project-bots/backend" ]; then
    echo "❌ Error: /var/www/project-bots/backend not found!"
    echo "Please adjust the path in this script."
    exit 1
fi

cd /var/www/project-bots/backend

# 2. Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

# 3. Set permissions
echo "🔐 Setting permissions..."
chmod 755 uploads
chown -R $USER:$USER uploads

# 4. Verify
if [ -d "uploads" ]; then
    echo "✅ Uploads directory created successfully!"
    ls -la uploads
else
    echo "❌ Failed to create uploads directory"
    exit 1
fi

echo ""
echo "📝 Next steps:"
echo "1. Update Nginx configuration: sudo nano /etc/nginx/sites-available/flowbot"
echo "2. Add the following location block before 'location /api':"
echo ""
echo "   location /uploads {"
echo "       alias /var/www/project-bots/backend/uploads;"
echo "       expires 30d;"
echo "       add_header Cache-Control \"public, immutable\";"
echo "       access_log off;"
echo "   }"
echo ""
echo "3. Test and restart Nginx:"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo ""
echo "4. Test image upload: Upload an image in the bot wizard"
echo ""
echo "✅ Done!"
