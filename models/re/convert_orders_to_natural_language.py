def convert_orders_to_natural_language_by_category(category: str, order_list: list) -> str:
    lines = []

    for order in order_list:
        order_id = order.get("order_id", "알 수 없음")
        delivery = order.get("delivery", {})
        payment = order.get("payment", {})
        items = order.get("items", [])
        order_date = order.get("order_date", "알 수 없음")

        if category == "shipping":
            line = (
                f"주문번호 {order_id}는 {payment.get('method', '결제수단')}({payment.get('method_detail', '')})로 "
                f"{payment.get('amount', 0):,}원이 결제되었고, 배송 상태는 {delivery.get('status', '확인불가')}입니다. "
                f"운송장 번호는 {delivery.get('tracking_number', '없음')}입니다."
            )

        elif category == "payment":
            line = (
                f"주문번호 {order_id}는 {payment.get('method', '결제수단')}({payment.get('method_detail', '')})로 "
                f"{payment.get('amount', 0):,}원이 결제되었으며, 현재 상태는 {order.get('order_status', '미확인')}입니다."
            )

        elif category == "AS":
            line = (
                f"주문번호 {order_id}는 {order_date}에 주문되었고, 구성 상품은 {', '.join(items)}입니다."
            )

        elif category == "return":
            line = (
                f"주문번호 {order_id}는 {order_date}에 주문되었고, {payment.get('method', '')}로 결제되었습니다. "
                f"현재 배송 상태는 {delivery.get('status', '')}입니다. 반품 관련 요청이 들어올 수 있습니다."
            )

        elif category == "change":
            line = (
                f"주문번호 {order_id}는 {order_date}에 주문되었고, 배송은 {delivery.get('status', '확인불가')} 상태입니다. "
                f"구성 상품: {', '.join(items)}"
            )

        elif category == "order":
            line = (
                f"주문번호 {order_id}는 {order_date}에 주문되었으며, 현재 상태는 {order.get('order_status', '')}입니다. "
                f"상품 구성: {', '.join(items)}"
            )

        elif category == "business":
            line = f"주문번호 {order_id} 관련 문의입니다."

        else:
            line = f"{order_id} 관련 정보가 등록되어 있습니다."

        lines.append(line)

    return "\n".join(lines)


