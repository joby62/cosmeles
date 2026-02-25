## Backend
cd backend
uvicorn app.main:app --reload --port 8001

## Frontend
cd frontend
npm run dev

TODO list
把 storage 持久化 + 备份策略（最高 ROI）

你未来启用 upload，所有用户上传、JSON、SQLite 都会落在 backend/storage。
所以 “持久化 + 可备份” 是第一优先。

你已经做了 volume：./backend/storage:/app/storage ✅

现在加一个每天备份一次（极低成本，救命级别）

立刻做：健康检查 + 自动重启策略（稳定性）

你 compose 里已经 restart: unless-stopped 了 ✅
再加一个轻量健康检查（不改业务也能做）：

后端：检查 http://localhost:8000/api/products 是否返回 200

前端：检查 http://localhost:3000/ 是否返回 200

这能让容器在异常时更快恢复。
（如果你愿意我给你“整文件覆盖版 docker-compose.yml”加 healthcheck，我可以直接给你完整文件。）

浴室里的最终答案。

予选/sudo systemctl status snap.caddy.caddy亦然
MatchUp/PickIt


予选
浴室里的最终答案
我们替你看完所有选择，
只留下真正值得用的那一个。


基于成分、适用人群与真实使用体验，
我们给出每个品类唯一的推荐。