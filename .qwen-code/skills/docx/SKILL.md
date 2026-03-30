---
name: docx
description: Create, read, and edit Word documents (.docx files). Use when the user wants to produce a professional Word document, edit an existing .docx, extract content from a Word file, or convert content into a formatted document with headings, tables, or page layout.
---

# DOCX Skill

Create and manipulate Word documents using Python and the `python-docx` library.

## When to Use

- User asks for a Word document, .docx file, report, letter, memo, or template
- User wants to edit or extract content from an existing .docx
- Any output that needs professional formatting: headings, tables, TOC, page numbers

## Quick Start

```bash
pip install python-docx --break-system-packages
```

## Creating a Document

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
title = doc.add_heading('Document Title', 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Heading + paragraph
doc.add_heading('Section 1', level=1)
doc.add_paragraph('Body text goes here.')

# Table
table = doc.add_table(rows=1, cols=3)
table.style = 'Table Grid'
header = table.rows[0].cells
header[0].text = 'Column A'
header[1].text = 'Column B'
header[2].text = 'Column C'

row = table.add_row().cells
row[0].text = 'Value 1'
row[1].text = 'Value 2'
row[2].text = 'Value 3'

doc.save('output.docx')
print("Saved output.docx")
```

## Reading a Document

```python
from docx import Document

doc = Document('input.docx')
for para in doc.paragraphs:
    if para.text.strip():
        print(f"[{para.style.name}] {para.text}")
```

## Key Rules

- Always save to `/mnt/user-data/outputs/` when delivering to the user
- Use `doc.add_page_break()` between major sections when appropriate
- Set font size with `run.font.size = Pt(12)`
- Bold: `run.bold = True`, Italic: `run.italic = True`
- For complex layouts, build the structure in Python — don't try to write raw XML
