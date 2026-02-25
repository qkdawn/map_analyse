from typing import Any, Dict, Optional

class BizError(Exception):
    """
    通用业务异常
    """
    def __init__(
        self, 
        message: str, 
        code: int = 400, 
        payload: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.payload = payload or {}
        super().__init__(self.message)

class ExternalApiError(BizError):
    """
    第三方API调用失败 (如高德)
    """
    def __init__(self, message: str, original_error: str = ""):
        super().__init__(
            message=message, 
            code=502, 
            payload={"original_error": str(original_error)}
        )
