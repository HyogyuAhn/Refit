# File: utils.py
# 공통 JSON 로딩 함수
import os
import json

def load_json(filepath: str):
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, filepath)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
