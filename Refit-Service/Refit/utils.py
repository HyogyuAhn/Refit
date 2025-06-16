from typing import Dict, Any, Optional
import json
from datetime import datetime
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    detail: str

def format_datetime(dt: datetime) -> str:
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def parse_json(json_str: str) -> Dict[str, Any]:
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return {}

def format_api_key(key: str) -> str:
    if not key or len(key) < 10:
        return key
    return key[:6] + "***********"
