# # KoGPT2 응답 생성기
# from transformers import AutoTokenizer, AutoModelForCausalLM
# import torch
# import os
# import json
# from datetime import datetime


# # KoGPT2 토크나이저 및 모델 불러오기
# model_name = r"c:\Testfile1\Refit\KoGPT2\KoGPT2_model" #모델 우리꺼 맞는거 사용해야 할 듯 합니다
# tokenizer = AutoTokenizer.from_pretrained(model_name)
# model = AutoModelForCausalLM.from_pretrained(model_name)
# model.eval()

# # KoGPT2 응답 생성 함수
# # def generate_response(prompt: str, max_length: int = 30000) -> str:
# #     input_ids = tokenizer.encode(prompt, return_tensors="pt")
# #     with torch.no_grad():
# #         output = model.generate(
# #             input_ids,
# #             max_length=max_length,
# #             do_sample=True,
# #             temperature=0.8,
# #             top_p=0.95,
# #             num_return_sequences=1
# #         )
# #     response = tokenizer.decode(output[0], skip_special_tokens=True)
# #     return response.replace(prompt, "").strip()
# def generate_response(prompt: str, max_length: int = 150) -> str:
#     input_ids = tokenizer.encode(prompt, return_tensors="pt")

#     # 입력 길이 제한
#     max_input = 1024 - max_length
#     if input_ids.shape[1] > max_input:
#         input_ids = input_ids[:, -max_input:]

#     # ✅ 디버그 출력 추가: KoGPT2에 실제로 전달되는 입력 확인
#     print("\n🧠 [KoGPT2에 전달된 입력 prompt]")
#     print(prompt)
#     print(f"📏 token 개수: {input_ids.shape[1]} (최대: {1024 - max_length})\n")

#     with torch.no_grad():
#         output = model.generate(
#             input_ids,
#             max_length=input_ids.shape[1] + max_length,
#             do_sample=True,
#             temperature=0.7,
#             top_p=0.95,
#             num_return_sequences=3
#         )
#     response = tokenizer.decode(output[0], skip_special_tokens=True)
#     return response.replace(prompt, "").strip()

# # 응답 생성 함수
# def generate_multiple_answers(question, num_return_sequences=3):
#     prompt = f"사용자: {question}\n답변:"
#     inputs = tokenizer(prompt, return_tensors="pt")

#     # ✅ 디버깅 출력 추가
#     print("\n🧠 [KoGPT2에 전달된 입력 prompt - 다중 응답]")
#     print(prompt)
#     print(f"📏 token 개수: {inputs['input_ids'].shape[1]} (최대: 1024)\n")

#     outputs = model.generate(
#         input_ids=inputs["input_ids"],
#         max_length=60,
#         do_sample=True,
#         top_k=50,
#         top_p=0.85,
#         temperature=0.9,
#         num_return_sequences=num_return_sequences,
#         no_repeat_ngram_size=4,
#         repetition_penalty=1.5,
#         pad_token_id=tokenizer.eos_token_id,
#         eos_token_id=tokenizer.eos_token_id
#     )

#     answers = []
#     for output in outputs:
#         decoded = tokenizer.decode(output, skip_special_tokens=True)
#         answer = decoded.split("답변:")[-1].strip()
#         answers.append(answer)
#     return answers

# # 응답 결과 저장 함수 (자동 timestamp 기반 저장)
# def save_response_log(user_question: str, prompt: str, response: str, category: str, save_dir: str = "response_logs"):
#     os.makedirs(save_dir, exist_ok=True)
#     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#     filename = f"{save_dir}/{category}_{timestamp}.json"

#     log = {
#         "user_question": user_question,
#         "prompt": prompt,
#         "response": response,
#         "category": category,
#         "timestamp": timestamp
#     }

#     with open(filename, "w", encoding="utf-8") as f:
#         json.dump(log, f, ensure_ascii=False, indent=2)

#     print(f"📁 응답 결과 저장 완료: {filename}")

import os
import json
import torch
import re
import openai
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForCausalLM

# 모델과 토크나이저 경로
model_path = r"c:\Testfile1\Refit\KoGPT2\KoGPT2_model"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(model_path)

tokenizer.pad_token = tokenizer.eos_token
model.eval()

# 반복 문장 제거 및 길이 제한 함수
def clean_response(response):
    response = re.sub(r"(입니다\.)\s*\1+", r"\1", response)
    response = re.sub(r"(환불 처리[가|되었|되었습니다]*)\s*\1+", r"\1", response)
    sentences = response.split(".")
    if len(sentences) > 3:
        return ". ".join(sentences[:3]).strip() + "…"
    return response.strip()

# Re:Fit 스타일 응답 생성 함수
def generate_refit_answer(user_input, intent="기타", external_info="", prohibited_info="", max_length=60):
    system_prompt = """

""".strip()

    external_prompt = f"\n\n[고객 외부정보]\n{external_info.strip()}" if external_info else ""
    prohibited_prompt = f"\n\n[주의/금지사항]\n{prohibited_info.strip()}" if prohibited_info else ""

    full_prompt = (
        system_prompt
        + external_prompt
        + prohibited_prompt
        + f"\n\n[고객의도] {intent}\n사용자: {user_input}\n답변:"
    )

    inputs = tokenizer(full_prompt, return_tensors="pt").to(model.device)

    outputs = model.generate(
        **inputs,
        max_new_tokens=max_length,
        do_sample=True,
        top_k=10,
        top_p=0.8,
        temperature=0.7,
        no_repeat_ngram_size=4,
        repetition_penalty=2.0,
        num_return_sequences=3,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id
    )

    responses = []
    for output in outputs:
        decoded = tokenizer.decode(output, skip_special_tokens=True)
        answer = decoded.split("답변:")[-1].strip()
        answer = clean_response(answer)
        if answer and answer not in responses:
            responses.append(answer)

    return responses

# 응답 저장 함수
def save_response_log(user_question, prompt, response, category, save_dir="response_logs"):
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{save_dir}/{category}_{timestamp}.json"

    log = {
        "user_question": user_question,
        "prompt": prompt,
        "response": response,
        "category": category,
        "timestamp": timestamp
    }

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"📁 응답 결과 저장 완료: {filename}")

def select_response(candidates):
    """
    후보 응답 리스트에서 하나를 선택하는 인터랙티브 함수입니다.
    0번 선택 시 직접 입력 가능.
    """
    print("🤖 생성된 응답 후보:")
    for idx, cand in enumerate(candidates, 1):
        print(f"  {idx}. {cand}")
    print("  0. ❌ 후보에 적절한 응답이 없습니다. 직접 입력하기")

    # 상담사 선택
    while True:
        try:
            selected = int(input("👉 상담사가 선택할 응답 번호 (0~3): "))
            if 0 <= selected <= len(candidates):
                break
            else:
                print("0~3 사이의 숫자를 입력하세요.")
        except ValueError:
            print("숫자만 입력하세요.")

    if selected == 0:
        final_answer = input("✍ 상담사가 직접 작성할 답변을 입력하세요:\n> ").strip()
    else:
        chosen = candidates[selected - 1]
        print(f"\n✏ 선택한 응답:\n👉 \"{chosen}\"\n")
        print("👉 수정하거나 엔터만 누르면 그대로 전송됩니다.")
        edited = input("> ").strip()
        final_answer = edited if edited else chosen

    return final_answer
