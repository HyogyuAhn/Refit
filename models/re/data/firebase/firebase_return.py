# import firebase_admin
# from firebase_admin import credentials, firestore
# import json
# import os

# # 1. Firebase 초기화
# cred = credentials.Certificate(
#     r"refit_firebase.json"  # ← 여기에 실제 경로
# )
# firebase_admin.initialize_app(cred)

# # 2. Firestore 클라이언트 생성
# db = firestore.client()

# # 3. Firestore에서 데이터 가져오기
# def fetch_firestore_collection(collection_name):
#     collection_ref = db.collection(collection_name)
#     docs = collection_ref.stream()
#     return [doc.to_dict() | {'id': doc.id} for doc in docs]  # 문서 ID 포함시킴

# # 4. JSON 파일로 저장
# def save_json_file(data, filename="output.json"):
#     with open(filename, "w", encoding="utf-8") as f:
#         json.dump(data, f, ensure_ascii=False, indent=4)

# # 5. 전체 프로세스 실행
# def export_firestore_to_json(collection_name, output_filename):
#     print(f"📦 Firestore에서 '{collection_name}' 컬렉션 가져오는 중...")
#     data = fetch_firestore_collection(collection_name)
#     save_json_file(data, output_filename)
#     print(f"✅ 추출 완료: {output_filename}")

# # 6. 실행
# if __name__ == "__main__":
#     export_firestore_to_json("orders", "orders.json")

import firebase_admin
from firebase_admin import credentials, firestore
import json
import hashlib
import os

# 초기화
cred = credentials.Certificate(r"refit_firebase_key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# 🔹 Firestore 데이터 가져오기
def fetch_firestore_collection(collection_name):
    collection_ref = db.collection(collection_name)
    docs = collection_ref.stream()
    return [doc.to_dict() | {'id': doc.id} for doc in docs]

# 🔹 해시 계산 (JSON → str → SHA256)
def calculate_data_hash(data):
    json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()

# 🔹 파일 저장
def save_json_file(data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# 🔹 해시 저장 / 불러오기
def load_last_hash(hash_file):
    if os.path.exists(hash_file):
        with open(hash_file, 'r') as f:
            return f.read().strip()
    return None

def save_current_hash(hash_file, hash_val):
    with open(hash_file, 'w') as f:
        f.write(hash_val)

# 🔹 메인 로직
def export_if_changed(collection_name, output_file, hash_file):
    print(f"📦 '{collection_name}'에서 데이터 확인 중...")

    data = fetch_firestore_collection(collection_name)
    current_hash = calculate_data_hash(data)
    last_hash = load_last_hash(hash_file)

    if current_hash != last_hash:
        print("✅ 변경사항 감지됨! JSON 파일로 저장 중...")
        save_json_file(data, output_file)
        save_current_hash(hash_file, current_hash)
        print(f"📁 저장 완료: {output_file}")
    else:
        print("⏭️ 데이터 변경 없음. 저장 건너뜀.")

# 🔹 실행
if __name__ == '__main__':
    export_if_changed(
        collection_name="orders",
        output_file="orders.json",
        hash_file="orders_hash.txt"
    )
