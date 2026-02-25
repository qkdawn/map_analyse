"""
模板渲染相关工具。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

from core.config import settings

logger = logging.getLogger(__name__)

_templates_env = Environment(
    loader=FileSystemLoader(Path(settings.templates_dir).resolve()),
    autoescape=False,
)


def load_type_config() -> dict:
    """读取统一类型配置（前后端共用）。"""
    path = Path(__file__).resolve().parent.parent / "share" / "type_map.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        logger.error("类型配置文件不存在: %s", path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="类型配置文件不存在，请联系管理员",
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("类型配置文件读取失败: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"类型配置文件读取失败: {exc}",
        )


async def render_template(context: dict | None = None) -> str:
    """渲染Jinja模板，返回HTML文本。"""
    try:
        template = _templates_env.get_template(settings.template_name)
        content = template.render(**(context or {}))
        logger.debug("模板渲染成功: %s", settings.template_name)
        return content
    except TemplateNotFound:
        logger.error("模板文件不存在: %s", settings.template_name)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="模板文件不存在，请联系管理员",
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("模板渲染失败: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模板渲染失败: {exc}",
        )


async def generate_html_content(data, map_id: int | None = None) -> str:
    """
    异步生成HTML内容：读取模板并替换变量。
    """
    data_json = json.dumps(data.model_dump(), ensure_ascii=False, indent=4)
    type_config_json = json.dumps(load_type_config(), ensure_ascii=False)

    js_key = (settings.amap_js_api_key or "").strip()
    if not js_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AMAP_JS_API_KEY 未配置",
        )
    js_security = (settings.amap_js_security_code or "").strip()

    html_content = await render_template(
        {
            "map_data_json": data_json,
            "map_type_config_json": type_config_json,
            "amap_js_api_key": js_key,
            "amap_js_security_code": js_security,
            "map_id": map_id,
        }
    )
    logger.debug("HTML内容生成成功")
    return html_content
