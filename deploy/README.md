# AVATAR Agent 部署指南

> 个人 AI 智能体助手 — 一键部署到你的 VPS，5 分钟上线 🚀

---

## 📋 目录

- [1. 快速开始（5 分钟部署）](#1-快速开始5-分钟部署)
- [2. 架构图](#2-架构图)
- [3. 环境变量说明](#3-环境变量说明)
- [4. 常用运维命令](#4-常用运维命令)
- [5. 域名配置](#5-域名配置)
- [6. Bot 连接配置](#6-bot-连接配置)
- [7. 数据备份与恢复](#7-数据备份与恢复)
- [8. 安全加固](#8-安全加固)
- [9. 故障排查](#9-故障排查)
- [10. 手机端使用](#10-手机端使用)

---

## 1. 快速开始（5 分钟部署）

### 前提条件

| 项目 | 要求 |
|------|------|
| 🖥️ 服务器 | VPS，Ubuntu 20.04+，1 核 1G 起步 |
| 🌐 域名 | 可选。有域名可开启自动 HTTPS |
| 🐳 Docker | 已安装 Docker & Docker Compose（一键脚本会自动安装） |
| 🔑 AI 密钥 | 至少一个 API Key，或使用内置 z-ai-web-dev-sdk |

### 一键部署命令

```bash
# 方法 A：使用一键部署脚本（推荐，自动安装 Docker + 交互式配置）
cd /opt/avatar-agent/deploy
sudo bash deploy.sh

# 方法 B：手动部署
git clone <your-repo-url> /opt/avatar-agent && cd /opt/avatar-agent/deploy
cp .env.example .env
nano .env                       # 编辑配置（详见下方环境变量说明）
docker compose up -d
docker compose logs -f avatar-agent
```

`deploy.sh` 一键脚本会自动完成：
1. ✅ 安装 Docker & Docker Compose
2. ✅ 创建 `.env` 配置文件
3. ✅ 交互式配置域名（有域名自动 HTTPS，无域名 HTTP 模式）
4. ✅ 构建镜像并启动容器
5. ✅ 健康检查与验证

启动完成后，访问：

- 🌐 **无域名**: `http://你的VPS_IP`（Caddy 监听 80 端口，代理到 avatar-agent:3000）
- 🔒 **有域名**: `https://your-domain.com`（Caddy 自动申请 Let's Encrypt 证书）

### 环境变量配置

首次部署必须配置 `.env` 文件：

```bash
# 必填 — 数据库连接（Docker 内使用默认值即可）
DATABASE_URL=file:./db/custom.db

# 域名（没有域名留空，Caddy 使用 HTTP 模式）
DOMAIN=localhost

# 可选 — AI API Keys（至少配一个）
ZHIPU_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# 可选 — Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# 可选 — 飞书 Bot
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_WEBHOOK_URL=

# 可选 — 默认模型
DEFAULT_MODEL=glm-4-flash
```

---

## 2. 架构图

### 三容器架构

```
┌─────────────────────────────────────────────────────────┐
│                        VPS 服务器                        │
│                                                         │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │          │    │              │    │              │  │
│   │  Caddy   │───▶│avatar-agent │    │   backup     │  │
│   │ (443/80) │    │  (3000)     │    │  (定时备份)   │  │
│   │          │    │              │    │              │  │
│   └────┬─────┘    └──────┬───────┘    └──────────────┘  │
│        │                 │                               │
│   自动HTTPS         Next.js 应用        每日备份 SQLite   │
│   反向代理          SQLite + Prisma     30天自动清理      │
│   安全头/压缩/缓存   z-ai-web-dev-sdk                     │
│                                                         │
│   ┌──────────────────────────────────────────────────┐  │
│   │  Docker Volumes                                   │  │
│   │  avatar-db ── /app/db/custom.db                   │  │
│   │  avatar-uploads ── /app/upload/                   │  │
│   │  caddy-data ── TLS 证书                           │  │
│   └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘

网络流量:
  Internet ──▶ Caddy (80/443) ──▶ avatar-agent (3000)
              自动TLS证书         Next.js standalone
              安全头/压缩/缓存    Bun 运行时
```

### 容器说明

| 容器 | 镜像/构建 | 端口 | 职责 |
|------|-----------|------|------|
| `avatar-agent` | 本地 3 阶段构建 (oven/bun:1.2) | 3000 | 主应用：聊天、记忆、知识库、Bot API |
| `caddy` | `caddy:2-alpine` | 443, 80 | 反向代理 + 自动 HTTPS + 安全头 + 缓存 + 压缩 |
| `backup` | `alpine:3.19` | — | 每日自动备份 SQLite 数据库，30 天自动清理 |

### 数据流

```
用户浏览器 ──▶ Caddy:443 ──▶ avatar-agent:3000 ──▶ SQLite (avatar-db 卷)
   │                                       ├──▶ z-ai-web-dev-sdk (AI 多模型)
   │                                       ├──▶ Telegram API / 飞书 API
   │                                       └──▶ Prisma ORM
   │
   └── PWA 安装到手机桌面，Service Worker 离线缓存
```

---

## 3. 环境变量说明

### 核心配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` | SQLite 数据库路径。Docker 部署映射到命名卷 `avatar-db` |
| `DOMAIN` | ❌ | `localhost` | 域名。Caddy 用此域名申请 HTTPS 证书，留空则 HTTP 模式 |
| `PORT` | ❌ | `3000` | 应用监听端口 |
| `NODE_ENV` | ❌ | `production` | 运行环境，Docker 部署自动设置 |
| `DEFAULT_MODEL` | ❌ | `glm-4-flash` | 默认 AI 模型 ID |

### AI API Keys

> 💡 项目同时使用 `z-ai-web-dev-sdk`（自动内置，无需配置）和传统 API Key 方式。
> 至少配置一个 API Key 或使用内置 SDK 即可。

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `ZHIPU_API_KEY` | ❌ | — | 智谱 AI (GLM-4 系列) API Key |
| `OPENAI_API_KEY` | ❌ | — | OpenAI (GPT-4 系列) API Key |
| `ANTHROPIC_API_KEY` | ❌ | — | Anthropic (Claude 系列) API Key |
| `DEEPSEEK_API_KEY` | ❌ | — | DeepSeek API Key |
| `GOOGLE_API_KEY` | ❌ | — | Google (Gemini 系列) API Key |

> 系统内置 20+ AI 模型（智谱 GLM、OpenAI GPT、Claude、DeepSeek、通义千问、Gemini 等），
> 可在 **设置 → 模型选择** 中切换。免费模型（GLM-4 Flash、DeepSeek V3 等）开箱即用。

### Bot 连接配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `TELEGRAM_BOT_TOKEN` | ❌ | — | Telegram Bot Token，从 @BotFather 获取。也可在设置页面配置 |
| `TELEGRAM_CHAT_ID` | ❌ | — | Telegram 默认 Chat ID |
| `FEISHU_APP_ID` | ❌ | — | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | ❌ | — | 飞书应用 App Secret |
| `FEISHU_WEBHOOK_URL` | ❌ | — | 飞书机器人 Webhook URL |

### .env 完整模板

```bash
# ── AVATAR Agent 环境变量 ──
# 复制此文件为 .env 并填入你的配置
# cp .env.example .env

# 数据库连接 (SQLite, 保持默认)
DATABASE_URL=file:./db/custom.db

# 域名 (Caddy 用这个域名申请 HTTPS 证书)
# 如果没有域名，留空则使用 HTTP
DOMAIN=localhost

# ── AI API Keys ──
# 至少配置一个 API Key 即可使用

# 智谱 AI (GLM-4 系列)
ZHIPU_API_KEY=

# OpenAI (GPT-4 系列)
OPENAI_API_KEY=

# Anthropic (Claude 系列)
ANTHROPIC_API_KEY=

# DeepSeek
DEEPSEEK_API_KEY=

# Google (Gemini 系列)
GOOGLE_API_KEY=

# ── Bot 连接 ──
# Telegram Bot Token (从 @BotFather 获取)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# 飞书 Bot
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_WEBHOOK_URL=

# ── 可选配置 ──
# 默认模型
DEFAULT_MODEL=glm-4-flash
```

---

## 4. 常用运维命令

> 💡 以下命令均在 `deploy/` 目录下执行

### 启动 / 停止 / 重启

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启单个服务
docker compose restart avatar-agent

# 重新构建并启动（更新代码后）
docker compose up -d --build avatar-agent
```

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 只看主应用日志
docker compose logs -f avatar-agent

# 只看 Caddy 日志
docker compose logs -f caddy

# 查看最近 100 行日志
docker compose logs --tail 100 avatar-agent

# 查看特定时间段日志
docker compose logs --since 30m avatar-agent
```

### 数据库操作

```bash
# 推送 Schema 变更到数据库
docker compose exec avatar-agent bun run db:push

# 生成 Prisma Client
docker compose exec avatar-agent bunx prisma generate

# 重置数据库（⚠️ 会删除所有数据）
docker compose exec avatar-agent bun run db:reset
```

### 备份与恢复

```bash
# 手动备份（使用部署脚本）
bash /opt/avatar-agent/deploy/backup.sh

# 查看备份文件
ls -la /opt/avatar-agent/deploy/backups/

# 从运行中的容器直接复制数据库
docker cp avatar-agent:/app/db/custom.db ./backup_manual_$(date +%Y%m%d).db
```

### 更新应用

```bash
# 方法 1：使用更新脚本（自动备份 + 拉取 + 重建 + 健康检查）
bash /opt/avatar-agent/deploy/update.sh

# 方法 2：手动更新
git pull origin main
docker compose up -d --build
```

### Docker 清理

```bash
# 清理未使用的镜像和容器
docker system prune -f

# 查看磁盘使用
docker system df
```

### 未来扩展（Scale）

```bash
# 多实例横向扩展（需要负载均衡器）
docker compose up -d --scale avatar-agent=2

# ⚠️ 注意：SQLite 不支持多实例并发写入
# 如需多实例，需迁移到 PostgreSQL 并使用外部负载均衡
```

---

## 5. 域名配置

### DNS A 记录设置

在你的域名管理面板添加 A 记录：

| 类型 | 名称 | 值 | TTL |
|------|------|----|-----|
| A | `avatar` | `你的VPS_IP` | 600 |

例如：`avatar.yourdomain.com` → `123.45.67.89`

### Caddy 自动 HTTPS

Caddy 会自动申请和续期 Let's Encrypt 证书，**无需手动配置**。

项目 `Caddyfile` 使用 `{$DOMAIN:localhost}` 变量，只需在 `.env` 中设置 `DOMAIN=avatar.yourdomain.com`，
Caddy 会自动切换为该域名并申请 HTTPS 证书。

也可以使用一键部署脚本交互式配置域名：

```bash
sudo bash deploy.sh  # 步骤 3 会提示输入域名
```

Caddyfile 完整配置已包含：
- 🔒 安全头（X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy）
- 📦 静态资源缓存（immutable 缓存 JS/CSS/图片，1 年有效期）
- 🔄 PWA 特殊缓存（manifest.json 5 分钟缓存，sw.js/sw-register.js 不缓存）
- 🔌 WebSocket 升级支持
- 🗜️ gzip + zstd 压缩

重启 Caddy：

```bash
docker compose restart caddy
```

### HTTP-only 模式（无域名）

如果暂时没有域名，使用 IP 直接访问。在 `.env` 中保持 `DOMAIN=localhost`，
Caddy 会在 `localhost` 上监听 80/443 端口：

```
# Caddyfile 默认配置
{$DOMAIN:localhost} {
    reverse_proxy avatar-agent:3000
    # ... 安全头、缓存、压缩等
}
```

访问地址：`http://你的VPS_IP`

> ⚠️ 无 HTTPS 时，PWA 在 Chrome 上可能无法安装。建议尽快绑定域名。

---

## 6. Bot 连接配置

### Telegram Bot

#### 步骤 1：创建 Bot

1. 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示输入 Bot 名称和用户名
3. 获得 Bot Token，格式如：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### 步骤 2：配置 Webhook

```bash
# 设置 Webhook（替换 YOUR_TOKEN 和 YOUR_DOMAIN）
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_DOMAIN/api/telegram/webhook"}'

# 验证 Webhook 是否设置成功
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"
```

#### 步骤 3：在设置页面配置

1. 打开 AVATAR Agent → **设置** → **Bot 连接**
2. 找到 **Telegram** 卡片
3. 开启开关，填入 Bot Token 和 Chat ID
4. 点击 **测试连接** 验证（会调用 Telegram `getMe` API 确认 Token 有效）
5. 点击 **保存**

### 飞书 Bot

#### 步骤 1：创建飞书机器人

1. 进入 [飞书开放平台](https://open.feishu.cn/)
2. 创建应用 → 添加「机器人」能力
3. 配置事件订阅，获取 Webhook URL

#### 步骤 2：在设置页面配置

1. 打开 AVATAR Agent → **设置** → **Bot 连接**
2. 找到 **飞书** 卡片
3. 开启开关，填入 Webhook URL
4. 点击 **测试连接** 验证（检查 URL 格式 + HEAD 请求验证可达性）
5. 点击 **保存**

### 微信 Bot

#### 步骤 1：创建企业微信机器人

1. 进入企业微信管理后台
2. 创建自建应用，获取 Webhook URL

#### 步骤 2：在设置页面配置

1. 打开 AVATAR Agent → **设置** → **Bot 连接**
2. 找到 **微信** 卡片
3. 开启开关，填入 Webhook URL
4. 点击 **测试连接** 验证（检查 HTTPS URL 格式 + HEAD 请求验证可达性）
5. 点击 **保存**

### 测试连接

每个 Bot 平台的测试连接功能会验证：

| 平台 | 测试内容 |
|------|----------|
| Telegram | 调用 `getMe` API 验证 Token 有效性，返回 Bot 用户名 |
| 飞书 | 验证 Webhook URL 格式（`https://open.feishu.cn/...`）+ HEAD 请求验证可达性 |
| 微信 | 验证 Webhook URL 为 HTTPS + HEAD 请求验证可达性 |

测试成功后状态自动更新为 **已连接** ✅，失败显示 **连接错误** ❌。

---

## 7. 数据备份与恢复

### 自动备份（每日）

backup 容器（Alpine + shell 循环）默认每 24 小时自动备份 SQLite 数据库。

- 备份目录：`deploy/backups/`
- 文件命名：`avatar_YYYYMMDD_HHMM.db`
- 默认保留 30 天，超期自动清理
- 备份源：从 Docker 命名卷 `avatar-db` 读取 `custom.db`

> 💡 backup 容器使用简单的 shell 循环（`sleep 86400`），轻量且可靠。
> 如需精确 cron 调度，可自行替换为 cron 守护进程。

### 手动备份

```bash
# 方法 1：使用部署脚本
bash /opt/avatar-agent/deploy/backup.sh

# 方法 2：从 Docker 卷中直接复制
DOCKER_VOLUME=$(docker volume inspect deploy_avatar-db --format '{{.Mountpoint}}' 2>/dev/null)
sudo cp "$DOCKER_VOLUME/custom.db" /opt/avatar-agent/deploy/backups/manual_$(date +%Y%m%d_%H%M%S).db

# 方法 3：从运行中的容器复制
docker cp avatar-agent:/app/db/custom.db /opt/avatar-agent/deploy/backups/manual_$(date +%Y%m%d_%H%M%S).db
```

### 从备份恢复

```bash
# 1. 停止应用
cd /opt/avatar-agent/deploy
docker compose down

# 2. 查看可用备份
ls -lh /opt/avatar-agent/deploy/backups/

# 3. 替换数据库文件（通过 Docker 卷）
# 先找到卷的挂载点
DOCKER_VOLUME=$(docker volume inspect deploy_avatar-db --format '{{.Mountpoint}}' 2>/dev/null)
# 备份当前损坏的文件
sudo cp "$DOCKER_VOLUME/custom.db" "$DOCKER_VOLUME/custom.db.corrupted" 2>/dev/null || true
# 从备份恢复
sudo cp /opt/avatar-agent/deploy/backups/avatar_20240101_030000.db "$DOCKER_VOLUME/custom.db"

# 4. 重新启动
docker compose up -d

# 5. 验证数据
docker compose exec avatar-agent curl -s http://localhost:3000/api/memory?limit=5
```

### 备份文件大小参考

| 数据量 | 数据库大小 | 备份耗时 |
|--------|-----------|---------|
| 100 条记忆 | ~1 MB | < 1s |
| 1000 条记忆 | ~5 MB | < 1s |
| 10000 条记忆 | ~30 MB | ~2s |

---

## 8. 安全加固

### 防火墙（UFW）

```bash
# 安装 UFW
apt install -y ufw

# 默认拒绝入站
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH
ufw allow 22/tcp

# 允许 HTTP/HTTPS（Caddy 使用）
ufw allow 80/tcp
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看状态
ufw status verbose
```

> ⚠️ **不要开放 3000 端口**！应用端口只应通过 Caddy 反向代理访问。

### SSH 密钥认证

```bash
# 禁用密码登录
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication no/PasswordAuthentication no/' /etc/ssh/sshd_config

# 禁用 root 登录
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# 重启 SSH 服务
systemctl restart sshd
```

上传公钥到服务器：

```bash
# 在本地机器执行
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-vps-ip
```

### 定期更新

```bash
# 系统更新
apt update && apt upgrade -y

# Docker 镜像更新
docker compose pull
docker compose up -d --build

# 自动安全更新（推荐）
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 安全检查清单

| 项目 | 状态 | 命令 |
|------|------|------|
| 防火墙启用 | ☐ | `ufw status` |
| SSH 密钥认证 | ☐ | `grep PasswordAuth /etc/ssh/sshd_config` |
| root 登录禁用 | ☐ | `grep PermitRootLogin /etc/ssh/sshd_config` |
| 非 3000 端口暴露 | ☐ | `ufw status \| grep 3000`（应为空） |
| HTTPS 启用 | ☐ | `curl -I https://your-domain.com` |
| Docker 限制日志 | ☐ | 添加 `max-size` 到 compose 日志配置 |

---

## 9. 故障排查

### 🔴 容器无法启动

**症状**: `docker compose up -d` 后容器立即退出

```bash
# 查看退出日志
docker compose logs avatar-agent

# 常见原因 1: 端口被占用
lsof -i :3000
# 解决: 修改 .env 中的 PORT 或停止占用进程

# 常见原因 2: 数据库文件权限
docker compose exec avatar-agent ls -la /app/db/
# 解决: 修复权限
chown -R 1001:1001 /var/lib/docker/volumes/deploy_avatar-db/

# 常见原因 3: 构建失败
docker compose build --no-cache avatar-agent
```

### 🔴 数据库错误

**症状**: 页面显示 "Database connection error"

```bash
# 检查数据库文件是否存在
docker compose exec avatar-agent ls -la /app/db/

# 检查 Prisma 状态
docker compose exec avatar-agent bunx prisma db push

# 如果数据库损坏，从备份恢复（见第 7 节）
```

**常见 SQLite 锁定问题**:

```bash
# 检查是否有锁文件
docker compose exec avatar-agent ls -la /app/db/*.db-journal /app/db/*.db-wal 2>/dev/null

# 强制清理（确保容器已停止）
docker compose down
DOCKER_VOLUME=$(docker volume inspect deploy_avatar-db --format '{{.Mountpoint}}')
sudo rm -f "$DOCKER_VOLUME/custom.db-journal" "$DOCKER_VOLUME/custom.db-wal"
docker compose up -d
```

### 🔴 Caddy / HTTPS 问题

**症状**: 无法访问 HTTPS，证书错误

```bash
# 查看 Caddy 日志
docker compose logs caddy

# 常见原因 1: 域名 DNS 未生效
dig avatar.yourdomain.com
# 确认 A 记录指向正确 IP

# 常见原因 2: 80 端口未开放（Let's Encrypt 需要验证）
ufw allow 80/tcp

# 常见原因 3: Caddy 证书缓存问题
docker compose exec caddy caddy fmt --overwrite /etc/caddy/Caddyfile
docker compose restart caddy

# 常见原因 4: avatar-agent 未就绪（Caddy 依赖 healthcheck）
docker compose ps  # 确认 avatar-agent 状态为 healthy
```

### 🔴 Bot 连接问题

**症状**: Bot 无法收发消息

```bash
# Telegram: 检查 Webhook 状态
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"

# 检查应用 API 是否正常
docker compose exec avatar-agent curl -s http://localhost:3000/api/bot-connections

# 检查特定平台连接状态
docker compose exec avatar-agent curl -s "http://localhost:3000/api/bot-connections?platform=telegram"

# 重新测试连接（替换 CONNECTION_ID 为实际 CUID）
docker compose exec avatar-agent curl -X POST "http://localhost:3000/api/bot-connections/CONNECTION_ID/test"
```

**常见问题**:

| 问题 | 原因 | 解决 |
|------|------|------|
| Telegram "Unauthorized" | Token 错误 | 重新从 @BotFather 获取 Token |
| 飞书 "Webhook unreachable" | URL 格式不对 | 确认 URL 匹配 `https://open.feishu.cn/...` |
| Bot 不响应 | Webhook 未设置 | 参考[第 6 节](#6-bot-连接配置)设置 Webhook |
| 状态显示 "连接错误" | 测试 API 调用失败 | 检查服务器出站网络是否正常 |
| Bot 连接列表为空 | 数据库未自动种子 | 访问 GET /api/bot-connections 会自动创建默认连接 |

### 🔴 PWA 安装问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Chrome 不显示安装按钮 | 非 HTTPS | 绑定域名开启 HTTPS |
| iOS 无法添加到主屏幕 | 非 Safari 浏览器 | 必须使用 Safari，点击分享→添加到主屏幕 |
| 安装后白屏 | Service Worker 缓存 | 清除浏览器缓存，卸载重装 |
| 图标模糊 | 未生成所有尺寸图标 | 重新运行 `bun run scripts/generate-pwa-icons.ts` |

### 通用排查流程

```
1. 检查容器状态     → docker compose ps
2. 查看应用日志     → docker compose logs -f avatar-agent
3. 检查端口监听     → ss -tlnp | grep -E '3000|80|443'
4. 检查磁盘空间     → df -h
5. 检查内存使用     → free -h
6. 重启服务         → docker compose restart
7. 重建容器         → docker compose up -d --build
```

---

## 10. 手机端使用

### PWA 安装（推荐）

AVATAR Agent 支持 PWA（Progressive Web App），可以像原生 App 一样安装到手机桌面。

#### 📱 iPhone (iOS Safari)

1. 用 **Safari** 打开你的 AVATAR Agent 地址（必须 HTTPS）
2. 点击底部 **分享按钮** 📤
3. 选择 **"添加到主屏幕"**
4. 点击 **"添加"**
5. 桌面出现 AVATAR 图标，点击即可全屏使用

#### 🤖 Android (Chrome)

1. 用 **Chrome** 打开你的 AVATAR Agent 地址
2. 浏览器会自动弹出 **"添加到主屏幕"** 提示
3. 点击 **"安装"**
4. 也可手动点击 Chrome 菜单 → **"安装应用"**

#### 💻 桌面浏览器

1. Chrome/Edge 地址栏右侧出现 **安装图标** ⊕
2. 点击后选择 **"安装"**
3. 应用以独立窗口打开，无地址栏

> 💡 PWA 特性：
> - 🏠 全屏运行，无浏览器地址栏
> - 📴 离线缓存静态资源（对话需要网络）
> - 🔔 支持推送通知（未来）
> - 🎨 深色海洋主题 + 流动水波背景
> - 📱 8 种尺寸图标（72px~512px）适配各种设备

### Bot 使用

配置 Bot 连接后，你可以通过即时通讯工具与 AI 助手对话：

| 平台 | 使用方式 | 特点 |
|------|----------|------|
| Telegram | 直接与 Bot 对话 | 支持长文本、Markdown 格式 |
| 飞书 | 在群聊 @机器人 或私聊 | 企业场景，支持富文本 |
| 微信 | 在群聊 @机器人 | 日常使用，消息格式较简单 |

Bot 共享与网页版相同的记忆系统，所有对话内容会同步到记忆库。

### 设置页面安装指南

在 AVATAR Agent 中，**设置 → 移动端安装指南** 提供了详细的图文步骤，
包含 iPhone、Android 和桌面三端的安装说明。

---

## 📎 附录

### Docker Compose 参考

> 以下为项目实际使用的 `docker-compose.yml`

```yaml
version: "3.9"

services:
  avatar-agent:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    container_name: avatar-agent
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - avatar-db:/app/db          # 数据库命名卷
      - avatar-uploads:/app/upload  # 上传文件命名卷
    environment:
      - DATABASE_URL=file:./db/custom.db
      - NODE_ENV=production
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    networks:
      - avatar-net

  caddy:
    image: caddy:2-alpine
    container_name: avatar-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      avatar-agent:
        condition: service_healthy
    networks:
      - avatar-net

  backup:
    image: alpine:3.19
    container_name: avatar-backup
    restart: always
    volumes:
      - avatar-db:/db-source:ro     # 只读挂载数据库卷
      - ./backups:/backups            # 备份输出目录
    entrypoint: >
      sh -c '
        while true; do
          DATE=$$(date +%Y%m%d_%H%M)
          cp /db-source/custom.db /backups/avatar_$$DATE.db 2>/dev/null || true
          find /backups -name "*.db" -mtime +30 -delete 2>/dev/null || true
          echo "[$$DATE] Backup completed"
          sleep 86400
        done
      '

volumes:
  avatar-db:
  avatar-uploads:
  caddy-data:
  caddy-config:

networks:
  avatar-net:
    driver: bridge
```

### Dockerfile 参考（3 阶段构建）

```dockerfile
# ── Stage 1: Install dependencies ──
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false

# ── Stage 2: Build ──
FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate       # 生成 Prisma Client
RUN bun run build              # 构建 Next.js standalone

# ── Stage 3: Production ──
FROM oven/bun:1.2-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:./db/custom.db
RUN addgroup --system --gid 1001 avatar && \
    adduser --system --uid 1001 avatar
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/db && chown -R avatar:avatar /app/db /app
USER avatar
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
CMD ["bun", "server.js"]
```

### Caddyfile 参考

```
{$DOMAIN:localhost} {
    reverse_proxy avatar-agent:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
    }
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        Permissions-Policy "camera=(), microphone=(self), geolocation=()"
    }
    @static path *.js *.css *.png *.jpg *.svg *.ico *.woff2 *.woff
    header @static Cache-Control "public, max-age=31536000, immutable"
    @manifest path /manifest.json
    header @manifest Cache-Control "public, max-age=300"
    @sw path /sw.js /sw-register.js
    header @sw Cache-Control "no-cache, no-store, must-revalidate"
    encode gzip zstd
}
```

### 数据目录结构

```
/opt/avatar-agent/
├── deploy/                        # 部署目录
│   ├── README.md                  # 本文档
│   ├── Dockerfile                 # 3 阶段构建 (deps → builder → runner)
│   ├── docker-compose.yml         # 编排 3 个容器
│   ├── Caddyfile                  # Caddy 反向代理配置
│   ├── .env.example               # 环境变量模板
│   ├── deploy.sh                  # 一键部署脚本
│   ├── backup.sh                  # 手动备份脚本
│   ├── update.sh                  # 更新脚本
│   ├── .dockerignore              # Docker 忽略文件
│   └── backups/                   # 数据库备份目录
│       ├── avatar_20240101_0300.db
│       └── avatar_20240102_0300.db
├── src/                           # 源代码
├── prisma/schema.prisma           # 数据库 Schema
├── public/                        # 静态资源 + PWA 图标
├── package.json                   # 依赖配置
└── .env                           # 环境变量（不入库）
```

### Docker 卷说明

| 卷名 | 用途 | 容器内路径 |
|------|------|-----------|
| `avatar-db` | SQLite 数据库 | `/app/db` |
| `avatar-uploads` | 用户上传文件 | `/app/upload` |
| `caddy-data` | Caddy 证书和状态 | `/data` |
| `caddy-config` | Caddy 配置缓存 | `/config` |

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 |
| UI | shadcn/ui + Radix + Framer Motion |
| 后端 | Next.js API Routes + Prisma ORM |
| 数据库 | SQLite (开发/小规模) → PostgreSQL (生产扩展) |
| AI | z-ai-web-dev-sdk (20+ 模型) |
| 反向代理 | Caddy 2 (自动 HTTPS + 安全头 + 压缩 + PWA 缓存) |
| 容器化 | Docker + Docker Compose (3 服务) |
| 运行时 | Bun (oven/bun:1.2) |
| PWA | Service Worker + Web Manifest + 8 尺寸图标 |

---

> 🎯 **遇到问题？** 先查看[故障排查](#9-故障排查)章节，90% 的问题都能在那里找到答案。
