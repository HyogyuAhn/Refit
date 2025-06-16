# File: retriever.py
# 임베딩 검색 및 재순위
import os
import numpy as np
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from .utils import load_json

EMBEDDING_MODEL_NAME = "jhgan/ko-sbert-sts"


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
    model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)
    if os.path.exists(idx_path):
        store = FAISS.load_local(idx_path, model, allow_dangerous_deserialization=True)
    else:
        store = FAISS.from_documents(docs, model)
        os.makedirs(idx_path, exist_ok=True)
        store.save_local(idx_path)

    retriever = store.as_retriever(search_kwargs={"k": 10})
    candidates = retriever.invoke(question)

    reranker = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
    pairs = [(question, d.page_content) for d in candidates]
    scores = reranker.score(pairs)
    return sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)