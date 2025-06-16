# File: main.py
# 사용자 입력, 로직 호출, 결과 출력
import os
import openai
from .utils import load_json
from .retriever import retrieve_and_rerank
from .edit_checker import needs_edit
from .prompt_builder import make_final_prompt

openai.api_key = os.getenv("OPENAI_API_KEY")


def main():
    category = input("카테고리 (AS, payment, change, return, shipping, business, order): ")
    question = input("질문:\n")
    user_orders = load_json("data/user_data.json")
    policy = load_json("data/company_policy.json")

    scored = retrieve_and_rerank(question, category)
    top_doc, top_score = scored[0]
    edit = needs_edit(top_score, question)

    if edit:
        prompt = make_final_prompt(question, category, user_orders, policy)
        if top_score >= 0.85:
            prompt += f"\n\n[참고 답변]\n{top_doc.metadata.get('answer','')}"

        prompt += "\n\n위 정보를 참고하여 공식적으로 답변하십시오."

        resp = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=1000
        )
        answer = resp.choices[0].message.content.strip()
        print("\n[GPT 응답]\n", answer)
    else:
        print("\n[최종 답변]\n", top_doc.metadata.get('answer',''))


if __name__ == "__main__":
    main()
