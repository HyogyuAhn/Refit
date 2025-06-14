# # 고객 응대 자동화 실행 파일
# import os
# from kogpt2 import generate_response, save_response_log
# from tracking.tracking_system import get_order_info
# from validator.answer_validator import is_answer_aligned_with_db
# from convert_orders_to_natural_language import convert_orders_to_natural_language_by_category
# import json
# import numpy as np
# from langchain.schema import Document
# from langchain_community.vectorstores import FAISS
# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_community.cross_encoders import HuggingFaceCrossEncoder

# # --- 설정 ---
# embedding_model_name = "jhgan/ko-sbert-sts"
# embedding_model = HuggingFaceEmbeddings(model_name=embedding_model_name)

# category_fields = {
#     "AS": ["order_id", "order_date", "items"],
#     "payment": ["order_id", "payment", "order_status"],
#     "change": ["order_id", "items", "delivery", "order_date"],
#     "return": ["order_id", "items", "delivery", "payment", "order_date"],
#     "shipping": ["order_id", "delivery"],
#     "business": ["order_id"],
#     "order": ["order_id", "order_status", "items", "order_date"]
# }

# def load_json(filepath):
#     BASE_DIR = os.path.dirname(os.path.abspath(__file__))
#     path = os.path.join(BASE_DIR, filepath)
#     with open(path, "r", encoding="utf-8") as f:
#         return json.load(f)

# def extract_user_info_by_category(category: str, user_orders: list) -> list:
#     fields = category_fields.get(category, [])
#     result = []
#     for order in user_orders:
#         filtered = {field: order.get(field) for field in fields}
#         result.append(filtered)
#     return result

# def make_final_prompt(
#     question: str,
#     category: str,
#     user_orders: list,
#     policy: dict,
#     tracking_info: list = None
# ) -> str:
#     company_text = policy.get(category, {}).get("policy_summary", "정책 없음")
#     user_info_text = convert_orders_to_natural_language_by_category(category, user_orders)

#     prompt = f"""[고객 질문]
# {question}

# [회사 정책 문서]
# {company_text}

# [고객 관련 정보 요약]
# {user_info_text}
# """

#     if tracking_info:
#         formatted = "\n".join([
#             f"- 주문번호 {item['order_id']}: {item['info']}"
#             for item in tracking_info
#         ])
#         prompt += f"\n\n[배송 추적 정보]\n{formatted}"

#     prompt += "\n\n위 정보를 참고하여 친절하고 정확하게 고객의 질문에 답변해 주세요."
#     return prompt

# def needs_edit(similarity_score, question_text):
#     THRESHOLD_HIGH = 0.85
#     THRESHOLD_LOW = 0.6
#     keywords_need_edit = ['보상', '변경', '불만', '취소', '재발송', '환불', '지연', '문제', '요청']

#     if similarity_score < THRESHOLD_LOW:
#         return True
#     if similarity_score >= THRESHOLD_HIGH:
#         if any(kw in question_text for kw in keywords_need_edit):
#             return True
#         return False
#     return True

# def main():
#     category = input("카테고리를 입력해 주세요\nAS, payment, change, return, shipping, business, order\n: ")
#     question = input("질문을 입력해 주세요: \n")

#     user_orders = load_json("orders.json")
#     company_policy = load_json("company_policy.json")

#     order_summary_text = convert_orders_to_natural_language_by_category(category, user_orders)
#     tracking_info = get_order_info(order_summary_text)

#     print("[전처리된 고객 주문 요약]")
#     print(order_summary_text)

#     with open(f'Refit/models/embeddings/{category}_docs_with_intent.json', 'r', encoding='utf-8') as f:
#         data = json.load(f)

#     prompt_text = convert_orders_to_natural_language_by_category(category, user_orders)
#     response = generate_response(prompt_text)

#     docs, embeddings = [], []
#     for item in data:
#         metadata = item["metadata"].copy()
#         embedding = np.array(metadata.pop("embedding"), dtype=np.float32)
#         doc = Document(page_content=item["page_content"], metadata=metadata)
#         docs.append(doc)
#         embeddings.append(embedding)
#     embeddings = np.array(embeddings)

#     save_path = f"backend/embeddings/{category}_faiss_index"
#     if os.path.exists(save_path):
#         vectorstore = FAISS.load_local(save_path, embedding_model, allow_dangerous_deserialization=True)
#     else:
#         vectorstore = FAISS.from_documents(docs, embedding_model)
#         os.makedirs(save_path, exist_ok=True)
#         vectorstore.save_local(save_path)

#     retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
#     candidate_docs = retriever.invoke(question)

#     cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
#     pairs = [(question, doc.page_content) for doc in candidate_docs]
#     scores = cross_encoder.score(pairs)
#     scored_docs = sorted(zip(candidate_docs, scores), key=lambda x: x[1], reverse=True)

#     top_doc, top_score = scored_docs[0]
#     answer_text = top_doc.metadata.get('answer', '')
#     db_value = company_policy.get(category, {}).get("policy_summary", "")

#     if not needs_edit(top_score, question) and is_answer_aligned_with_db(answer_text, db_value):
#         print("\n[자동응답 - 유사도 높고 정책도 일치]")
#         print(f"답변: {answer_text}")
#     else:
#         tracking_info = []
#         if category == "shipping" and "배송" in question and ("추적" in question or "조회" in question):
#             for order in user_orders:
#                 order_id = order.get("order_id")
#                 if not order_id:
#                     continue
#                 try:
#                     info = get_order_info(order_id)
#                     tracking_info.append({"order_id": order_id, "info": info})
#                 except Exception as e:
#                     tracking_info.append({"order_id": order_id, "info": "조회 실패"})

