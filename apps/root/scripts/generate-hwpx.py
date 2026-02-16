"""
변형문제 텍스트를 시험지 양식의 HWPX 파일로 변환하는 스크립트 (템플릿 기반).

SAMPLE.hwpx / SAMPLE2.hwpx 등 템플릿 파일의 스타일을 그대로 사용합니다.
- 2단(NEWSPAPER) 레이아웃
- 지문/보기: 단락 테두리 (borderFill 자동 병합)
- 문제: 굵은 번호 제목
- 선택지: 내어쓰기

stdin으로 JSON을 받아 HWPX 파일을 생성하고 stdout으로 파일 경로를 출력합니다.
입력 JSON: { "content": "...", "output": "경로.hwpx", "template": "SAMPLE" | "SAMPLE2" }
"""

import sys
import json
import re
import random
import zipfile
import copy
import os
import xml.etree.ElementTree as ET

# ──────────────────────────────────────────────
#  상수
# ──────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# XML 네임스페이스
_HP = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"
_HS = "{http://www.hancom.co.kr/hwpml/2011/section}"
_HH = "{http://www.hancom.co.kr/hwpml/2011/head}"
_HC = "{http://www.hancom.co.kr/hwpml/2011/core}"

# 네임스페이스 접두사 등록
for pfx, uri in [
    ("hp", "http://www.hancom.co.kr/hwpml/2011/paragraph"),
    ("hs", "http://www.hancom.co.kr/hwpml/2011/section"),
    ("hh", "http://www.hancom.co.kr/hwpml/2011/head"),
    ("hc", "http://www.hancom.co.kr/hwpml/2011/core"),
    ("hpf", "urn:hancom:hwpml:pkg"),
    ("opf", "http://www.idpf.org/2007/opf"),
    ("dc", "http://purl.org/dc/elements/1.1/"),
    ("xlink", "http://www.w3.org/1999/xlink"),
    ("config", "urn:oasis:names:tc:opendocument:xmlns:config:1.0"),
    ("odf", "urn:oasis:names:tc:opendocument:xmlns:container"),
    ("ep", "http://www.idpf.org/2007/ops"),
]:
    ET.register_namespace(pfx, uri)


# ──────────────────────────────────────────────
#  템플릿별 스타일 매핑
# ──────────────────────────────────────────────

# 각 블록 타입에 대한 (styleIDRef, paraPrIDRef, charPrIDRef) 매핑
STYLE_MAPS = {
    "SAMPLE": {
        "file": "SAMPLE.hwpx",
        # 빈 줄 / 일반 텍스트
        "empty":           ("0", "0", "1"),
        "text":            ("0", "0", "1"),
        # 문제 제목
        "heading":         ("4", "3", "2"),
        # 지문 (테두리 박스 — borderFill=4, #74C3CC 0.5mm)
        "passage":         ("1", "5", "0"),
        # 보기 라벨 "< 보 기 >" (가운데, 테두리 안)
        "example_label":   ("1", "8", "2"),
        # 보기 내용 (테두리 박스)
        "example_content": ("2", "7", "0"),
        # 선택지
        "choice":          ("5", "4", "0"),
        # 굵은 텍스트
        "bold":            ("0", "0", "2"),
        # 정답/해설 라벨 (굵은 charPr)
        "answer_label_char": "2",
        # 정답/해설 값
        "answer":          ("8", "1", "0"),
        # secPr 첫 문단용
        "secpr":           ("0", "0", "1"),
    },
    "SAMPLE2": {
        "file": "SAMPLE2.hwpx",
        # 빈 줄 / 일반 텍스트 (바탕글: 맑은고딕 900)
        "empty":           ("0", "19", "8"),
        "text":            ("0", "19", "8"),
        # 문제 제목 (문제: 굴림 950)
        "heading":         ("1", "0", "9"),
        # 지문 (박스안산문: 바탕 900, borderFill=6 회색 상하굵은)
        "passage":         ("4", "22", "10"),
        # 보기 라벨 (보기들여쓰기: borderFill=7 검정 0.1mm)
        "example_label":   ("6", "1", "9"),
        # 보기 내용 (보기내어쓰기: borderFill=7)
        "example_content": ("7", "24", "10"),
        # 선택지 (선택지: 바탕 900, 내어쓰기)
        "choice":          ("2", "20", "10"),
        # 굵은 텍스트 (굴림 950)
        "bold":            ("0", "19", "9"),
        # 정답/해설 라벨 charPr (굴림 950)
        "answer_label_char": "9",
        # 정답/해설 (교사용정답: 굴림 800, 빨간색)
        "answer":          ("3", "21", "11"),
        # secPr 첫 문단용
        "secpr":           ("0", "19", "8"),
    },
}


def _rand_id():
    """랜덤 문단 ID 생성."""
    return str(random.randint(1_000_000_000, 9_999_999_999))


