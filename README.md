# map_analyse Monorepo

统一管理地图分析相关服务。这个仓库是父仓库，只负责组织各个子项目；具体业务代码放在各自子仓库里，并通过 Git submodule 固定版本。

## 子项目

- `gaode-map`：FastAPI 主后端、前端页面与地图分析能力。
- `search`：Spring Boot POI / 历史数据查询服务。
- `host_bridge`：ArcGIS / ArcPy 桥接服务。计划作为 submodule 管理；当前 GitHub 远端尚未创建或无权限访问。
- `scripts`：联调、验证与数据处理脚本。计划作为 submodule 管理；当前 GitHub 远端尚未创建或无权限访问。

## 推荐克隆方式

```bash
git clone --recurse-submodules ssh://git@ssh.github.com:443/qkdawn/map_analyse.git
```

如果已经普通 clone 了父仓库，再执行：

```bash
git submodule update --init --recursive
```

## 常用工作流

更新所有子项目到父仓库记录的版本：

```bash
git submodule update --init --recursive
```

在某个子项目里开发并推送：

```bash
cd gaode-map
git checkout Kun_Expand
# 修改、测试、提交
git push origin Kun_Expand
cd ..
git add gaode-map
git commit -m "chore: update gaode-map submodule"
git push origin main
```

更新某个子项目到远端分支最新提交：

```bash
git submodule update --remote gaode-map
git add gaode-map
git commit -m "chore: bump gaode-map submodule"
```

## 端口约定

- `8000`：`gaode-map` app
- `8001`：`search`
- `8002`：`valhalla`，由 compose 启动
- `8003`：`overpass`，由 compose 启动
- `18081`：`host_bridge`

## 常用命令

```bash
make help           # 查看全部命令
make up             # 启动 / 重建 gaode-map + search + valhalla + overpass
make down           # 停止服务栈
make logs           # 查看 compose 日志
make bridge         # 启动 host_bridge
make search-local   # 本地启动 search，不走 docker
make app-local      # 本地启动 gaode-map，不走 docker
make verify-h3      # 运行 h3-grid API 验证脚本
```

## 注意事项

- 父仓库只提交 submodule 指针，不直接提交子项目源码。
- 子项目修改要先在子仓库提交并推送，再回到父仓库提交新的 submodule 指针。
- `.env` 等敏感配置不要提交；各子项目使用自己的 `.env.example`。
- `host_bridge` 和 `scripts` 需要先在 GitHub 创建对应仓库后，才能加入为可克隆的远端 submodule。
