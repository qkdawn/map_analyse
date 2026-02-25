"""
FastAPI主应用入口
职责：创建应用实例、集成中间件、挂载路由、处理请求生命周期
"""

import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import settings
from router import admin_router, app_router
from store import init_db
import asyncio
from modules.charting import build_svg, get_chart_path, pick_numeric_table, save_svg

# ==================== 配置日志 ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用生命周期管理"""
    logger.info("=" * 50)
    logger.info("应用启动中...")
    logger.info(f"基础URL: {settings.app_base_url}")
    logger.info(f"静态文件目录: {settings.static_dir}")
    logger.info("=" * 50)

    # 初始化数据库
    await asyncio.to_thread(init_db)

    # 确保静态文件目录存在
    os.makedirs(settings.static_dir, exist_ok=True)

    try:
        yield
    finally:
        logger.info("应用关闭中...")
        logger.info("应用已关闭")

# ==================== 创建FastAPI应用 ====================
app = FastAPI(
    title="高德地图扣子插件API",
    description="接收JSON数据，生成地图页面并返回URL链接",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.middleware.gzip import GZipMiddleware

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 开启Gzip压缩
app.add_middleware(GZipMiddleware, minimum_size=500)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from core.exceptions import BizError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation Error: {exc.body}")
    logger.error(f"Errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

@app.exception_handler(BizError)
async def biz_exception_handler(request, exc: BizError):
    logger.error(f"BizError: {exc.message} | Payload: {exc.payload}")
    return JSONResponse(
        status_code=exc.code,
        content={
            "status": "error",
            "message": exc.message,
            "detail": exc.payload
        },
    )


# 确保静态目录存在（统一的静态资源根目录）
STATIC_ROOT = Path(settings.static_dir).resolve()
os.makedirs(STATIC_ROOT, exist_ok=True)

# 挂载静态资源目录（同时覆盖生成的HTML和拆分的CSS/JS等资源）
# 改为 /static 路径，防止和API路径冲突
app.mount(
    "/static",
    StaticFiles(directory=STATIC_ROOT),
    name="static",
)

# ==================== API路由 ====================

app.include_router(app_router)
app.include_router(admin_router)

# ==================== 图表接口 ====================

@app.post("/bar_chart")
async def bar_chart(request: Request):
    text = (await request.body()).decode("utf-8")
    x_title, labels, series, values = pick_numeric_table(text)
    svg_content = build_svg(labels, series, values, x_title=x_title)

    chart_id, filename = save_svg(svg_content)
    base_url = str(request.base_url).rstrip("/")
    return {
        "chart_id": chart_id,
        "url": f"{base_url}/download/{filename}",
        "series": series,
        "labels": labels,
        "x_title": x_title,
        "chart": {
            "labels": labels,
            "series": series,
            "values": values,
        },
    }


@app.get("/download/{filename}")
def download_chart(filename: str):
    filepath = get_chart_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Chart not found.")
    return FileResponse(
        filepath,
        media_type="image/svg+xml",
        filename=os.path.basename(filepath),
    )

# ==================== 主入口 ====================

if __name__ == "__main__":
    import uvicorn

    logger.info("启动FastAPI应用...")
    logger.info(f"访问地址: http://localhost:{settings.app_port}")
    logger.info(f"API文档: http://localhost:{settings.app_port}/docs")

    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=True,
        log_level="info"
    )
