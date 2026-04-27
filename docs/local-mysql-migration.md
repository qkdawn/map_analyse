# 本地 MySQL 迁移说明

目标：把两个远端库都迁到本地 MySQL。

- `aliyunsz`：`search` 服务使用的 POI 源库
- `gaode_deploy`：`gaode-map` 主应用使用的业务库

## 1. 启动本地 MySQL

如果本机还没有 MySQL，可以先用 Docker 起一个：

```powershell
docker run -d `
  --name map-analyse-mysql `
  -e MYSQL_ROOT_PASSWORD=<local-root-password> `
  -e MYSQL_DATABASE=bootstrap `
  -p 3306:3306 `
  -v map_analyse_mysql_data:/var/lib/mysql `
  mysql:8.4
```

检查是否启动完成：

```powershell
docker logs map-analyse-mysql --tail 50
```

## 2. 迁移 `gaode_deploy`

```powershell
python scripts/mysql_copy_db.py `
  --src-host rm-cn-2ml4ma7vf00012go.rwlb.rds.aliyuncs.com `
  --src-port 3306 `
  --src-user place `
  --src-password "<remote-gaode-deploy-password>" `
  --src-db gaode_deploy `
  --dst-host 127.0.0.1 `
  --dst-port 3306 `
  --dst-user root `
  --dst-password "<local-root-password>" `
  --dst-db gaode_deploy `
  --truncate-first
```

这个库较小，通常会很快完成。

## 3. 迁移 `aliyunsz`

```powershell
python scripts/mysql_copy_db.py `
  --src-host 47.115.253.238 `
  --src-port 3306 `
  --src-user place `
  --src-password "<remote-aliyunsz-password>" `
  --src-db aliyunsz `
  --dst-host 127.0.0.1 `
  --dst-port 3306 `
  --dst-user root `
  --dst-password "<local-root-password>" `
  --dst-db aliyunsz `
  --truncate-first `
  --batch-size 2000
```

说明：

- `aliyunsz.regions` 体量约 15 GiB，迁移时间会明显更久
- 迁移过程中脚本会按批提交，并打印已复制行数
- 如果网络中断，可以重新执行；使用了 `--truncate-first` 时会重建目标表后重跑

## 4. 切换项目到本地库

修改 [gaode-map/.env](/d:/Coding/map_analyse/gaode-map/.env)：

```env
DB_URL=mysql+pymysql://root:<local-root-password>@127.0.0.1:3306/gaode_deploy
```

修改 [search/.env](/d:/Coding/map_analyse/search/.env)：

```env
SPRING_DATASOURCE_URL=jdbc:mysql://127.0.0.1:3306/aliyunsz?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=<local-root-password>
```

## 5. 验证

先验证 `gaode_deploy`：

```powershell
@'
import pymysql
conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="<local-root-password>", database="gaode_deploy", charset="utf8mb4")
with conn.cursor() as cur:
    cur.execute("SHOW TABLES")
    print(cur.fetchall())
conn.close()
'@ | python -
```

再验证 `aliyunsz`：

```powershell
@'
import pymysql
conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="<local-root-password>", database="aliyunsz", charset="utf8mb4")
with conn.cursor() as cur:
    cur.execute("SHOW TABLES")
    print(cur.fetchall())
conn.close()
'@ | python -
```

## 6. 建议顺序

推荐顺序：

1. 先迁 `gaode_deploy`
2. 改 `gaode-map/.env` 验证主应用
3. 再迁 `aliyunsz`
4. 改 `search/.env` 验证查询服务

这样即使大库迁移时间长，也不会影响你先把业务库本地化跑起来。
