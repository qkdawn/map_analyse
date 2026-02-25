# ArcGIS Host Bridge

Run this service on Windows host so Docker/WSL backend can request ArcPy computations by HTTP.

## 1) Prepare env

Copy `.env.example` values into your Windows environment (or set them in shell):

- `ARCGIS_TOKEN`
- `ARCGIS_PYTHON_PATH`
- `ARCGIS_SCRIPT_PATH`
- `ARCGIS_EXPORT_SCRIPT_PATH`
- `ARCGIS_ROAD_SYNTAX_SCRIPT_PATH`
- `ARCGIS_BRIDGE_PORT` (optional, default `18081`)

## 2) Install dependencies

```bash
pip install -r host_bridge/requirements.txt
```

## 3) Start service

```bat
host_bridge\start_bridge.bat
```

Health check:

```bash
curl http://127.0.0.1:18081/health
```

## 4) Backend bridge env (Docker/WSL)

Set in `gaode-map/.env`:

```dotenv
ARCGIS_BRIDGE_ENABLED=true
ARCGIS_BRIDGE_BASE_URL=http://host.docker.internal:18081
ARCGIS_BRIDGE_TOKEN=<same token as ARCGIS_TOKEN>
ARCGIS_BRIDGE_TIMEOUT_S=300
```

If your backend runs in Linux Docker, ensure compose includes:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Then restart backend container/app.
