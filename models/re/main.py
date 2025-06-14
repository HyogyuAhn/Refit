import json
import numpy as np
import os
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from validator.answer_validator import is_answer_aligned_with_db
from tracking.tracking_system import get_order_info
from kogpt2 import generate_response
from kogpt2 import save_response_log

# --- 1. 임베딩 모델 설정 ---
embedding_model_name = "jhgan/ko-sbert-sts"
embedding_model = HuggingFaceEmbeddings(model_name=embedding_model_name)

# --- 2. 카테고리별 고객정보 필드 정의 ---
category_fields = {
    "AS": ["order_id", "order_date", "items"],
    "payment": ["order_id", "payment", "order_status"],
    "change": ["order_id", "items", "delivery", "order_date"],
    "return": ["order_id", "items", "delivery", "payment", "order_date"],
    "shipping": ["order_id", "delivery"],
    "business": ["order_id"],
    "order": ["order_id", "order_status", "items", "order_date"]
}

# --- 3. JSON 파일 로드 함수 ---
def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

# --- 4. 카테고리 기준 고객정보 추출 함수 ---
def extract_user_info_by_category(category: str, user_orders: list) -> list:
    fields = category_fields.get(category, [])
    result = []
    for order in user_orders:
        filtered = {field: order.get(field) for field in fields}
        result.append(filtered)
    return result

# --- 5. 프롬프트 생성 함수 (배송 추적 정보 포함 가능) ---
def make_final_prompt(question: str, category: str, user_orders: list, policy: dict, tracking_info: list = None) -> str:
    company_text = policy.get(category, "해당 카테고리에 대한 회사 정책이 없습니다.")
    user_info = extract_user_info_by_category(category, user_orders)

    prompt = f"""[고객 질문]
{question}

[회사 정책 문서]
{company_text}

[고객 관련 정보 요약]
{json.dumps(user_info, ensure_ascii=False, indent=2)}"""

    if tracking_info:
        formatted = "\n".join([f"- 주문번호 {item['order_id']}: {item['info']}" for item in tracking_info])
        prompt += f"\n\n[배송 추적 정보]\n{formatted}"

    prompt += "\n\n위 정보를 참고하여 친절하고 정확하게 고객의 질문에 답변해 주세요."
    return prompt

# --- 6. 가공 필요 판단 함수 ---
def needs_edit(similarity_score, question_text):
    THRESHOLD_HIGH = 0.85
    THRESHOLD_LOW = 0.6
    keywords_need_edit = ['보상', '변경', '불만', '취소', '재발송', '환불', '지연', '문제', '요청']

    if similarity_score < THRESHOLD_LOW:
        return True
    if similarity_score >= THRESHOLD_HIGH:
        if any(kw in question_text for kw in keywords_need_edit):
            return True
        return False
    return True

# --- 7. 메인 함수 ---
def main():
    category = input("카테고리를 입력해 주세요\nAS, payment, change, return, shipping, business, order\n: ")
    question = input("질문을 입력해 주세요: \n")

    # 7.1 JSON 데이터 로드
    user_orders = load_json("backend/data/user_data.json")
    company_policy = load_json("backend/data/company_policy.json")

    # 7.2 저장된 데이터 로드
    with open(f'backend/embeddings/{category}_docs_with_intent.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    docs = []
    embeddings = []

    for item in data:
        metadata = item["metadata"].copy()
        embedding = np.array(metadata.pop("embedding"), dtype=np.float32)
        doc = Document(
            page_content=item["page_content"],
            metadata=metadata
        )
        docs.append(doc)
        embeddings.append(embedding)

    embeddings = np.array(embeddings)

    # 7.3 FAISS 인덱스 로드 또는 생성
    save_path = f"backend/embeddings/{category}_faiss_index"
    if os.path.exists(save_path):
        print("FAISS 인덱스가 존재합니다. 불러오는 중...")
        vectorstore = FAISS.load_local(save_path, embedding_model, allow_dangerous_deserialization=True)
    else:
        print("FAISS 인덱스가 없습니다. 새로 생성 중...")
        vectorstore = FAISS.from_documents(docs, embedding_model)
        os.makedirs(save_path, exist_ok=True)
        vectorstore.save_local(save_path)
        print("FAISS 인덱스 저장 완료!")
    print()

    retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

    # 7.4 후보 문서 top10 추출
    candidate_docs = retriever.invoke(question)

    # 7.5 CrossEncoder로 유사도 계산
    cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
    pairs = [(question, doc.page_content) for doc in candidate_docs]
    scores = cross_encoder.score(pairs)
    scored_docs = sorted(zip(candidate_docs, scores), key=lambda x: x[1], reverse=True)

    # 7.6 상위 3개 후보 출력
    print("\n🎯 [상위 3개 후보 출력 - 유사도 포함]")
    for i, (doc, score) in enumerate(scored_docs[:3], 1):
        print(f"{i}. 질문: {doc.metadata.get('question', '없음')}")
        print(f"   ↳ 답변: {doc.metadata.get('answer', '없음')}")
        print(f"   🧭 고객의도: {doc.metadata.get('intent', '없음')}")
        print(f"   📊 유사도 점수: {score:.4f}")
        print("-" * 50)

    # 7.7 응답 처리
    top_doc, top_score = scored_docs[0]
    answer_text = top_doc.metadata.get('answer', '')
    db_value = company_policy.get(category, {}) # 회사 정책 받아오기기
    print(company_policy.get("policy_summary", "해당 카테고리의 정책이 없습니다.")) # 정책 참고
    question_text = question

    if not needs_edit(top_score, question_text) and is_answer_aligned_with_db(answer_text, db_value):
        print("\n[자동응답 - 유사도 높고 정책도 일치]")
        print(f"답변: {answer_text}")
    else:
        print("\n[KOGPT2 생성형 응답 - 가공 필요]")

        # 배송 추적 정보 수집
        tracking_info = []
        if category == "shipping" and "배송" in question and ("추적" in question or "조회" in question):
            print("[배송추적 요청 감지] 모든 주문에 대해 배송 상태 확인 중...")
            for order in user_orders:
                order_id = order.get("order_id")
                if not order_id:
                    continue
                try:
                    info = get_order_info(order_id)
                    tracking_info.append({"order_id": order_id, "info": info})
                except Exception as e:
                    print(f"[오류] 주문번호 {order_id} 배송 정보 조회 실패: {str(e)}")
                    tracking_info.append({"order_id": order_id, "info": "배송 정보를 불러오는 데 실패했습니다."})

        prompt_text = make_final_prompt(
            question=question,
            category=category,
            user_orders=user_orders,
            policy=company_policy,
            tracking_info=tracking_info
        )

        print("\n📨 Prompt 입력값:")
        print(prompt_text)

        response = generate_response(prompt_text)
        print("\n🤖 생성된 KoGPT2 응답:")
        print(response)

        save_response_log(
            user_question=question,
            prompt=prompt_text,
            response=response,
            category=category
        )

if __name__ == "__main__":
    main()
