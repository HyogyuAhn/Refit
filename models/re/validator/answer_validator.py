import re

def is_answer_aligned_with_db(answer: str, db_value: str) -> bool:
    """
    기존 QnA의 답변(answer)과 DB에서 가져온 정보(db_value)가 같은지 확인.
    숫자 기반 비교 또는 텍스트 포함 여부로 처리
    """
    if not answer or not db_value:
        return False

    # 숫자 비교 (예: 7일 vs 14일)
    ans_num = re.search(r'\d+', answer)
    db_num = re.search(r'\d+', db_value)

    if ans_num and db_num:
        return ans_num.group() == db_num.group()

    # 일반 텍스트 포함 여부
    return db_value in answer
