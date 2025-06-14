import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime



cred = credentials.Certificate("refit_firebase_key.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

# 주문 데이터 생성
order_data = {
    "order_id": "ORD20250603001",
    "order_status" : "배송준비중",
    "user_id": "USER1234",
    "order_date": datetime.utcnow().isoformat(),

    "payment": {
        "method": "카드결제",
        "method_detail": "하나카드",
        "amount": 100000,
        "status": "결제완료"
    },

    "delivery": {
        "recipient": "박상준",
        "address": "인천광역시 미추홀구 인하로 100 60주년 기념관 906호",
        "phone": "010-1234-5678",
        "tracking_number": "CJ345678912KR",
        "status": "배송준비중"
    },

    "items": [
        {
            "product_id": "P1005",
            "name": "버뮤다 팬츠",
            "quantity": 1,
            "price": 30000
        },
        {
            "product_id": "P1006",
            "name": "오버핏 검정 반팔",
            "quantity": 2,
            "price": 35000 
        }
    ]
}

# Firestore 저장
db.collection("orders").add(order_data)

print("✅ 주문 정보가 Firestore에 저장되었습니다.")
