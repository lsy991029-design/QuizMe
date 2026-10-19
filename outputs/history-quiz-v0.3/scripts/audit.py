#!/usr/bin/env python3
"""检查内容结构、人物可达性、确定性与合成答案分布。"""
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

from matcher import DIMENSIONS, PEOPLE, QUESTIONS, VERSION, band, match, rank_vector, score_answers, witness_for_vector

ROOT = Path(__file__).resolve().parents[1]


def main():
    assert len(PEOPLE) == 100
    assert len({p["id"] for p in PEOPLE}) == 100
    assert len({p["name"] for p in PEOPLE}) == 100
    assert len({tuple(p["profile"]) for p in PEOPLE}) == 100, "存在相同人物画像"
    assert len(QUESTIONS) == 24
    assert len({q["id"] for q in QUESTIONS}) == 24
    assert Counter(q["dimension"] for q in QUESTIONS) == {d["id"]: 4 for d in DIMENSIONS}
    for q in QUESTIONS:
        assert [o["id"] for o in q["options"]] == list("ABCD")
        assert sorted(o["score"] for o in q["options"]) == [0, 1, 2, 3]
        assert len({o["text"] for o in q["options"]}) == 4
    for p in PEOPLE:
        assert len(p["profile"]) == 6
        assert all(type(v) is int and 0 <= v <= 12 for v in p["profile"])
        assert len(p["tags"]) == 3
        assert all(p[k] for k in ["era", "field", "typeTitle", "summary", "strength", "caution", "historicalContext", "sourceCandidates", "profileRationale", "shareText", "reviewStatus"])
    for d in DIMENSIONS:
        qs = [q for q in QUESTIONS if q["dimension"] == d["id"]]
        for letter in "ABCD":
            assert sorted(next(o["score"] for o in q["options"] if o["id"] == letter) for q in qs) == [0, 1, 2, 3]
    witnesses = []
    for p in PEOPLE:
        answers = witness_for_vector(p["profile"])
        assert score_answers(answers) == p["profile"]
        result = match(answers)
        assert result["resultId"] == p["id"], f"无法触达 {p['name']}"
        assert result == match(answers), "重复计算不一致"
        witnesses.append({"personId": p["id"], "name": p["name"], "answers": answers,
                          "vector": p["profile"], "matchedId": result["resultId"]})
    invalid_cases = [None, [], ["A"]*23, ["A"]*25, ["A"]*23+[None], ["A"]*23+["E"], ["A"]*23+[0], ["A"]*23+[True]]
    for answers in invalid_cases:
        try:
            match(answers)
        except ValueError:
            pass
        else:
            raise AssertionError(f"非法答案被接受: {answers}")
    for score, expected in [(0,"low"),(4,"low"),(5,"balanced"),(7,"balanced"),(8,"high"),(12,"high")]:
        assert band(score) == expected
    for total in range(13):
        assert score_answers(witness_for_vector([total]*6)) == [total]*6
    identical_letter_results = {}
    for letter in "ABCD":
        result = match([letter]*24)
        assert result["rawVector"] == [6]*6
        assert all(d["band"] == "balanced" for d in result["displayBands"])
        identical_letter_results[letter] = {"vector": result["rawVector"], "resultId": result["resultId"]}
    # 合成均匀选项仅检查规则分布，不代表真实用户分布或测量有效性。
    rng = random.Random(20261018)
    samples = 20000
    counts = Counter()
    ties = 0
    tie_example = None
    for _ in range(samples):
        answers = [rng.choice("ABCD") for _ in QUESTIONS]
        result = match(answers)
        counts[result["resultId"]] += 1
        ties += result["tied"]
        if result["tied"] and tie_example is None:
            ranked = rank_vector(result["rawVector"])
            tied_ids = sorted(item[1] for item in ranked if item[0] == ranked[0][0])
            assert result["resultId"] == tied_ids[0]
            assert result["resultNote"] == "本次有多位人物画像同样接近，以下按本版本的固定顺序展示一位。"
            assert result == match(answers)
            tie_example = {"answers": answers, "vector": result["rawVector"], "tiedIds": tied_ids, "selectedId": result["resultId"]}
    assert tie_example is not None
    # 修改一个答案只改变它所属维度，其余五维保持不变。
    original = list("ABCD" * 6)
    original_vector = score_answers(original)
    for j, q in enumerate(QUESTIONS):
        changed = list(original)
        changed[j] = "ABCD"[("ABCD".index(changed[j]) + 1) % 4]
        new_vector = score_answers(changed)
        axis = next(i for i, d in enumerate(DIMENSIONS) if d["id"] == q["dimension"])
        for i in range(6):
            assert (new_vector[i] != original_vector[i]) if i == axis else (new_vector[i] == original_vector[i])
        assert match(changed) == match(changed)
    pair_distances = []
    for i, p in enumerate(PEOPLE):
        for other in PEOPLE[i+1:]:
            distance = sum((a-b)**2 for a,b in zip(p["profile"], other["profile"]))
            pair_distances.append((distance,p["name"],other["name"]))
    report = {
        "version": VERSION, "date": "2026-10-18", "peopleCount": len(PEOPLE),
        "questionCount": len(QUESTIONS), "reachabilityPassed": len(witnesses),
        "duplicateProfiles": 0, "invalidInputCasesPassed": len(invalid_cases),
        "balancedOptionPositions": True, "identicalLetterResults": identical_letter_results,
        "singleAnswerMutationCasesPassed": 24, "tieExample": tie_example,
        "simulation": {"method": "每题独立均匀选择 A—D，固定随机种子 20261018；合成样本，不是真实用户", "samples": samples,
                       "observedResults": len(counts), "ties": ties,
                       "distribution": [{"id":p["id"],"name":p["name"],"count":counts[p["id"]]} for p in PEOPLE]},
        "closestProfilePairs": [{"squaredDistance":d,"names":[a,b]} for d,a,b in sorted(pair_distances)[:10]],
        "limits": ["可达性仅证明规则中存在对应答案，不证明人物画像真实或测量有效。",
                   "均匀选项使六维分数集中在中部，不能据此要求 100 种结果均匀分配。",
                   "史料引用尚待逐篇核验；题意、维度相关性和结果认同感尚待真人试答。"],
        "dataHashes": {name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest() for name in ["people.json","questions.json"]},
        "ruleHashes": {name: hashlib.sha256((ROOT / "scripts" / name).read_bytes()).hexdigest() for name in ["matcher.py", "scoring_rules.md"]},
    }
    (ROOT / "data/reachability-witnesses.json").write_text(json.dumps({"version": VERSION, "witnesses": witnesses}, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
    (ROOT / "data/audit-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    top = sorted(report["simulation"]["distribution"], key=lambda x: (-x["count"],x["id"]))[:10]
    lines = ["# 内容与匹配规则检查报告", "", f"日期：2026-10-18；版本：{VERSION}。", "",
             "## 已通过的检查", "", "- 100 位不同姓名、不同编号、不同六维画像的人物。", "- 24 道题，每维 4 道，每题 4 个不同选项，分值覆盖 0—3。",
             "- 每维每个选项位置在四题中分别对应 0、1、2、3 分，减少固定位置与单侧倾向的绑定。",
             "- 100 / 100 人物均由一组合法的 24 题答案精确触达；样例见 data/reachability-witnesses.json。",
             "- 每组可达性样例重复计算结果相同。", "- 8 组缺失、越界、类型错误等输入被拒绝。",
             "- 24 组单题修改只改变所属维度，其余五维保持不变；修改后重复计算一致。",
             "- 从合成样本中记录一组并列答案，验证固定编号决胜、提示文案与重复计算结果；样例见 data/audit-report.json 的 tieExample。",
             "- 0—12 各轴分值均能由合法选项组合得到；解释分档边界检查通过。",
             "- 全选同一字母均得六轴 6 分，解释为倾向均衡，不自动断言偏向一端。", "",
             "## 合成样本检查", "", f"每题独立均匀选择 A—D，固定种子 20261018，共 {samples:,} 组。观察到 {len(counts)} 种结果，最小距离并列 {ties:,} 次（{ties/samples:.1%}）。这不是用户调研，也不是结果覆盖承诺。", "",
             "| 人物 | 出现次数 | 样本占比 |", "| --- | --- | --- |"]
    for item in top:
        lines.append(f"| {item['name']} | {item['count']} | {item['count']/samples:.1%} |")
    lines += ["", "均匀随机作答的单轴分数会向中间集中，部分画像在本次合成抽样中没有出现，但已由专门构造的合法答案验证可达。不得使用随机换人、热门人物加权或强制均分来掩盖分布。真人试答后再判断题意、人物密度与分值是否需要调整，调整必须升版本并重跑检查。", "",
              "## 最接近的画像对", "", "以下优先进入内容区分度评审；数值接近不等于人物在历史上相似。", "", "| 人物对 | 六维距离平方 |", "| --- | --- |"]
    for d,a,b in sorted(pair_distances)[:10]:
        lines.append(f"| {a} / {b} | {d} |")
    lines += ["", "## 尚未完成的验证", "", "- 候选史料未逐篇打开核验，不能将来源线索标为已审核引用。",
              "- 题目理解、答题耗时、维度重叠、重测稳定性与结果认同感需要真人试答。",
              "- 本轮没有实现或验收网页、图片生成、链接存储及浏览器兼容。", ""]
    (ROOT / "04_内容与匹配检查报告.md").write_text("\n".join(lines),encoding="utf-8")
    print(json.dumps({"people":len(PEOPLE),"questions":len(QUESTIONS),"reachable":len(witnesses),"syntheticObserved":len(counts),"syntheticTies":ties,"top10":top},ensure_ascii=False))


if __name__ == "__main__":
    main()
