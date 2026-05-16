#!/bin/bash

# Script de Deployment para CQB Factory Web en Hostinger VPS
# Uso: bash deploy-hostinger.sh

set -e  # Detener si hay error

echo "=========================================="
echo "CQB Factory Web - Deployment Hostinger VPS"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PASO 1: Actualizar sistema
echo -e "${YELLOW}[1/10] Actualizando sistema...${NC}"
apt update && apt upgrade -y

# PASO 2: Instalar Node.js 20
echo -e "${YELLOW}[2/10] Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs npm git

echo -e "${GREEN}✓ Node.js instalado:${NC}"
node -v
npm -v

# PASO 3: Clonar repositorio
echo -e "${YELLOW}[3/10] Clonando repositorio...${NC}"
cd /home
if [ -d "CQB-Factory-Web" ]; then
    echo "Repositorio ya existe, actualizando..."
    cd CQB-Factory-Web
    git pull origin main
else
    git clone https://github.com/juano257/CQB-Factory-Web.git
    cd CQB-Factory-Web
fi

# PASO 4: Instalar dependencias
echo -e "${YELLOW}[4/10] Instalando dependencias...${NC}"
npm install

# PASO 5: Verificar/crear .env
echo -e "${YELLOW}[5/10] Configurando .env...${NC}"
if [ ! -f ".env" ]; then
    echo "Creando archivo .env..."
    cat > .env << 'EOF'
DATABASE_URL=postgresql://neondb_owner:npg_Bi8n9DjdMEca@ep-empty-mouse-ac644d21.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full
APP_URL=https://cqb-factory.com
NODE_ENV=production
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ab6af9001@smtp-brevo.com
SMTP_PASS=ByA6npVZKSDfzYjg
MAIL_FROM="CQB Factory <cqbfactoryspa@gmail.com>"
PORT=3000
EOF
    echo -e "${GREEN}✓ Archivo .env creado${NC}"
else
    echo -e "${GREEN}✓ Archivo .env ya existe${NC}"
fi

# PASO 6: Instalar PM2 globalmente
echo -e "${YELLOW}[6/10] Instalando PM2...${NC}"
npm install -g pm2

# PASO 7: Iniciar aplicación con PM2
echo -e "${YELLOW}[7/10] Iniciando aplicación con PM2...${NC}"
pm2 delete cqb-factory 2>/dev/null || true
pm2 start server.js --name "cqb-factory"
pm2 startup
pm2 save

echo -e "${GREEN}✓ Aplicación iniciada${NC}"
pm2 status

# PASO 8: Instalar Nginx
echo -e "${YELLOW}[8/10] Instalando Nginx...${NC}"
apt install -y nginx

# PASO 9: Configurar Nginx
echo -e "${YELLOW}[9/10] Configurando Nginx...${NC}"
cat > /etc/nginx/sites-available/cqb-factory << 'EOF'
server {
    listen 80;
    server_name cqb-factory.com www.cqb-factory.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/cqb-factory /etc/nginx/sites-enabled/cqb-factory
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx

echo -e "${GREEN}✓ Nginx configurado${NC}"

# PASO 10: Instalar SSL/HTTPS
echo -e "${YELLOW}[10/10] Instalando Certbot para SSL...${NC}"
apt install -y certbot python3-certbot-nginx

echo -e "${GREEN}=========================================="
echo "✓ DEPLOYMENT COMPLETADO"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Ejecuta: certbot --nginx -d cqb-factory.com -d www.cqb-factory.com"
echo "2. Elige opción 2 para redirigir HTTP a HTTPS"
echo "3. Apunta tu DNS a la IP: 82.25.67.32"
echo ""
echo -e "${YELLOW}Comandos útiles:${NC}"
echo "  pm2 status              - Ver estado de la app"
echo "  pm2 logs cqb-factory    - Ver logs en tiempo real"
echo "  pm2 restart cqb-factory - Reiniciar la app"
echo "  systemctl status nginx  - Ver estado de Nginx"
echo ""
