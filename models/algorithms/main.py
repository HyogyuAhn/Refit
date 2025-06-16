import os
import json
import numpy as np
import openai
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

# --- 설정 ---
openai.api_key = os.getenv("OPENAI_API_KEY")
embedding_model = HuggingFaceEmbeddings(model_name="jhgan/ko-sbert-sts")

TH_HIGH = 0.85
TH_LOW = 0.6

# (기존 함수 정의들 생략)

def main():
    category = input("카테고리를 입력해 주세요 (AS, payment, change, return, shipping, business, order): ")
    question = input("질문을 입력해 주세요:\n")
    user_orders = load_json("data/user_data.json")
    company_policy = load_json("data/company_policy.json")

    # 요약 및 검색
    scored_docs = retrieve_and_rerank(question, category)
    top_doc, top_score = scored_docs[0]
    edit_needed = needs_edit(top_score, question)

    # 프롬프트 생성
    if edit_needed:
        parts = [
            f"[고객 질문]\n{question}",
            f"[회사 정책 문서]\n{company_policy.get(category, '정책 없음')}",
            f"[고객 관련 정보 요약]\n{convert_orders_to_natural_language_by_category(category, user_orders)}"
        ]
        if top_score >= TH_HIGH:
            parts.append(f"[참고 답변]\n{top_doc.metadata.get('answer', '')}")
        prompt_text = "\n\n".join(parts) + "\n\n위 정보를 참고하여 정확하고 정중하게 답변해 주세요."
    else:
        # 단순 응답 시에도 정책·상황 요약을 넣으려면 여기서 prompt_text 구성
        prompt_text = make_final_prompt(question, category, user_orders, company_policy)

    # GPT API 호출
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "당신은 고객응대를 전문으로 하는 AI입니다. 정확하고 공식적인 어투로 답변하세요."},
            {"role": "user", "content": prompt_text}
        ],
        temperature=0.5,
        max_tokens=1000,
        n=1,
        stop=None
    )
    answer = response.choices[0].message.content.strip()

    # 출력
    print("\n[GPT 응답]\n")
    print(answer)


if __name__ == "__main__":
    main()
