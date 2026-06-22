#!/usr/bin/env bash
set -euo pipefail

# ┌──────────────────────────────────────────────────┐
# │   AVATAR Agent — 一键部署脚本                     │
# │   适用于 Ubuntu 20.04+ / Debian 11+              │
# │   Docker Compose 方案，5分钟从零部署到运行         │
# └──────────────────────────────────────────────────┘

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       AVATAR Agent 一键部署脚本          ║"
echo "  ║       5分钟从零部署到运行                ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$DEPLOY_DIR")"

# ── 0. 检查 root 权限 ──
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}请使用 root 权限运行此脚本${NC}"
  echo "  sudo bash $0"
  exit 1
fi

# ── 1. 安装 Docker ──
install_docker() {
  echo -e "${YELLOW}[1/6] 检查 Docker...${NC}"

  if command -v docker &> /dev/null; then
    echo -e "${GREEN}  ✓ Docker 已安装: $(docker --version)${NC}"
  else
    echo "  安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}  ✓ Docker 安装完成${NC}"
  fi

  if docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Docker Compose (plugin) 已安装${NC}"
  elif command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}  ✓ Docker Compose 已安装${NC}"
  else
    echo "  安装 Docker Compose plugin..."
    apt-get update -qq
    apt-get install -y docker-compose-plugin
    echo -e "${GREEN}  ✓ Docker Compose 安装完成${NC}"
  fi
}

# ── 2. 配置防火墙 ──
setup_firewall() {
  echo -e "${YELLOW}[2/6] 配置防火墙...${NC}"

  if command -v ufw &> /dev/null; then
    ufw allow 22/tcp &> /dev/null || true   # SSH
    ufw allow 80/tcp &> /dev/null || true   # HTTP
    ufw allow 443/tcp &> /dev/null || true  # HTTPS
    ufw --force enable &> /dev/null || true
    echo -e "${GREEN}  ✓ 防火墙已配置 (SSH/HTTP/HTTPS)${NC}"
  else
    echo -e "${YELLOW}  ⚠ ufw 未安装，跳过防火墙配置${NC}"
    echo -e "${CYAN}    建议手动安装: apt install ufw && ufw allow 22,80,443${NC}"
  fi
}

# ── 3. 配置环境变量 ──
setup_env() {
  echo -e "${YELLOW}[3/6] 配置环境变量...${NC}"

  if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
    cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
    echo -e "${GREEN}  ✓ 已创建 .env 文件${NC}"
    echo ""
    echo -e "${BOLD}${CYAN}  ⚠ 请编辑 .env 填入你的 API Key 配置：${NC}"
    echo -e "    nano $DEPLOY_DIR/.env"
    echo ""
    read -p "  按回车继续（或输入 'edit' 现在编辑）: " EDIT_CHOICE
    if [[ "$EDIT_CHOICE" == "edit" ]]; then
      ${EDITOR:-nano} "$DEPLOY_DIR/.env"
    fi
  else
    echo -e "${GREEN}  ✓ .env 文件已存在${NC}"
  fi
}

# ── 4. 配置域名 ──
setup_domain() {
  echo -e "${YELLOW}[4/6] 配置域名...${NC}"

  # 读取 .env 中已有的 DOMAIN 值
  EXISTING_DOMAIN=""
  if [[ -f "$DEPLOY_DIR/.env" ]]; then
    EXISTING_DOMAIN=$(grep -E "^DOMAIN=" "$DEPLOY_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]' || echo "")
  fi

  if [[ -n "$EXISTING_DOMAIN" && "$EXISTING_DOMAIN" != "localhost" ]]; then
    echo -e "${GREEN}  ✓ .env 中已配置域名: $EXISTING_DOMAIN${NC}"
    echo -e "${CYAN}  ℹ Caddy 将自动申请 Let's Encrypt HTTPS 证书${NC}"
    echo -e "${CYAN}  ℹ 请确保域名 DNS A 记录已指向此服务器 IP${NC}"
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "UNKNOWN")
    echo -e "${CYAN}  ℹ 此服务器公网IP: $SERVER_IP${NC}"
    echo ""
    read -p "  是否修改域名？(回车保留 $EXISTING_DOMAIN / 输入新域名): " DOMAIN_INPUT
    if [[ -z "$DOMAIN_INPUT" ]]; then
      DOMAIN_INPUT="$EXISTING_DOMAIN"
      return
    fi
  else
    read -p "  请输入你的域名 (没有域名直接回车跳过): " DOMAIN_INPUT
  fi

  if [[ -n "$DOMAIN_INPUT" ]]; then
    # Update .env with domain
    if grep -q "^DOMAIN=" "$DEPLOY_DIR/.env"; then
      sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN_INPUT/" "$DEPLOY_DIR/.env"
    else
      echo "DOMAIN=$DOMAIN_INPUT" >> "$DEPLOY_DIR/.env"
    fi
    echo -e "${GREEN}  ✓ 域名已设置: $DOMAIN_INPUT${NC}"
    echo -e "${CYAN}  ℹ Caddy 将自动申请 Let's Encrypt HTTPS 证书${NC}"
    echo -e "${CYAN}  ℹ 请确保域名 DNS A 记录已指向此服务器 IP${NC}"
    echo ""
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "UNKNOWN")
    echo -e "${CYAN}  ℹ 此服务器公网IP: $SERVER_IP${NC}"
    echo -e "${CYAN}  ℹ 请在域名管理面板添加: A 记录 → $SERVER_IP${NC}"
  else
    # 没输入域名，写回 localhost
    if grep -q "^DOMAIN=" "$DEPLOY_DIR/.env"; then
      sed -i "s/^DOMAIN=.*/DOMAIN=localhost/" "$DEPLOY_DIR/.env"
    else
      echo "DOMAIN=localhost" >> "$DEPLOY_DIR/.env"
    fi
    echo -e "${YELLOW}  ⚠ 未设置域名，将使用 HTTP 模式 (localhost)${NC}"
    echo -e "${CYAN}  ℹ 之后设置域名可编辑 deploy/.env 中的 DOMAIN 变量${NC}"
  fi
}