# ──────────────────────────────────────────────
#  텍스트 파싱
# ──────────────────────────────────────────────

def parse_content(content):
    """마크다운 + 커스텀 태그 형식의 변형문제 텍스트를 구조화된 블록으로 파싱."""
    lines = content.split("\n")
    blocks = []
    buffer_lines = []
    buffer_type = None

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        # 지문/보기 태그
        if lower in ("[지문]", "[지문 ]"):
            buffer_type = "passage"
            buffer_lines = []
            continue
        if lower in ("[/지문]", "[/ 지문]"):
            if buffer_type == "passage" and buffer_lines:
                blocks.append({"type": "passage", "text": "\n".join(buffer_lines)})
            buffer_type = None
            buffer_lines = []
            continue
        if lower in ("[보기]", "[보기 ]", "<보기>"):
            buffer_type = "example"
            buffer_lines = []
            continue
        if lower in ("[/보기]", "[/ 보기]", "</보기>"):
            if buffer_type == "example" and buffer_lines:
                blocks.append({"type": "example", "text": "\n".join(buffer_lines)})
            buffer_type = None
            buffer_lines = []
            continue

        if buffer_type:
            buffer_lines.append(line.rstrip())
            continue

        # 구분선
        if stripped in ("---", "***", "___"):
            blocks.append({"type": "separator"})
            continue

        # 빈 줄
        if not stripped:
            blocks.append({"type": "empty"})
            continue

        # ### 제목
        heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading_match:
            blocks.append({"type": "heading", "text": heading_match.group(2)})
            continue

        # **정답**: 값
        label_match = re.match(r"^\*\*(.+?)\*\*\s*[:：]\s*(.*)$", stripped)
        if label_match:
            blocks.append({
                "type": "label_value",
                "label": label_match.group(1),
                "value": label_match.group(2),
            })
            continue

        # **전체 굵은**
        bold_match = re.match(r"^\*\*(.+)\*\*$", stripped)
        if bold_match:
            blocks.append({"type": "bold", "text": bold_match.group(1)})
            continue

        # 선택지 ①~⑤
        choice_match = re.match(
            r"^([①②③④⑤⑥⑦⑧⑨⑩㉠㉡㉢㉣㉤ⓐⓑⓒⓓⓔ])\s*(.*)$", stripped
        )
        if choice_match:
            blocks.append({
                "type": "choice",
                "marker": choice_match.group(1),
                "text": choice_match.group(2),
            })
            continue

        # 일반 텍스트
        blocks.append({"type": "text", "text": stripped})

    # 닫히지 않은 태그
    if buffer_type and buffer_lines:
        btype = "passage" if buffer_type == "passage" else "example"
        blocks.append({"type": btype, "text": "\n".join(buffer_lines)})

    return blocks


# ──────────────────────────────────────────────
#  XML 문단 빌더
# ──────────────────────────────────────────────

def make_p(text, style_id, para_pr_id, char_pr_id):
    """단일 서식 문단 생성."""
    p = ET.Element(f"{_HP}p")
    p.set("id", _rand_id())
    p.set("paraPrIDRef", para_pr_id)
    p.set("styleIDRef", style_id)
    p.set("pageBreak", "0")
    p.set("columnBreak", "0")
    p.set("merged", "0")

    run = ET.SubElement(p, f"{_HP}run")
    run.set("charPrIDRef", char_pr_id)
    t_elem = ET.SubElement(run, f"{_HP}t")
    t_elem.text = text or ""

    return p


def make_mixed_p(parts, style_id, para_pr_id):
    """혼합 서식 문단 생성. parts = [(text, char_pr_id), ...]"""
    p = ET.Element(f"{_HP}p")
    p.set("id", _rand_id())
    p.set("paraPrIDRef", para_pr_id)
    p.set("styleIDRef", style_id)
    p.set("pageBreak", "0")
    p.set("columnBreak", "0")
    p.set("merged", "0")

    for text, cpr_id in parts:
        run = ET.SubElement(p, f"{_HP}run")
        run.set("charPrIDRef", cpr_id)
        t_elem = ET.SubElement(run, f"{_HP}t")
        t_elem.text = text or ""

    return p


# ──────────────────────────────────────────────
#  HWPX 문서 빌드 (템플릿 기반)
# ──────────────────────────────────────────────

