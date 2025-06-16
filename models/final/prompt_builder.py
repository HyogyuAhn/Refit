# File: prompt_builder.py
# 최종 프롬프트 생성
from .summarizer import convert_orders_to_natural_language_by_category

def make_final_prompt(question: str, category: str, orders: list, policy: dict) -> str:
    policy_text = policy.get(category, "정책 없음")
    user_text = convert_orders_to_natural_language_by_category(category, orders)
    return (
        f"[고객 질문]\n{question}\n\n"
        f"[회사 정책]\n{policy_text}\n\n"
        f"[고객 정보 요약]\n{user_text}"
    )