#         prompt_text = make_final_prompt(question, category, user_orders, company_policy, tracking_info)
#         response = generate_response(prompt_text)

#         print("\n🤖 KoGPT2 응답:")
#         print(response)

#         save_response_log(question, prompt_text, response, category)

# if __name__ == "__main__":
#     main()


# 고객 응대 자동화 실행 파일
# 고객 응대 자동화 실행 파일
import os
from chatgpt import generate_refit_answer, save_response_log, select_response
from tracking.tracking_system import get_order_info
from validator.answer_validator import is_answer_aligned_with_db
from convert_orders_to_natural_language import convert_orders_to_natural_language_by_category
import json
import numpy as np
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

# --- 설정 ---
embedding_model_name = "jhgan/ko-sbert-sts"
embedding_model = HuggingFaceEmbeddings(model_name=embedding_model_name)

category_fields = {
    "AS": ["order_id", "order_date", "items"],
    "payment": ["order_id", "payment", "order_status"],
    "change": ["order_id", "items", "delivery", "order_date"],
    "return": ["order_id", "items", "delivery", "payment", "order_date"],
    "shipping": ["order_id", "delivery"],
    "business": ["order_id"],
    "order": ["order_id", "order_status", "items", "order_date"]
}

def load_json(filepath):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(BASE_DIR, filepath)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def extract_user_info_by_category(category: str, user_orders: list) -> list:
    fields = category_fields.get(category, [])
    result = []
    for order in user_orders:
        filtered = {field: order.get(field) for field in fields}
        result.append(filtered)
    return result

def make_final_prompt(
    question: str,
    category: str,
    user_orders: list,
    policy: dict,
    topk_docs_text: str,
    tracking_info: list = None
) -> str:
    company_text = policy.get(category, {}).get("policy_summary", "정책 없음")
    user_info_text = convert_orders_to_natural_language_by_category(category, user_orders)

    prompt = f"""[고객 질문]
{question} 
[회사 정책 요약]
{company_text}

[고객 주문 요약]
{user_info_text}

[관련 정책 문서 발췌]
{topk_docs_text}"""

    if tracking_info:
        formatted = "\n".join([
            f"- 주문번호 {item['order_id']}: {item['info']}"
            for item in tracking_info
        ])
        prompt += f"\n\n[배송 추적 정보]\n{formatted}"

    prompt += "\n\n위 정보를 바탕으로, 고객 질문에 대해 정확하고 친절한 답변을 생성해주세요."
    return prompt

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

def main():
    category = input("카테고리를 입력해 주세요\nAS, payment, change, return, shipping, business, order\n: ")
    question = input("질문을 입력해 주세요: \n")

    user_orders = load_json("orders.json")
    company_policy = load_json("company_policy.json")

    print("[전처리된 고객 주문 요약]")
    order_summary_text = convert_orders_to_natural_language_by_category(category, user_orders)
    print(order_summary_text)

    with open(f'Refit/models/embeddings/{category}_docs_with_intent.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    docs, embeddings = [], []
    for item in data:
        metadata = item["metadata"].copy()
        embedding = np.array(metadata.pop("embedding"), dtype=np.float32)
        doc = Document(page_content=item["page_content"], metadata=metadata)
        docs.append(doc)
        embeddings.append(embedding)
    embeddings = np.array(embeddings)

    save_path = f"backend/embeddings/{category}_faiss_index"
    if os.path.exists(save_path):
        vectorstore = FAISS.load_local(save_path, embedding_model, allow_dangerous_deserialization=True)
    else:
        vectorstore = FAISS.from_documents(docs, embedding_model)
        os.makedirs(save_path, exist_ok=True)
        vectorstore.save_local(save_path)

    retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
    candidate_docs = retriever.invoke(question)

    cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
    pairs = [(question, doc.page_content) for doc in candidate_docs]
    scores = cross_encoder.score(pairs)
    scored_docs = sorted(zip(candidate_docs, scores), key=lambda x: x[1], reverse=True)

    print("\n📚 [Top-K 참조 문서]")
    for i, (doc, score) in enumerate(scored_docs[:3], 1):
        print(f"[{i}] (score={score:.3f}) {doc.page_content}\n")

    top_doc, top_score = scored_docs[0]
    answer_text = top_doc.metadata.get('answer', '')
    db_value = company_policy.get(category, {}).get("policy_summary", "")

    if not needs_edit(top_score, question) and is_answer_aligned_with_db(answer_text, db_value):
        print("\n[자동응답 - 유사도 높고 정책도 일치]")
        print(f"답변: {answer_text}")
    else:
        tracking_info = []
        if category == "shipping" and "배송" in question and ("추적" in question or "조회" in question):
            for order in user_orders:
                order_id = order.get("order_id")
                if not order_id:
                    continue
                try:
                    info = get_order_info(order_id)
                    tracking_info.append({"order_id": order_id, "info": info})
                except Exception:
                    tracking_info.append({"order_id": order_id, "info": "조회 실패"})

        topk_contexts = "\n".join([f"- {doc.page_content}" for doc, _ in scored_docs[:3]])
        prompt_text = make_final_prompt(question, category, user_orders, company_policy, topk_contexts, tracking_info)

    # 🔽 다중 응답 생성 및 선택 UI
    candidates = generate_refit_answer(prompt_text)
    final_answer = select_response(candidates)

    print(f"\n✅ 최종 전송 응답:\n{final_answer}")
    print("-" * 60)

    save_response_log(question, prompt_text, final_answer, category)

if __name__ == "__main__":
    main()

