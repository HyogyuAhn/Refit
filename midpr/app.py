from flask import Flask, request, jsonify, session
from sentence_transformers import SentenceTransformer, CrossEncoder, util
import json
import torch
import os
from flask_cors import CORS
import uuid
from datetime import datetime

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = os.urandom(24)

bi_encoder = SentenceTransformer('paraphrase-MiniLM-L6-v2')
cross_encoder = CrossEncoder('cross-encoder/stsb-roberta-base')

loaded_data = {}
chat_history = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EMBEDDING_DIR = os.path.join(BASE_DIR, "..", "models", "embeddings")
DATA_DIR = os.path.join(BASE_DIR, "..", "models", "datasets")

def load_category_data(category):
    if category in loaded_data:
        return loaded_data[category]

    embedding_path = os.path.join(EMBEDDING_DIR, f"{category}_embeddings_with_intent.json")
    data_path = os.path.join(DATA_DIR, f"{category}_cleaned_with_intent.json")

    if not os.path.exists(embedding_path) or not os.path.exists(data_path):
        return None

    with open(embedding_path, "r", encoding="utf-8") as f:
        embedded_data = json.load(f)["questions"]

    with open(data_path, "r", encoding="utf-8") as f:
        cleaned_data = json.load(f)

    questions = [item["질문"] for item in embedded_data]
    answers_dict = {item["질문"]: item.get("답변", "") for item in cleaned_data}

    data = {
        "questions": questions,
        "embeddings": torch.tensor([item["embedding"] for item in embedded_data]).to(device),
        "intent_embeddings": torch.tensor([item["intent_embedding"] for item in embedded_data]).to(device),
        "answers": [answers_dict.get(q, "") for q in questions],
    }

    loaded_data[category] = data
    return data

@app.route("/")
def index():
    session['user_id'] = str(uuid.uuid4())
    chat_history[session['user_id']] = []
    return app.send_static_file("app.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "세션이 만료되었습니다."}), 401
    
    data = request.get_json()
    user_message = data.get("message", "").strip()
    category = data.get("category", "").strip()
    
    if not user_message or not category:
        return jsonify({"error": "메시지와 카테고리를 모두 입력하세요."}), 400
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if user_id not in chat_history:
        chat_history[user_id] = []
    
    chat_history[user_id].append({
        "sender": "user",
        "message": user_message,
        "timestamp": timestamp
    })
    
    try:
        data = load_category_data(category)
        if not data:
            ai_response = f"'{category}' 카테고리에 해당하는 데이터를 찾을 수 없습니다."
        else:
            user_embedding = bi_encoder.encode(user_message, convert_to_tensor=True).to(device)
            
            cos_scores_q = util.cos_sim(user_embedding, data["embeddings"])[0]
            cos_scores_intent = util.cos_sim(user_embedding, data["intent_embeddings"])[0]
            final_scores = 0.8 * cos_scores_q + 0.2 * cos_scores_intent
            
            top_k = min(100, len(data["questions"]))
            top_results = torch.topk(final_scores, k=top_k)
            cross_inp = [[user_message, data["questions"][idx]] for idx in top_results.indices]
            cross_scores = cross_encoder.predict(cross_inp)
            sorted_scores_idx = torch.argsort(torch.tensor(cross_scores), descending=True)
            
            ai_response = "답변 가능한 유사 질문이 없습니다."
            for rank in sorted_scores_idx:
                idx = top_results.indices[rank].item()
                score = cross_scores[rank].item()
                answer = data["answers"][idx].strip()
                
                if score >= 0.75 and answer and answer != "답변 없음":
                    ai_response = answer
                    break
    except Exception as e:
        ai_response = f"오류가 발생했습니다: {str(e)}"
    
    chat_history[user_id].append({
        "sender": "ai",
        "message": ai_response,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
    
    return jsonify({
        "answer": ai_response,
        "history": chat_history[user_id]
    })

@app.route("/get_chat_history")
def get_chat_history():
    user_id = session.get('user_id')
    if not user_id or user_id not in chat_history:
        return jsonify([])
    return jsonify(chat_history[user_id])

@app.route("/categories")
def get_categories():
    return jsonify({
        "결제": "payment",
        "환불": "refund",
        "배송": "delivery",
        "기타": "etc"
    })

@app.route("/reset_chat", methods=["POST"])
def reset_chat():
    user_id = session.get('user_id')
    if user_id and user_id in chat_history:
        chat_history[user_id] = []
    return jsonify({"success": True})

@app.route("/ask", methods=["POST"])
def ask():
    req = request.get_json()
    user_question = req.get("question", "").strip()
    category = req.get("category", "").strip()

    if not user_question or not category:
        return jsonify({"error": "question과 category를 모두 입력하세요."}), 400

    data = load_category_data(category)
    if not data:
        return jsonify({"error": f"'{category}' 카테고리에 해당하는 데이터를 찾을 수 없습니다."}), 404

    user_embedding = bi_encoder.encode(user_question, convert_to_tensor=True).to(device)

    cos_scores_q = util.cos_sim(user_embedding, data["embeddings"])[0]
    cos_scores_intent = util.cos_sim(user_embedding, data["intent_embeddings"])[0]
    final_scores = 0.8 * cos_scores_q + 0.2 * cos_scores_intent

    top_k = min(100, len(data["questions"]))
    top_results = torch.topk(final_scores, k=top_k)
    cross_inp = [[user_question, data["questions"][idx]] for idx in top_results.indices]
    cross_scores = cross_encoder.predict(cross_inp)
    sorted_scores_idx = torch.argsort(torch.tensor(cross_scores), descending=True)

    for rank in sorted_scores_idx:
        idx = top_results.indices[rank].item()
        score = cross_scores[rank].item()
        answer = data["answers"][idx].strip()

        if score >= 0.75 and answer and answer != "답변 없음":
            return jsonify({
                "matched_question": data["questions"][idx],
                "answer": answer,
                "score": round(score, 4)
            })

    return jsonify({"message": "답변 가능한 유사 질문이 없습니다."})

if __name__ == "__main__":
    app.run(debug=True)