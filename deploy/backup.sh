#!/usr/bin/env bash
set -euo pipefail

# AVATAR Agent 手动备份脚本

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$DEPLOY_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "📦 备份 AVATAR Agent 数据..."

# Backup SQLite database from Docker volume
docker cp avatar-agent:/app/db/custom.db "$BACKUP_DIR/avatar_$DATE.db" 2>/dev/null || {
  echo "❌ 无法从容器获取数据库，尝试从 volume 复制..."
  # Alternative: find the volume mount point (try common project name prefixes)
  VOLUME_NAME=""
  for candidate in deploy_avatar-db avatar-agent_avatar-db avatar_db avatar-db; do
    if docker volume inspect "$candidate" &>/dev/null; then
      VOLUME_NAME="$candidate"
      break
    fi
  done
  if [[ -n "$VOLUME_NAME" ]]; then
    VOLUME_PATH=$(docker volume inspect "$VOLUME_NAME" --format '{{.Mountpoint}}')
    if [[ -n "$VOLUME_PATH" && -f "$VOLUME_PATH/custom.db" ]]; then
      sudo cp "$VOLUME_PATH/custom.db" "$BACKUP_DIR/avatar_$DATE.db"
    else
      echo "❌ 备份失败：volume $VOLUME_NAME 中找不到 custom.db"
      exit 1
    fi
  else
    echo "❌ 备份失败：找不到 avatar-db 卷（容器是否在运行？）"
    exit 1
  fi
}

# Compress
gzip "$BACKUP_DIR/avatar_$DATE.db"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.db.gz" -mtime +30 -delete

echo "✅ 备份完成: avatar_$DATE.db.gz"
echo "📁 备份目录: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