# ── 5. 构建和启动 ──
build_and_start() {
  echo -e "${YELLOW}[5/6] 构建 Docker 镜像 (首次构建约 2-3 分钟)...${NC}"

  cd "$DEPLOY_DIR"

  # Create backups directory
  mkdir -p "$DEPLOY_DIR/backups"

  # Build and start
  if docker compose version &> /dev/null 2>&1; then
    docker compose build
    echo -e "${YELLOW}  启动服务...${NC}"
    docker compose up -d
  else
    docker-compose build
    echo -e "${YELLOW}  启动服务...${NC}"
    docker-compose up -d
  fi

  echo -e "${GREEN}  ✓ 服务已启动${NC}"
}

# ── 6. 验证部署 ──
verify() {
  echo -e "${YELLOW}[6/6] 验证部署...${NC}"

  echo "  等待应用启动..."
  sleep 8

  # Check container status
  if docker ps | grep -q avatar-agent; then
    echo -e "${GREEN}  ✓ avatar-agent 容器运行中${NC}"
  else
    echo -e "${RED}  ✗ avatar-agent 容器未启动${NC}"
    echo -e "${CYAN}    查看日志: docker logs avatar-agent${NC}"
  fi

  if docker ps | grep -q avatar-caddy; then
    echo -e "${GREEN}  ✓ caddy 反向代理运行中${NC}"
  else
    echo -e "${YELLOW}  ⚠ caddy 容器未启动 (可能域名DNS尚未生效)${NC}"
  fi

  if docker ps | grep -q avatar-backup; then
    echo -e "${GREEN}  ✓ backup 备份服务运行中${NC}"
  fi

  # Health check
  for i in {1..5}; do
    if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ 健康检查通过 (http://localhost:3000)${NC}"
      break
    fi
    if [[ $i -eq 5 ]]; then
      echo -e "${YELLOW}  ⚠ 应用尚未就绪，可能需要等待几秒${NC}"
      echo -e "${CYAN}    查看日志: docker logs -f avatar-agent${NC}"
    fi
    sleep 3
  done

  # Print success banner
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║            🎉 AVATAR Agent 部署完成！           ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║                                                ║${NC}"

  DOMAIN=${DOMAIN_INPUT:-}
  SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

  if [[ -n "$DOMAIN" ]]; then
    echo -e "${GREEN}║  🌐 访问地址: https://$DOMAIN${NC}"
    echo -e "${GREEN}║  📱 PWA安装:  手机浏览器打开上方地址${NC}"
    echo -e "${GREEN}║  🤖 Bot Webhook: https://$DOMAIN/api/bot-connections${NC}"
  else
    echo -e "${GREEN}║  🌐 访问地址: http://$SERVER_IP:3000${NC}"
    echo -e "${GREEN}║  📱 PWA安装:  手机浏览器打开上方地址${NC}"
  fi

  echo -e "${GREEN}║                                                ║${NC}"
  echo -e "${GREEN}║  📋 常用运维命令:                               ║${NC}"
  echo -e "${GREEN}║  查看日志:  docker logs -f avatar-agent        ║${NC}"
  echo -e "${GREEN}║  重启服务:  docker compose restart             ║${NC}"
  echo -e "${GREEN}║  停止服务:  docker compose down                ║${NC}"
  echo -e "${GREEN}║  更新部署:  bash deploy/update.sh              ║${NC}"
  echo -e "${GREEN}║  手动备份:  bash deploy/backup.sh              ║${NC}"
  echo -e "${GREEN}║  查看备份:  ls deploy/backups/                 ║${NC}"
  echo -e "${GREEN}║                                                ║${NC}"
  echo -e "${GREEN}║  📖 完整文档: cat deploy/README.md             ║${NC}"
  echo -e "${GREEN}║                                                ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
}

# ── 主流程 ──
main() {
  install_docker
  setup_firewall
  setup_env
  setup_domain
  build_and_start
  verify
}

main
