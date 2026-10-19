#!/usr/bin/env python3
"""仅供内容评审的确定性匹配参考；不连接现有网页或分享服务。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PEOPLE_DATA = json.loads((ROOT / "data/people.json").read_text(encoding="utf-8"))
QUESTION_DATA = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))
DIMENSIONS = PEOPLE_DATA["dimensions"]
PEOPLE = PEOPLE_DATA["people"]
QUESTIONS = QUESTION_DATA["questions"]
VERSION = PEOPLE_DATA["version"]
if QUESTION_DATA["version"] != VERSION:
    raise ValueError("题库与人物库版本不一致。")


def validate_vector(vector):
    if not isinstance(vector, (list, tuple)) or len(vector) != 6:
        raise ValueError("六维画像必须包含六个整数。")
    if any(type(v) is not int or not 0 <= v <= 12 for v in vector):
        raise ValueError("维度原始分必须为 0—12 的整数。")


def score_answers(answers):
    if not isinstance(answers, list) or len(answers) != 24:
        raise ValueError("请完成全部 24 道题。")
    vector = [0] * 6
    index = {d["id"]: i for i, d in enumerate(DIMENSIONS)}
    for question, answer in zip(QUESTIONS, answers):
        option = next((o for o in question["options"] if o["id"] == answer), None)
        if type(answer) is not str or option is None:
            raise ValueError(f"{question['id']} 的答案必须为 A、B、C、D 之一。")
        vector[index[question["dimension"]]] += option["score"]
    return vector


def rank_vector(vector):
    validate_vector(vector)
    ranked = [(sum((a - b) ** 2 for a, b in zip(vector, p["profile"])), p["id"], p)
              for p in PEOPLE]
    return sorted(ranked, key=lambda item: (item[0], item[1]))


def band(value):
    if value <= 4:
        return "low"
    if value >= 8:
        return "high"
    return "balanced"


def explanation(vector):
    validate_vector(vector)
    statements = []
    for d, value in zip(DIMENSIONS, vector):
        state = band(value)
        if state == "balanced":
            text = f"在{d['name']}上，两端倾向较为接近，尚未呈现明确偏向。"
        else:
            text = f"在{d['name']}上，本次选择更靠近「{d[state]}」一端。"
        statements.append({"dimension": d["id"], "label": d["name"], "band": state, "text": text})
    return statements


def match(answers):
    vector = score_answers(answers)
    ranked = rank_vector(vector)
    distance, result_id, person = ranked[0]
    tied = [item[1] for item in ranked if item[0] == distance]
    return {"version": VERSION, "resultId": result_id, "person": person,
            "rawVector": vector, "displayBands": explanation(vector),
            "tied": len(tied) > 1,
            "resultNote": ("本次有多位人物画像同样接近，以下按本版本的固定顺序展示一位。"
                           if len(tied) > 1 else "这是基于本次选择得到的趣味匹配，不是人格定论。")}


def witness_for_vector(vector):
    """把每轴 0—12 分拆成四个 0—3 分选项，构造可复现的 24 题答案。"""
    validate_vector(vector)
    remaining = list(vector)
    index = {d["id"]: i for i, d in enumerate(DIMENSIONS)}
    answers = []
    for question in QUESTIONS:
        j = index[question["dimension"]]
        wanted = min(3, remaining[j])
        answers.append(next(o["id"] for o in question["options"] if o["score"] == wanted))
        remaining[j] -= wanted
    if any(remaining):
        raise ValueError("题库不支持该画像。")
    return answers


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="输入 24 个 A—D 答案，预览人物匹配结果。")
    parser.add_argument("answers", help="按 Q01—Q24 顺序的 24 个选项字母")
    args = parser.parse_args()
    try:
        print(json.dumps(match(list(args.answers)), ensure_ascii=False, indent=2))
    except ValueError as exc:
        parser.error(str(exc))
