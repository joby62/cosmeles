# 予选（MatchUp）运维速查

这份文件只保留 day-2 运维动作。

完整部署、配置重查、单机到多机的 step-by-step，请先看：

- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)

## 1. 当前推荐运行方式

- 当前低成本线上基线：`single_node`
- 当前推荐启动命令：

```bash
cd ~/cosmeles
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

## 2. 常用检查

```bash
cd ~/cosmeles
docker compose -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
curl -sS -I http://127.0.0.1:5001
```

## 3. 常用日志

```bash
cd ~/cosmeles
docker compose -f docker-compose.prod.yml logs --tail=200 postgres backend worker frontend
```

## 4. 发布更新

```bash
cd ~/cosmeles
git pull origin main
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

## 5. 服务器重启后恢复

```bash
cd ~/cosmeles
git pull origin main
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend

# 自检
docker compose -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
curl -sS -I http://127.0.0.1:5001
```

## 6. 502 / 503 排障顺序

1. 先看 frontend 是否通：

```bash
curl -sS -I http://127.0.0.1:5001
```

2. 再看 backend 是否通：

```bash
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
```

3. 再看容器状态：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 backend worker frontend
```

## 7. 一个重要提醒

- `readyz` 只检查数据库和 storage
- 它不直接证明 Redis、worker poller、compare/upload/job smoke 都是通的
- 真改了 `split_runtime` / `multi_node` 配置后，还要做真实业务 smoke
- 如果 Caddy 跑在 Docker 容器里，upstream 不能写 `127.0.0.1`，要写宿主机网关，例如 `172.17.0.1:5001`
