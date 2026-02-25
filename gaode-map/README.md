### 说明
- fastapi开发的高德/本地map后端 + 使用html原生jinjia2模板开发的高德地图
- 请确保安装核心依赖: `pip install -r requirements.txt` (包含 `h3` 网格计算库)
- 空间句法路网分析已切换为 `depthmapXcli` 引擎，请确保已安装并在 `.env` 配置 `DEPTHMAPX_CLI_PATH`

### Docker 一键部署（含 depthmapXcli）
- 镜像已在 `docker/Dockerfile` 内自动安装 `depthmapXcli`（默认 `v0.8.0`）。
- 云端部署前至少配置 `.env` 的 `AMAP_WEB_SERVICE_KEY`。
- 启动命令：
```bash
docker compose up -d --build
```
- 如果需要切换 depthmapX 版本：
```bash
docker compose build --build-arg DEPTHMAPX_VERSION=v0.8.0 app
docker compose up -d
```
- `valhalla` 的 `custom_files` 挂载目录可通过环境变量覆盖：
```bash
export VALHALLA_CUSTOM_FILES_DIR='D:\MapData\osm_source'
docker compose up -d
```
- 路网句法分析仅使用本地/私有 Overpass。请在 `.env` 配置：
```bash
OVERPASS_ENDPOINT=http://overpass/api/interpreter
```
  说明：建议 Overpass 和 Valhalla 使用同一份 OSM 源数据（同一批 PBF），这样等时圈与句法路网是一致同源的。

### 本地 Overpass（句法路网）配置
1. 将 `*.osm.pbf` 放到外部目录（建议 `D:\MapData\osm_source`），文件名与 `.env` 中 `OVERPASS_PBF_FILE` 一致（默认 `hunan-260201.osm.pbf`）。
2. Overpass 持久化目录建议使用独立外部目录（如 `D:\MapData\overpass_db`，首次导入会写入大量索引文件）。
3. 确认 `.env`：
```bash
OVERPASS_ENDPOINT=http://overpass/api/interpreter
OVERPASS_PBF_FILE=hunan-260201.osm.pbf
DEPTHMAPX_CLI_PATH=/usr/local/bin/depthmapXcli
VALHALLA_SERVER_THREADS=2
VALHALLA_CUSTOM_FILES_DIR=D:\MapData\osm_source
VALHALLA_TILES_DIR=D:\MapData\valhalla_tiles
OVERPASS_DB_DIR=D:\MapData\overpass_db
OVERPASS_SOURCE_DIR=D:\MapData\osm_source
```
   这样 Valhalla 与 Overpass 会共用同一份 PBF（同源），但各自输出目录独立。
4. 启动：
```bash
docker compose up -d --build
```
5. 首次导入完成后可用此地址自测：
```bash
http://localhost:8003/api/interpreter
```

### 天地图本地开发配置
- `TIANDITU_KEY` 只需要配置在 `.env`，例如：`TIANDITU_KEY=your_tianditu_key`。
- 当前前端“天地图底图”采用 `WMTS over AMap`（通过高德容器承载天地图瓦片），会请求 `vec_w`（底图）+ `cva_w`（注记）两层。
- 本地开发白名单模板（天地图控制台中配置 Referer/域名白名单）：
  - `localhost`
  - `127.0.0.1`
  - `localhost:8000`
  - `127.0.0.1:8000`
- `0.0.0.0` 仅用于服务监听（如 `APP_HOST=0.0.0.0`），不是 Referer 白名单值。
- 天地图链路不需要像高德 JS 一样额外配置 `security code`。

### 📚 接口文档 (API Reference)

本项目提供 REST API，主要分为分析、地图管理和后台管理三类。

#### 1. 核心分析 API
| 方法 | 路径 | 描述 | 参数示例 |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/analysis/pois` | **抓取 POI 数据**<br>根据多边形范围抓取高德 POI | `{ "polygon": [[120,30]...], "keywords": "咖啡", "types": "050000" }` |
| `POST` | `/api/v1/analysis/isochrone` | **生成等时圈**<br>计算如“15分钟步行范围”的多边形 | `{ "lat": 30.1, "lon": 120.2, "time_min": 15, "mode": "walking" }` |
| `POST` | `/api/v1/analysis/h3-grid` | **生成 H3 网络**<br>将等时圈 polygon 转换为可渲染网格 GeoJSON | `{ "polygon": [[120,30]...], "resolution": 10, "coord_type": "gcj02", "include_mode": "intersects", "min_overlap_ratio": 0.15 }` |
| `POST` | `/api/v1/analysis/h3-metrics` | **计算 H3 网格分析**<br>对 POI 做网格聚合并返回密度/熵/邻域指标与图表数据 | `{ "polygon": [[120,30]...], "resolution": 10, "pois": [...], "neighbor_ring": 1 }` |
| `GET` | `/api/v1/analysis/history` | **获取分析历史**<br>查看之前的抓取记录 | `?limit=20` |

#### 2. 地图管理 API
| 方法 | 路径 | 描述 | 参数示例 |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/generate-map` | **生成地图数据**<br>抓取并缓存基础地图数据 | `{ "place": "西湖区", "type": "city" }` |
| `GET` | `/api/v1/config` | **获取前端配置**<br>获取 API Key 等公开配置 | 无 |

#### 3. 后台管理 API
| 方法 | 路径 | 描述 | 权限 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/maps` | **地图列表**<br>查看所有缓存的地图数据 | Admin |
| `DELETE` | `/api/v1/admin/maps/{id}` | **删除地图**<br>清理过期的地图缓存 | Admin |

更多接口详情，启动服务后访问在线文档：
`http://localhost:8000/docs`

### ✅ 测试入口
- 当前主要的测试/演示流程集中在 **工作台页面**：`/analysis`
- 地图生成与展示仍可通过 `/map` 相关接口/页面验证

### 数据库
- 支持 **SQLite** (默认, 本地开发) 和 **MySQL** (生产环境, 推荐)。
- 详见 `DEPLOY_MYSQL.md` 配置指南。
