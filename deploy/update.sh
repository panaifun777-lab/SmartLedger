#!/usr/bin/env bash
set -euo pipefail

# AVATAR Agent 更新脚本
# 用法: bash deploy/update.sh

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$DEPLOY_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔄 更新 AVATAR Agent...${NC}"

# 1. Backup before update
echo -e "${YELLOW}[1/3] 备份当前数据...${NC}"
bash "$DEPLOY_DIR/backup.sh"

# 2. Pull latest code (if git repo)
echo -e "${YELLOW}[2/3] 拉取最新代码...${NC}"
cd "$PROJECT_DIR"
if git rev-parse --is-inside-work-tree &> /dev/null; then
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo -e "${YELLOW}  ⚠ Git pull 失败，使用本地代码继续${NC}"
  echo -e "${GREEN}  ✓ 代码已更新${NC}"
else
  echo -e "${YELLOW}  ⚠ 非Git仓库，使用本地代码继续${NC}"
fi

# 3. Rebuild and restart
echo -e "${YELLOW}[3/3] 重新构建并启动...${NC}"
cd "$DEPLOY_DIR"

if docker compose version &> /dev/null 2>&1; then
  docker compose build
  docker compose up -d
else
  docker-compose build
  docker-compose up -d
fi

# Wait and verify
echo -e "${CYAN}  等待服务就绪...${NC}"
for i in {1..30}; do
  if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ 更新完成！服务已就绪${NC}"
    exit 0
  fi
  sleep 2
done

echo -e "${YELLOW}  ⚠ 服务启动较慢，请检查: docker logs avatar-agent${NC}"
