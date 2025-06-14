# kogpt2.py

import os
import re
import json
import openai
from typing import List
from datetime import datetime
from dotenv import load_dotenv

# ① .env 파일에서 OPENAI_API_KEY 로드
load_dotenv()  
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인하세요.")

# ② 반복 문장 제거 및 길이 제한 함수
def clean_response(text: str) -> str:
    # 의미 없는 반복 제거
    text = re.sub(r"(입니다\.)\s*\1+", r"\1", text)
    # 세 문장 이상이면 줄이기
    sentences = text.split(".")
    if len(sentences) > 3:
        return ". ".join(sentences[:3]).strip() + "…"
    return text.strip()

# ③ 욕설/비속어 필터 함수
def contains_profanity(text: str) -> bool:
    profane = ["씨발", "병신", "닥쳐", "좆", "ㅅ발"]
    lower = text.lower()
    return any(bad in lower for bad in profane)

# ④ Re:Fit 스타일 응답 생성 함수 (ChatGPT API 버전)
def generate_refit_answer(
    user_input: str,
    intent: str = "기타",
    external_info: str = "",
    prohibited_info: str = ""
) -> str:
    """
    기존 인터페이스 유지:
      user_input, intent, external_info, prohibited_info → 단일 텍스트 응답 반환
    내부적으로는 OpenAI ChatCompletion을 이용합니다.
    """
    # 시스템 프롬프트: 기존 KoGPT2용 지시문을 그대로 사용
    system_prompt = """
당신은 고객센터 응답을 생성하는 AI 어시스턴트입니다. 반드시 다음 원칙을 따르십시오.
- 문서 또는 고객 정보에서 직접 확인할 수 있는 내용만 안내할 것
- 추측·감정 표현·일반화 금지
- 번호나 글머리 기호(리스트) 없이, **한 문단**으로만 작성할 것
- 금지 표현: "아마 그럴 수 있어요", "보통은 그렇습니다" 등
""".strip()

    # 유저 블록 조합
    user_block = f"[고객의도] {intent}\n"
    if external_info:
        user_block += f"[고객 외부정보]\n{external_info}\n"
    if prohibited_info:
        user_block += f"[주의/금지사항]\n{prohibited_info}\n"
    user_block += f"사용자: {user_input}\n답변:"

    # ChatGPT API 호출 (최신 인터페이스)
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_block}
        ],
        temperature=0.6,
        top_p=0.8,
        max_tokens=200,
        n=3,
    )
    answer = resp.choices[0].message.content.strip()

    # 4) 후보 3개를 모두 수집하고 후처리
    candidates: List[str] = []
    for choice in resp.choices:
        text = choice.message.content.strip()
        # 중복 제거, 반복 제거, 욕설 필터 등 적용
        clean = re.sub(r"(입니다\.)\s*\1+", r"\1", text)
        clean = ". ".join(clean.split(".")[:3]).strip() + ("…" if len(clean.split("."))>3 else "")
        if not any(bad in clean for bad in ["씨발","병신","닥쳐","좆","ㅅ발"]):
            candidates.append(clean)

    return candidates

# ⑤ 응답 저장 함수 (기존 로직 재활용)
def save_response_log(
    user_question: str,
    prompt: str,
    response: str,
    category: str,
    save_dir: str = "response_logs"
):
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{save_dir}/{category}_{timestamp}.json"

    log = {
        "user_question": user_question,
        "prompt": prompt,
        "response": response,
        "category": category,
        "timestamp": timestamp
    }

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"📁 응답 결과 저장 완료: {filename}")

# ⑥ 후보 응답 선택 함수 (기존 로직 재활용)
def select_response(candidates: list[str]) -> str:
    """
    후보 응답 리스트에서 하나를 선택하는 인터랙티브 함수입니다.
    0번 선택 시 직접 입력 가능.
    """
    print("🤖 생성된 응답 후보:")
    for idx, cand in enumerate(candidates, 1):
        print(f"  {idx}. {cand}")
    print("  0. ❌ 후보에 적절한 응답이 없습니다. 직접 입력하기")

    while True:
        try:
            selected = int(input(f"👉 상담사가 선택할 응답 번호 (0~{len(candidates)}): "))
            if 0 <= selected <= len(candidates):
                break
            print(f"0~{len(candidates)} 사이의 숫자를 입력하세요.")
        except ValueError:
            print("숫자만 입력하세요.")

    if selected == 0:
        return input("✍ 직접 작성할 답변을 입력하세요:\n> ").strip()
    chosen = candidates[selected - 1]
    print(f"\n✏ 선택한 응답:\n👉 \"{chosen}\"\n👉 수정이나 엔터만 누르면 그대로 전송됩니다.")
    edited = input("> ").strip()
    return edited if edited else chosen
