#!/usr/bin/env python3
"""Audit and repair whitespace introduced by PDF-to-EPUB reflow.

The normalizer is deliberately conservative outside CJK text:

- whitespace adjacent to CJK characters or punctuation is removed;
- ordinary spaces between Latin words are retained;
- zero-width formatting characters are removed;
- whitespace-only paragraphs from PDF reflow are removed;
- paragraphs split only by a PDF page boundary are joined when the previous
  fragment does not end with sentence punctuation.

EPUB resources, archive metadata, and page anchors are preserved. Rewritten
archives keep the required uncompressed ``mimetype`` entry first.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree


CONTENT_SUFFIXES = {".html", ".htm", ".xhtml"}
ZERO_WIDTH_RE = re.compile("[\u200b\u200c\u200d\u2060\ufeff]")
NBSP_ENTITY_RE = re.compile(r"&(?:nbsp|#160|#x0*a0);", re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]*>", re.DOTALL)
TAG_SPLIT_RE = re.compile(r"(<[^>]*>)", re.DOTALL)
BLOCK_RE = re.compile(
    r"<(?P<tag>p|h[1-6]|li|blockquote|figcaption|td|th|dt|dd)\b"
    r"(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=tag)\s*>",
    re.IGNORECASE | re.DOTALL,
)
PARAGRAPH_RE = re.compile(
    r"(?P<open><p\b[^>]*>)(?P<body>.*?)(?P<close></p\s*>)",
    re.IGNORECASE | re.DOTALL,
)
ADJACENT_PAGE_PARAGRAPHS_RE = re.compile(
    r"(?P<open1><p\b[^>]*>)(?P<body1>.*?)(?P<close1></p\s*>)"
    r"(?P<gap>\s*)"
    r"(?P<open2><p\b(?=[^>]*\bid\s*=\s*['\"]page_\d+['\"])[^>]*>)"
    r"(?P<body2>.*?)(?P<close2></p\s*>)",
    re.IGNORECASE | re.DOTALL,
)
PAGE_ID_RE = re.compile(r"\bid\s*=\s*['\"](?P<id>page_\d+)['\"]", re.IGNORECASE)

# CJK ideographs, CJK punctuation, and full-width punctuation. Curly quotes,
# em dashes, and ellipses are intentionally excluded because they also occur
# in English prose with meaningful surrounding spaces. Chinese text around
# those characters is still repaired when the other neighbour is CJK.
CJK_CHARS = (
    "\u3400-\u4dbf"
    "\u4e00-\u9fff"
    "\uf900-\ufaff"
    "\u3000-\u303f"
    "\uff01-\uff65"
)
CJK_SPACE_RE = re.compile(
    rf"(?:(?<=[{CJK_CHARS}]) +| +(?=[{CJK_CHARS}]))"
)
TERMINAL_PUNCTUATION = frozenset("\u3002\uff01\uff1f!?\u2026\uff1a:\uff1b;\u201d\u2019\u300d\u300f\u300b\uff09\u3011.)]")


@dataclass
class RepairStats:
    content_documents: int = 0
    changed_documents: int = 0
    cjk_space_runs: int = 0
    soft_break_runs: int = 0
    zero_width_chars: int = 0
    blank_paragraphs: int = 0
    joined_page_paragraphs: int = 0

    @property
    def changes(self) -> int:
        return (
            self.cjk_space_runs
            + self.soft_break_runs
            + self.zero_width_chars
            + self.blank_paragraphs
            + self.joined_page_paragraphs
        )


@dataclass
class AuditStats:
    cjk_space_runs: int = 0
    zero_width_chars: int = 0
    blank_reflow_paragraphs: int = 0
    split_page_paragraphs: int = 0

    @property
    def issues(self) -> int:
        return (
            self.cjk_space_runs
            + self.zero_width_chars
            + self.blank_reflow_paragraphs
            + self.split_page_paragraphs
        )


def _plain_text(markup: str) -> str:
    return html.unescape(TAG_RE.sub("", markup))


def _visible_chars(tokens: list[str]) -> tuple[str, list[tuple[int, int]]]:
    visible: list[str] = []
    locations: list[tuple[int, int]] = []

    for token_index, token in enumerate(tokens):
        if token.startswith("<"):
            continue
        for char_index, char in enumerate(token):
            visible.append(char)
            locations.append((token_index, char_index))

    return "".join(visible), locations


def _normalize_block_body(body: str, stats: RepairStats) -> str:
    tokens = TAG_SPLIT_RE.split(body)

    for index, token in enumerate(tokens):
        if not token or token.startswith("<"):
            continue

        token = NBSP_ENTITY_RE.sub(" ", token).replace("\u00a0", " ")
        zero_width_count = len(ZERO_WIDTH_RE.findall(token))
        stats.zero_width_chars += zero_width_count
        token = ZERO_WIDTH_RE.sub("", token)

        soft_break_count = len(re.findall(r"[\r\n\t\f\v]+", token))
        stats.soft_break_runs += soft_break_count
        token = re.sub(r"\s+", " ", token)
        tokens[index] = token

    visible, locations = _visible_chars(tokens)
    remove_locations: set[tuple[int, int]] = set()
    for match in CJK_SPACE_RE.finditer(visible):
        stats.cjk_space_runs += 1
        for visible_index in range(match.start(), match.end()):
            remove_locations.add(locations[visible_index])

    if remove_locations:
        for token_index, token in enumerate(tokens):
            if not token or token.startswith("<"):
                continue
            tokens[token_index] = "".join(
                char
                for char_index, char in enumerate(token)
                if (token_index, char_index) not in remove_locations
            )

    return "".join(tokens)


def _normalize_blocks(document: str, stats: RepairStats) -> str:
    def replace(match: re.Match[str]) -> str:
        body = _normalize_block_body(match.group("body"), stats)
        return (
            f"<{match.group('tag')}{match.group('attrs')}>"
            f"{body}</{match.group('tag')}>"
        )

    return BLOCK_RE.sub(replace, document)


def _remove_blank_reflow_paragraphs(document: str, stats: RepairStats) -> str:
    def replace(match: re.Match[str]) -> str:
        if _plain_text(match.group("body")).strip():
            return match.group(0)
        stats.blank_paragraphs += 1
        return ""

    return PARAGRAPH_RE.sub(replace, document)


def _join_page_split_paragraphs(document: str, stats: RepairStats) -> str:
    while True:
        joins_this_pass = 0

        def replace(match: re.Match[str]) -> str:
            nonlocal joins_this_pass
            previous_text = _plain_text(match.group("body1")).rstrip()
            next_text = _plain_text(match.group("body2")).lstrip()
            page_id_match = PAGE_ID_RE.search(match.group("open2"))

            if (
                not previous_text
                or not next_text
                or previous_text[-1] in TERMINAL_PUNCTUATION
                or page_id_match is None
            ):
                return match.group(0)

            joins_this_pass += 1
            stats.joined_page_paragraphs += 1
            page_id = page_id_match.group("id")
            return (
                f"{match.group('open1')}{match.group('body1')}"
                f'<span id="{page_id}"></span>'
                f"{match.group('body2')}{match.group('close2')}"
            )

        updated = ADJACENT_PAGE_PARAGRAPHS_RE.sub(replace, document)
        document = updated
        if joins_this_pass == 0:
            return document


def repair_document(source: str, stats: RepairStats) -> str:
    stats.content_documents += 1
    is_pdf_reflow = "PDF Reflow conversion" in source
    if not is_pdf_reflow:
        return source

    repaired = _normalize_blocks(source, stats)
    repaired = _remove_blank_reflow_paragraphs(repaired, stats)
    repaired = _join_page_split_paragraphs(repaired, stats)

    if repaired != source:
        stats.changed_documents += 1
    return repaired


def _is_joinable_page_split(match: re.Match[str]) -> bool:
    previous_text = _plain_text(match.group("body1")).rstrip()
    next_text = _plain_text(match.group("body2")).lstrip()
    return bool(
        previous_text
        and next_text
        and previous_text[-1] not in TERMINAL_PUNCTUATION
    )


def audit_document(source: str) -> AuditStats:
    stats = AuditStats()
    if "PDF Reflow conversion" not in source:
        return stats

    for block in BLOCK_RE.finditer(source):
        text = _plain_text(block.group("body"))
        stats.cjk_space_runs += len(CJK_SPACE_RE.findall(text.replace("\u00a0", " ")))
        stats.zero_width_chars += len(ZERO_WIDTH_RE.findall(text))

    for paragraph in PARAGRAPH_RE.finditer(source):
        if not _plain_text(paragraph.group("body")).strip():
            stats.blank_reflow_paragraphs += 1
    stats.split_page_paragraphs += sum(
        1
        for match in ADJACENT_PAGE_PARAGRAPHS_RE.finditer(source)
        if _is_joinable_page_split(match)
    )
    return stats


def _decode_content(data: bytes, name: str) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError(f"{name} is not valid UTF-8") from error


def _write_archive(
    epub_path: Path,
    entries: list[tuple[zipfile.ZipInfo, bytes]],
    archive_comment: bytes,
) -> None:
    original_mode = epub_path.stat().st_mode
    temp_file = tempfile.NamedTemporaryFile(
        prefix=f".{epub_path.name}.",
        suffix=".tmp",
        dir=epub_path.parent,
        delete=False,
    )
    temp_path = Path(temp_file.name)
    temp_file.close()

    try:
        with zipfile.ZipFile(temp_path, "w") as target:
            target.comment = archive_comment
            for info, data in entries:
                target.writestr(info, data)
        os.chmod(temp_path, original_mode)
        os.replace(temp_path, epub_path)
    finally:
        temp_path.unlink(missing_ok=True)


def repair_epub(epub_path: Path, write: bool) -> RepairStats:
    stats = RepairStats()
    entries: list[tuple[zipfile.ZipInfo, bytes]] = []

    with zipfile.ZipFile(epub_path) as archive:
        archive_comment = archive.comment
        for info in archive.infolist():
            data = archive.read(info.filename)
            if Path(info.filename).suffix.lower() in CONTENT_SUFFIXES:
                source = _decode_content(data, info.filename)
                repaired = repair_document(source, stats)
                if repaired != source:
                    data = repaired.encode("utf-8")
            entries.append((info, data))

    if write and stats.changed_documents:
        _write_archive(epub_path, entries, archive_comment)
    return stats


def audit_epub(epub_path: Path) -> AuditStats:
    total = AuditStats()
    with zipfile.ZipFile(epub_path) as archive:
        for info in archive.infolist():
            if Path(info.filename).suffix.lower() not in CONTENT_SUFFIXES:
                continue
            source = _decode_content(archive.read(info.filename), info.filename)
            current = audit_document(source)
            total.cjk_space_runs += current.cjk_space_runs
            total.zero_width_chars += current.zero_width_chars
            total.blank_reflow_paragraphs += current.blank_reflow_paragraphs
            total.split_page_paragraphs += current.split_page_paragraphs
    return total


def _container_rootfile(container_xml: bytes) -> str:
    root = ElementTree.fromstring(container_xml)
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == "rootfile":
            path = element.attrib.get("full-path")
            if path:
                return path
    raise ValueError("container.xml does not declare an OPF rootfile")


def validate_epub(epub_path: Path) -> None:
    with zipfile.ZipFile(epub_path) as archive:
        entries = archive.infolist()
        if not entries or entries[0].filename != "mimetype":
            raise ValueError("mimetype must be the first archive entry")
        if entries[0].compress_type != zipfile.ZIP_STORED:
            raise ValueError("mimetype must be stored without compression")
        if archive.read("mimetype") != b"application/epub+zip":
            raise ValueError("invalid EPUB mimetype value")
        damaged_entry = archive.testzip()
        if damaged_entry:
            raise ValueError(f"CRC check failed for {damaged_entry}")

        container_xml = archive.read("META-INF/container.xml")
        opf_path = _container_rootfile(container_xml)
        ElementTree.fromstring(archive.read(opf_path))

        for info in entries:
            if Path(info.filename).suffix.lower() in CONTENT_SUFFIXES:
                ElementTree.fromstring(archive.read(info.filename))


def discover_epubs(paths: Iterable[Path]) -> list[Path]:
    discovered: set[Path] = set()
    for path in paths:
        if path.is_file() and path.suffix.lower() == ".epub":
            discovered.add(path.resolve())
        elif path.is_dir():
            discovered.update(item.resolve() for item in path.rglob("*.epub"))
    return sorted(discovered)


def _repair_summary(path: Path, stats: RepairStats, write: bool) -> str:
    status = "CHANGED" if write and stats.changed_documents else "WOULD_CHANGE" if stats.changed_documents else "OK"
    return (
        f"{status} {path}: docs={stats.content_documents}, "
        f"cjk_spaces={stats.cjk_space_runs}, soft_breaks={stats.soft_break_runs}, "
        f"zero_width={stats.zero_width_chars}, blank_paragraphs={stats.blank_paragraphs}, "
        f"page_joins={stats.joined_page_paragraphs}"
    )


def _audit_summary(path: Path, stats: AuditStats) -> str:
    status = "OK" if stats.issues == 0 else "ISSUES"
    return (
        f"{status} {path}: cjk_spaces={stats.cjk_space_runs}, "
        f"zero_width={stats.zero_width_chars}, "
        f"blank_paragraphs={stats.blank_reflow_paragraphs}, "
        f"split_page_paragraphs={stats.split_page_paragraphs}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="EPUB files or directories")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="rewrite affected EPUB files")
    mode.add_argument("--check", action="store_true", help="exit non-zero if issues remain")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    epub_paths = discover_epubs(args.paths)
    if not epub_paths:
        print("No EPUB files found", file=sys.stderr)
        return 2

    has_issues = False
    for epub_path in epub_paths:
        try:
            validate_epub(epub_path)
            if args.check:
                audit = audit_epub(epub_path)
                has_issues = has_issues or audit.issues > 0
                print(_audit_summary(epub_path, audit))
            else:
                stats = repair_epub(epub_path, write=args.write)
                if args.write:
                    validate_epub(epub_path)
                print(_repair_summary(epub_path, stats, args.write))
        except (OSError, ValueError, zipfile.BadZipFile, ElementTree.ParseError) as error:
            has_issues = True
            print(f"ERROR {epub_path}: {error}", file=sys.stderr)

    return 1 if has_issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
