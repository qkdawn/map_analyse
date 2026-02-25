import json
from typing import Optional, Sequence
from fastapi import HTTPException, status

def parse_json(raw_value: Optional[str]) -> Optional[Sequence[str]]:
    """
    解析 url 查询参数，支持 JSON 数组字符串或 null。
    """
    if raw_value is None:
        return None
    trimmed = raw_value.strip()
    if not trimmed or trimmed.lower() == "null":
        return None
    try:
        parsed = json.loads(trimmed)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="url 格式错误，应为 JSON 数组字符串",
        )
    if parsed is None:
        return None
    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="url 应为 JSON 数组",
        )
    return [str(item) for item in parsed]