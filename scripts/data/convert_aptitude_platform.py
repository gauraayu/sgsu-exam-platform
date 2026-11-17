r"""
Converts the uploaded `aptitude-test-platform` question_bank.json (600 MCQs, Quantitative
Aptitude + Logical Reasoning) into the portal's local-dataset JSONL format, with cleanup:

  * "$" currency signs are escaped (\$) so they are not read as LaTeX delimiters;
  * questions that list "**Options**: A) … B) …" inside the stem get those statements as
    real options (the source used bare letters such as "A"/"B"/"None" as options);
  * distractors with a different unit from the answer (e.g. "4 workers" for a "days" answer)
    are replaced with same-unit numeric distractors;
  * a question is dropped when it cannot be made sound: single-letter junk options, or a
    numeric answer that does not appear anywhere in the worked solution.

Usage: python3 scripts/data/convert_aptitude_platform.py <question_bank.json> <src/data dir>
"""
import json, re, sys, random, collections, os

src, out_dir = sys.argv[1], sys.argv[2]
data = json.load(open(src))["questions"]
rng = random.Random(2026)
DIFF = {"Basic": "Easy", "Intermediate": "Medium", "Advance": "Hard"}
SLUG = {"Quantitative Aptitude": "quantitative-aptitude", "Logical Reasoning": "logical-reasoning"}
NUM = re.compile(r"^(\$?)\s*(-?\d+(?:\.\d+)?)\s*(%|[A-Za-z/ .²³]*)$")
stats = collections.Counter()


def esc(s):
    # escape bare $ (currency); keep \( \) LaTeX as-is
    return re.sub(r"(?<!\\)\$", r"\\$", s)


