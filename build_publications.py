"""Generate browser-readable publication data from publications.bib.

Run from this folder after editing publications.bib:
    python build_publications.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def clean_value(value: str) -> str:
    value = re.sub(r"[{}]", "", value)
    value = re.sub(r"\\([A-Za-z]+)\s*", r"\1", value)
    return re.sub(r"\s+", " ", value).strip()


def read_value(body: str, start: int) -> tuple[str, int]:
    index = start
    while index < len(body) and body[index].isspace():
        index += 1

    if index < len(body) and body[index] == "{":
        value_start = index + 1
        index += 1
        depth = 1
        while index < len(body) and depth:
            if body[index] == "{":
                depth += 1
            elif body[index] == "}":
                depth -= 1
            index += 1
        if depth:
            raise ValueError('Unclosed braced BibTeX value')
        return body[value_start : index - 1], index

    if index < len(body) and body[index] == '"':
        value_start = index + 1
        index += 1
        while index < len(body):
            if body[index] == '"' and body[index - 1] != "\\":
                break
            index += 1
        if index == len(body):
            raise ValueError('Unclosed quoted BibTeX value')
        return body[value_start:index], index + 1

    value_start = index
    while index < len(body) and body[index] != ",":
        index += 1
    return body[value_start:index], index


def entries(source: str):
    entry_start = source.find("@")
    while entry_start != -1:
        open_index = min(
            (index for index in (source.find("{", entry_start), source.find("(", entry_start)) if index != -1),
            default=-1,
        )
        if open_index == -1:
            return
        close_character = "}" if source[open_index] == "{" else ")"
        depth = 1
        index = open_index + 1
        in_quotes = False
        while index < len(source) and depth:
            character = source[index]
            if character == '"' and source[index - 1] != "\\":
                in_quotes = not in_quotes
            if not in_quotes:
                if character == source[open_index]:
                    depth += 1
                elif character == close_character:
                    depth -= 1
            index += 1
        if depth:
            raise ValueError('Unclosed BibTeX entry')
        yield source[entry_start:index].strip(), source[open_index + 1 : index - 1]
        entry_start = source.find("@", index)


def parse_fields(body: str) -> dict[str, str]:
    first_comma = body.find(",")
    if first_comma == -1:
        return {}

    fields: dict[str, str] = {}
    index = first_comma + 1
    while index < len(body):
        while index < len(body) and (body[index].isspace() or body[index] == ","):
            index += 1
        equals = body.find("=", index)
        if equals == -1:
            break
        name = body[index:equals].strip().lower()
        value, index = read_value(body, equals + 1)
        fields[name] = clean_value(value)
    return fields


def parse_publications(source: str) -> list[dict[str, str]]:
    publications = []
    for raw_entry, body in entries(source):
        fields = parse_fields(body)
        title = fields.get("title", "")
        if not title:
            continue
        paper_url = fields.get("url") or fields.get("pdf")
        if not paper_url and fields.get("doi"):
            paper_url = f"https://doi.org/{fields['doi']}"
        publications.append(
            {
                "title": title,
                "authors": fields.get("author", ""),
                "venue": fields.get("journal") or fields.get("booktitle") or fields.get("school") or fields.get("publisher", ""),
                "year": fields.get("year", ""),
                "paperUrl": paper_url or "",
                "bibtex": raw_entry,
            }
        )
    return publications


def main() -> None:
    source_path = ROOT / "publications.bib"
    output_path = ROOT / "publications-data.js"
    publications = parse_publications(source_path.read_text(encoding="utf-8"))
    output = "// Generated from publications.bib. Edit publications.bib, then run build_publications.py.\n"
    output += "window.publicationsData = "
    output += json.dumps(publications, ensure_ascii=False, indent=2)
    output += ";\n"
    output_path.write_text(output, encoding="utf-8")
    print(f"Generated {len(publications)} publications in {output_path.name}")


if __name__ == "__main__":
    main()
