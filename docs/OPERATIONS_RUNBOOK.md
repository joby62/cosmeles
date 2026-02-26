# 予选（MatchUp）运维操作手册

这份手册用于固定日常操作，避免每次重新排查。

## 1. 三套 compose 的用途

- `docker-compose.dev.yml`
  - 用途：前端开发热更新（Next dev）
  - 端口：`5001 -> 3000`
  - 启动：`docker compose -f docker-compose.dev.yml up -d`

- `docker-compose.prod.yml`
  - 用途：前端生产构建（当前线上主用）
  - 端口：`5001 -> 3000`
  - 启动：`docker compose -f docker-compose.prod.yml up -d --build`

- `docker-compose.yml`
  - 用途：历史全栈方案（backend + frontend + nginx）
  - 入口端口：`5000`（nginx）
  - 启动：`docker compose up -d --build`

## 2. 当前推荐线上方案（Caddy + frontend prod）

当前你线上是：`Caddy` 反代 `cosmeles frontend(prod)`。

### 2.1 启动前端容器

在项目目录 `~/cosmeles`：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

健康检查：

```bash
curl -I http://127.0.0.1:5001
```

返回 `HTTP/1.1 200` 说明前端容器正常。

### 2.2 Caddy 反代配置

关键点：
- 如果 `caddy` 跑在 Docker 容器里，`127.0.0.1` 指向 caddy 容器自身，不能指向宿主机 frontend。
- 你的环境中应使用 Docker 网关地址：`172.17.0.1:5001`。

Caddyfile 示例：

```caddy
yuexuan.xyz {
    reverse_proxy 172.17.0.1:5001
}
```

重启 caddy：

```bash
docker restart caddy
docker logs --tail 100 caddy
```

域名检查：

```bash
curl -I https://yuexuan.xyz
```

返回 `HTTP/2 200` 为正常。

## 3. 常用命令清单

### 3.1 查看状态与日志

```bash
# 前端 prod
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 frontend

# caddy
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
docker logs --tail 200 caddy
```

### 3.2 重建与重启

```bash
# 重建前端 prod
docker compose -f docker-compose.prod.yml up -d --build

# 只重启前端容器
docker restart cosmeles-frontend

# 重启 caddy
docker restart caddy
```

### 3.3 清理孤儿容器告警

看到 `Found orphan containers` 时：

```bash
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

## 4. 502 快速排障（固定顺序）

1. 先看前端是否活着：

```bash
curl -I http://127.0.0.1:5001
```

2. 从 caddy 容器内看 upstream 是否可达：

```bash
docker exec -it caddy sh -lc 'curl -I http://172.17.0.1:5001'
```

3. 看 caddy 日志有没有连错端口（如 `127.0.0.1:5000 refused`）：

```bash
docker logs --tail 200 caddy
```

4. 修正 Caddyfile 后重启 caddy：

```bash
docker restart caddy
```

5. 最后验证域名：

```bash
curl -I https://yuexuan.xyz
```

## 5. 日常发布流程（你当前流程）

本地改代码后：

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

服务器上：

```bash
cd ~/cosmeles
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker restart caddy
curl -I https://yuexuan.xyz
```

## 6. 常见坑位

- `sudo nginx ...`：你现在不用 nginx，别再走这条命令。
- `sudo systemctl reload caddy`：仅在 systemd 管理 caddy 时可用；你当前是 Docker 容器，不适用。
- caddy 容器内反代 `127.0.0.1:5001`：会 502（指向容器自己）。
- `docker-compose.yml` 和 `docker-compose.prod.yml` 混用：容易端口/架构错位，线上统一使用 `docker-compose.prod.yml`。