def numbers_in(s):
    return {float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", s.replace(",", ""))}


def fmt_like(v, template_decimals):
    if template_decimals == 0 and abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    d = max(template_decimals, 2) if abs(v - round(v)) > 1e-9 else 0
    return f"{v:.{d}f}".rstrip("0").rstrip(".") if d else str(int(round(v)))


def convert(q):
    stem = q["question"].strip()
    opts = dict(q["options"])
    correct_key = q["correct_answer"]
    correct = opts[correct_key].strip()

    # 1) inline "**Options**: A) .. B) .. C) .." → real options
    m = re.search(r"\*\*Options\*\*:?\s*(.*)$", stem, re.S)
    if m:
        parts = re.findall(r"([A-E])\)\s*(.+?)(?=\s+[A-E]\)|$)", m.group(1).strip(), re.S)
        inline = {k: v.strip().rstrip(".") + "." for k, v in parts}
        if len(inline) < 2:
            stats["drop_inline_unparsed"] += 1
            return None
        stem = stem[: m.start()].strip()
        if correct.upper().rstrip(".") in inline:
            ans = inline[correct.upper().rstrip(".")]
        elif correct.lower().startswith("none"):
            ans = "None of these"
        else:
            stats["drop_inline_unmapped"] += 1
            return None
        pool = [v for v in inline.values() if v != ans]
        if ans != "None of these":
            pool.append("None of these")
        while len(pool) < 3:
            pool.append(["All of these", "Cannot be determined", "Both A and B"][len(pool) % 3])
        options = [ans] + pool[:3]
        stats["fixed_inline_options"] += 1
        return stem, options, ans

    # 2) junk single-character distractors for a non-single-character answer
    wrong = [v.strip() for k, v in opts.items() if k != correct_key]
    if len(correct) > 1 and sum(1 for w in wrong if len(w) == 1) >= 1:
        stats["drop_junk_options"] += 1
        return None

    # 3) numeric answers: answer must appear in the solution; distractors share the unit
    nm = NUM.match(correct)
    if nm:
        cur, val, unit = nm.group(1), float(nm.group(2)), nm.group(3).strip()
        if val not in numbers_in(q["solution"]) and round(val) not in numbers_in(q["solution"]):
            stats["drop_answer_not_in_solution"] += 1
            return None
        dec = len(nm.group(2).split(".")[1]) if "." in nm.group(2) else 0
        good, seen = [], {correct}
        for w in wrong:
            wm = NUM.match(w)
            if wm and wm.group(1) == cur and wm.group(3).strip() == unit and w not in seen:
                good.append(w); seen.add(w)
        replaced = 0
        for k in rng.sample([0.5, 0.75, 0.8, 1.2, 1.25, 1.5, 2, 0.9, 1.1, 3], 10):
            if len(good) >= 3:
                break
            v = val * k
            if abs(v) < 1e-9:
                continue
            s = f"{cur}{fmt_like(v, dec)}{(' ' if unit and unit != '%' else '') + unit if unit else ''}"
            if s not in seen:
                good.append(s); seen.add(s); replaced += 1
        if replaced:
            stats["fixed_unit_distractors"] += 1
        if len(good) < 3:
            stats["drop_no_distractors"] += 1
            return None
        return stem, [correct] + good[:3], correct

    if len(set([correct] + wrong)) < 4:
        stats["drop_duplicate_options"] += 1
        return None
    return stem, [correct] + wrong, correct


# ---- review: decide which questions are safe for exams ---------------------------------
# Blood-relation items checked by hand; the rest of that topic in the source give wrong
# relations (e.g. a granddaughter answered as "Daughter").
BLOOD_OK = {331, 332, 333, 334, 335, 336, 339, 340, 432, 433, 437}
SHAKY_TOPICS = {
    "Puzzles": "the source options are unrelated placeholder letters",
    "Non-Verbal Reasoning": "the source options are unrelated (clock times, compass points)",
    "Additional Basic Questions": "the source options are unrelated to the question",
    "Data Sufficiency": "the source option set repeats the same choice in different words",
}


def shift_code(word, code):
    """Returns ('fwd'|'rev', k) if code is word shifted by a constant k (optionally reversed)."""
    for mode, c in (("fwd", code), ("rev", code[::-1])):
        if len(c) != len(word):
            continue
        ks = {(ord(c[i]) - ord(word[i])) % 26 for i in range(len(word))}
        if len(ks) == 1:
            return mode, ks.pop()
    return None


def last_number(sol):
    xs = re.findall(r"-?\d+(?:\.\d+)?(?:/\d+)?", sol.replace(",", ""))
    return xs[-1] if xs else None


def review(q, answer):
    t, a, sol = q["topic"], answer, q["solution"]
    if re.search(r"requires|assume|clarification", a, re.I):
        return "the source gives no final answer (it says the problem needs re-solving)"
    if t in SHAKY_TOPICS:
        return SHAKY_TOPICS[t]
    if t == "Blood Relations" and q["id"] not in BLOOD_OK:
        return "the relation given as the answer in the source is incorrect or ambiguous"
    if t == "Syllogisms" and q["difficulty"] == "Advance":
        return "the source conclusion does not follow from the premises"
    if t == "Coding-Decoding":
        m = re.search(r"[“\"](\w+)[”\"] is coded as [“\"](\w+)[,”\"]+.*?[“\"](\w+)[”\"]", q["question"])
        if not m:
            return "the coding rule could not be checked"
        rule = shift_code(m.group(1).upper(), m.group(2).upper())
        if not rule:
            return "the coding rule in the example is not consistent"
        mode, k = rule
        enc = "".join(chr((ord(ch) - 65 + k) % 26 + 65) for ch in m.group(3).upper())
        if mode == "rev":
            enc = enc[::-1]
        if enc != a.upper():
            return "the coded answer does not follow the example's rule"
        return None
    num = re.match(r"^\s*\\?\$?(-?\d+(?:\.\d+)?(?:/\d+)?)", a)
    if num:
        ln = last_number(sol)
        try:
            if ln is None or abs(eval(ln) - eval(num.group(1))) > 0.01:
                return "the answer does not match the final result of the worked solution"
        except ZeroDivisionError:
            return "the answer does not match the final result of the worked solution"
    return None


by_subject = collections.defaultdict(list)
for q in data:
    r = convert(q)
    if not r:
        continue
    stem, options, ans = r
    options = [o for o in options]
    rng.shuffle(options)
    rec = {
        "question_id": f"APT-{'QA' if q['category'].startswith('Quant') else 'LR'}-{q['id']:03d}",
        "question": esc(stem),
        "question_images": [],
        **{f"option_{i+1}": esc(o) for i, o in enumerate(options)},
        "correct_option": options.index(ans) + 1,
        "numerical_answer": None,
        "solution": esc(q["solution"].strip()),
        "solution_images": [],
        "subject": q["category"],
        "topic": q["topic"],
        "subtopic": "",
        "difficulty": DIFF[q["difficulty"]],
        "question_type": "single_correct",
        "has_image": False,
        "exam": "Aptitude Test Platform",
        "source_paper": f"aptitude-test-platform question_bank.json #{q['id']}",
    }
    why = review(q, ans)
    if why:
        rec["review_exclusion"] = f"Kept out of exams: {why}. Fix the question and restore it to use it."
        stats["excluded_for_review"] += 1
    by_subject[q["category"]].append(rec)
    stats["kept"] += 1

for subj, recs in by_subject.items():
    d = os.path.join(out_dir, SLUG[subj])
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "aptitude_platform.jsonl"), "w") as fh:
        for rec in recs:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(subj, len(recs), collections.Counter(r["difficulty"] for r in recs), "usable:", sum(1 for r in recs if "review_exclusion" not in r))
print(dict(stats))
