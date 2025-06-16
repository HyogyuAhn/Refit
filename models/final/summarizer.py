# File: summarizer.py
# 주문 정보를 자연어로 변환
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