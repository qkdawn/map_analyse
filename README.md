# map_analyse Monorepo

统一管理地图分析相关服务：

- `gaode-map`：FastAPI 主后端 + 页面模板
- `search`：Spring Boot 历史数据查询服务
- `host_bridge`：ArcGIS/ArcPy 桥接服务
- `scripts`：联调与验证脚本

## 目录结构

```text
map_analyse/
  gaode-map/      # Python/FastAPI 主服务（含 docker-compose）
  search/         # Java/Spring Boot 查询服务
  host_bridge/    # ArcGIS Host Bridge
  scripts/        # 验证/辅助脚本
```

## 端口约定

- `8000`：`gaode-map` app
- `8001`：`search`
- `8002`：`valhalla`（由 compose 启动）
- `8003`：`overpass`（由 compose 启动）
- `18081`：`host_bridge`

## 快速开始（推荐）

1. 准备环境文件：
   - `gaode-map/.env`（可从 `.env.example` 拷贝）
   - `search/.env`（可从 `.env.example` 拷贝）
2. 启动主服务栈（Docker）：

```bash
make up
```

3. 可选：启动 ArcGIS Host Bridge（宿主机）：

```bash
make bridge
```

4. 查看服务状态：

```bash
make ps
```

## 常用命令

```bash
make help           # 查看全部命令
make up             # 启动/重建 gaode-map + search + valhalla + overpass
make down           # 停止服务栈
make logs           # 查看 compose 日志
make bridge         # 启动 host_bridge
make search-local   # 本地启动 search（不走 docker）
make app-local      # 本地启动 gaode-map（不走 docker）
make verify-h3      # 运行 h3-grid API 验证脚本
```

## Windows 一键入口

- `open_docker_deploy_config.bat`: 打开 `gaode-map/docker-compose.prod.yml`、`gaode-map/docker-compose.yml`、`gaode-map/.env`
- `open_host_bridge_config.bat`: 打开 `host_bridge/README.md`、`host_bridge/start_bridge.bat`、`gaode-map/.env`
- `start_docker_prod.bat`: 双击启动 Docker 部署栈
- `start_host_bridge.bat`: 双击启动宿主机 `host_bridge`
- `start_docker_and_host_bridge.bat`: 一键同时启动 Docker 部署栈和 `host_bridge`

## 开发说明

- 各模块详细说明见：
  - `gaode-map/README.md`
  - `search/README.md`
  - `host_bridge/README.md`
- 敏感配置（如 `.env`）已在根 `.gitignore` 中统一忽略。
