from flask import Flask, request, jsonify
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
import json
import numpy as np
import os

app = Flask(__name__)

# 전역 설정
embedding_model_name = "jhgan/ko-sbert-sts"
embedding_model = HuggingFaceEmbeddings(model_name=embedding_model_name)
cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")

# JSON + FAISS 불러오기 함수
def load_vectorstore(category):
    json_path = f'backend/embeddings/{category}_docs_with_intent.json'
    faiss_path = f'backend/embeddings/{category}_faiss_index'

    with open(json_path, 'r', encoding='utf-8') as f:
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

    if os.path.exists(faiss_path):
        vectorstore = FAISS.load_local(faiss_path, embedding_model, allow_dangerous_deserialization=True)
    else:
        vectorstore = FAISS.from_documents(docs, embedding_model)
        os.makedirs(faiss_path, exist_ok=True)
        vectorstore.save_local(faiss_path)

    return vectorstore

@app.route('/query', methods=['POST'])
def handle_query():
    try:
        data = request.get_json()
        category = data.get('category')
        query = data.get('query')

        if not category or not query:
            return jsonify({"error": "Both 'category' and 'query' are required."}), 400

        # 벡터스토어 및 리트리버 로드
        vectorstore = load_vectorstore(category)
        retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
        candidate_docs = retriever.invoke(query)

        # CrossEncoder로 재정렬
        pairs = [(query, doc.page_content) for doc in candidate_docs]
        scores = cross_encoder.score(pairs)
        scored_docs = sorted(zip(candidate_docs, scores), key=lambda x: x[1], reverse=True)

        # 상위 3개 결과 정리
        results = []
        for doc, score in scored_docs[:3]:
            results.append({
                "question": doc.metadata.get("question", ""),
                "answer": doc.metadata.get("answer", ""),
                "intent": doc.metadata.get("intent", ""),
                "score": round(score, 4)
            })

        return jsonify({"results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

'''
요청청
POST /query
Content-Type: application/json

{
  "category": "return",
  "query": "포장 어떻게 해서 보내야 하나요?"
}
응답
{
  "results": [
    {
      "question": "반품 보낼 때 포장 어떻게 해야 하나요?",
      "answer": "상품이 파손되지 않도록 박스에 안전하게 포장해 주세요.",
      "intent": "반품-포장",
      "score": 0.9123
    },
    ...
  ]
}

'''