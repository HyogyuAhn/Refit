# main.py

import os
import json
import numpy as np
import openai
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

openai.api_key = os.getenv("OPENAI_API_KEY")
embedding_model = HuggingFaceEmbeddings(model_name="jhgan/ko-sbert-sts")
TH_HIGH = 0.85
TH_LOW = 0.6

def load_json(filepath: str):
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, filepath)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def convert_orders_to_natural_language_by_category(category: str, orders: list) -> str:
    lines = []
    for o in orders:
        oid = o.get("order_id", "알 수 없음")
        dlv = o.get("delivery", {})
        pay = o.get("payment", {})
        items = o.get("items", [])
        date = o.get("order_date", "알 수 없음")
        if category == "shipping":
            lines.append(
                f"주문번호 {oid}는 {pay.get('method','결제수단')}({pay.get('method_detail','')})로 "
                f"{pay.get('amount',0):,}원이 결제되었고, 배송 상태는 {dlv.get('status','확인불가')}입니다. "
                f"운송장 번호: {dlv.get('tracking_number','없음')}."
            )
        elif category == "payment":
            lines.append(
                f"주문번호 {oid}는 {pay.get('method','결제수단')}({pay.get('method_detail','')})로 "
                f"{pay.get('amount',0):,}원이 결제되었으며, 현재 상태는 {o.get('order_status','미확인')}입니다."
            )
        elif category == "AS":
            lines.append(
                f"주문번호 {oid}는 {date}에 주문되었고, 구성 상품은 {', '.join(items)}입니다."
            )
        elif category == "return":
            lines.append(
                f"주문번호 {oid}는 {date}에 주문되었고, {pay.get('method','')}로 결제되었습니다. "
                f"배송 상태: {dlv.get('status','')}. 반품 요청 가능."
            )
        elif category == "change":
            lines.append(
                f"주문번호 {oid}는 {date}에 주문되었고, 배송 상태는 {dlv.get('status','확인불가')}입니다. "
                f"상품: {', '.join(items)}."
            )
        elif category == "order":
            lines.append(
                f"주문번호 {oid}는 {date}에 주문되었으며, 현재 상태는 {o.get('order_status','')}입니다. "
                f"상품: {', '.join(items)}."
            )
        elif category == "business":
            lines.append(f"주문번호 {oid} 관련 문의.")
        else:
            lines.append(f"{oid} 관련 정보 확인 필요.")
    return "\n".join(lines)

def make_final_prompt(question: str, category: str, orders: list, policy: dict) -> str:
    policy_text = policy.get(category, "정책 없음")
    user_text = convert_orders_to_natural_language_by_category(category, orders)
    return (
        f"[고객 질문]\n{question}\n\n"
        f"[회사 정책]\n{policy_text}\n\n"
        f"[고객 정보 요약]\n{user_text}"
    )

def needs_edit(score: float, text: str) -> bool:
    keywords = ['보상','변경','불만','취소','재발송','환불','지연','문제','요청']
    if score < TH_LOW:
        return True
    if score >= TH_HIGH and any(k in text for k in keywords):
        return True
    return False

def retrieve_and_rerank(question: str, category: str):
    data = load_json(f"backend/embeddings/{category}_docs_with_intent.json")
    docs, embs = [], []
    for item in data:
        md = item["metadata"].copy()
        emb = np.array(md.pop("embedding"), dtype=np.float32)
        docs.append(Document(page_content=item["page_content"], metadata=md))
        embs.append(emb)
    embs = np.array(embs)

    idx_path = f"backend/embeddings/{category}_faiss_index"
    if os.path.exists(idx_path):
        store = FAISS.load_local(idx_path, embedding_model, allow_dangerous_deserialization=True)
    else:
        store = FAISS.from_documents(docs, embedding_model)
        os.makedirs(idx_path, exist_ok=True)
        store.save_local(idx_path)

    retriever = store.as_retriever(search_kwargs={"k":10})
    candidates = retriever.invoke(question)

    reranker = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
    pairs = [(question, d.page_content) for d in candidates]
    scores = reranker.score(pairs)
    return sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)

def main():
    category = input("카테고리 (AS, payment, change, return, shipping, business, order): ")
    question = input("질문:\n")
    user_orders = load_json("data/user_data.json")
    policy = load_json("data/company_policy.json")

    scored = retrieve_and_rerank(question, category)
    top_doc, top_score = scored[0]
    edit = needs_edit(top_score, question)

    if edit:
        # 편집 필요 시에만 GPT API 호출
        parts = [
            f"[고객 질문]\n{question}",
            f"[회사 정책]\n{policy.get(category,'정책 없음')}",
            f"[고객 정보 요약]\n{convert_orders_to_natural_language_by_category(category,user_orders)}"
        ]
        if top_score >= TH_HIGH:
            parts.append(f"[참고 답변]\n{top_doc.metadata.get('answer','')}")
        prompt = "\n\n".join(parts) + "\n\n위 정보를 참고하여 공식적으로 답변하십시오."

        resp = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=1000
        )
        answer = resp.choices[0].message.content.strip()
        print("\n[GPT 응답]\n", answer)
    else:
        # 편집 불필요 시 기존 답변 그대로 출력
        print("\n[최종 답변]\n", top_doc.metadata.get('answer',''))

if __name__ == "__main__":
    main()
