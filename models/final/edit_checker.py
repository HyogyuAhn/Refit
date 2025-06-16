# File: edit_checker.py
# 점수와 키워드 기반 편집 여부 판단
KEYWORDS = ['보상','변경','불만','취소','재발송','환불','지연','문제','요청']


def needs_edit(score: float, text: str, th_high: float = 0.85, th_low: float = 0.6) -> bool:
    if score < th_low:
        return True
    if score >= th_high and any(k in text for k in KEYWORDS):
        return True
    return False