def build_hwpx(blocks, output_path, template_name="SAMPLE"):
    """템플릿 기반으로 변형문제 HWPX 파일을 생성합니다."""

    smap = STYLE_MAPS[template_name]
    template_path = os.path.join(SCRIPT_DIR, smap["file"])

    # 헬퍼: 스타일 매핑에서 (style, paraPr, charPr) 튜플 가져오기
    def s(key):
        return smap[key]  # returns (styleIDRef, paraPrIDRef, charPrIDRef)

    # 1. 템플릿 ZIP 읽기
    with zipfile.ZipFile(template_path, "r") as zin:
        template_files = {}
        for info in zin.infolist():
            template_files[info.filename] = zin.read(info.filename)

    # 2. section0.xml 파싱
    section_xml = template_files["Contents/section0.xml"]
    root = ET.fromstring(section_xml)

    # 3. secPr + colPr 추출
    sec_pr = None
    col_ctrl = None
    for p in root.findall(f"{_HP}p"):
        for run in p.findall(f"{_HP}run"):
            sp = run.find(f"{_HP}secPr")
            if sp is not None:
                sec_pr = copy.deepcopy(sp)
            for ctrl in run.findall(f"{_HP}ctrl"):
                cp = ctrl.find(f"{_HP}colPr")
                if cp is not None:
                    col_ctrl = copy.deepcopy(ctrl)
                    break
            if sec_pr is not None:
                break
        if sec_pr is not None:
            break

    # 4. 기존 모든 문단 제거
    for child in list(root):
        if child.tag == f"{_HP}p":
            root.remove(child)

    # 5. secPr + colPr 첫 문단
    sp_style = s("secpr")
    first_p = ET.Element(f"{_HP}p")
    first_p.set("id", _rand_id())
    first_p.set("paraPrIDRef", sp_style[1])
    first_p.set("styleIDRef", sp_style[0])
    first_p.set("pageBreak", "0")
    first_p.set("columnBreak", "0")
    first_p.set("merged", "0")
    first_run = ET.SubElement(first_p, f"{_HP}run")
    first_run.set("charPrIDRef", sp_style[2])
    if sec_pr is not None:
        first_run.append(sec_pr)
    if col_ctrl is not None:
        first_run.append(col_ctrl)
    root.append(first_p)

    # 6. 블록 → 문단 변환
    prev_type = None
    prev_bordered = False
    consecutive_empty = 0

    for block in blocks:
        btype = block["type"]
        is_bordered = btype in ("passage", "example")

        # 연속 빈 줄 제한
        if btype == "empty":
            consecutive_empty += 1
            if consecutive_empty <= 1:
                root.append(make_p("", *s("empty")))
                prev_bordered = False
            prev_type = btype
            continue
        else:
            consecutive_empty = 0

        # 테두리 블록 연속 시 빈 줄로 분리
        if is_bordered and prev_bordered:
            root.append(make_p("", *s("empty")))

        # ── 문제 제목 ──
        if btype == "heading":
            if prev_type and prev_type not in ("separator", "empty"):
                root.append(make_p("", *s("empty")))
            root.append(make_p(block["text"], *s("heading")))

        # ── 지문 (테두리 문단들) ──
        elif btype == "passage":
            for line in block["text"].split("\n"):
                root.append(make_p(line, *s("passage")))

        # ── 보기 (라벨 + 테두리 문단들) ──
        elif btype == "example":
            root.append(make_p("< 보 기 >", *s("example_label")))
            for line in block["text"].split("\n"):
                root.append(make_p(line, *s("example_content")))

        # ── 선택지 ──
        elif btype == "choice":
            root.append(
                make_p(f"{block['marker']} {block['text']}", *s("choice"))
            )

        # ── 굵은 텍스트 ──
        elif btype == "bold":
            root.append(make_p(block["text"], *s("bold")))

        # ── 정답/해설 ──
        elif btype == "label_value":
            label = block["label"]
            value = block["value"]
            ans = s("answer")
            if value:
                root.append(
                    make_mixed_p(
                        [(f"{label}: ", smap["answer_label_char"]), (value, ans[2])],
                        style_id=ans[0],
                        para_pr_id=ans[1],
                    )
                )
            else:
                root.append(
                    make_p(label, ans[0], ans[1], smap["answer_label_char"])
                )

        # ── 구분선 ──
        elif btype == "separator":
            root.append(make_p("", *s("empty")))

        # ── 일반 텍스트 ──
        elif btype == "text":
            root.append(make_p(block["text"], *s("text")))

        prev_type = btype
        prev_bordered = is_bordered

    # 7. 직렬화
    new_section_xml = ET.tostring(root, encoding="unicode", xml_declaration=False)
    new_section_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new_section_xml
    )

    # 8. 새 HWPX ZIP 생성
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in template_files.items():
            if name == "Contents/section0.xml":
                zout.writestr(name, new_section_xml.encode("utf-8"))
            elif name.startswith("BinData/") or name.startswith("Preview/"):
                continue
            else:
                zout.writestr(name, data)


# ──────────────────────────────────────────────
#  메인
# ──────────────────────────────────────────────

def main():
    raw = sys.stdin.buffer.read()
    data = json.loads(raw.decode("utf-8"))
    content = data["content"]
    output_path = data["output"]
    template_name = data.get("template", "SAMPLE")

    blocks = parse_content(content)
    build_hwpx(blocks, output_path, template_name)

    print(output_path)


if __name__ == "__main__":
    main()
