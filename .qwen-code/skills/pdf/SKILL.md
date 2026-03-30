---
name: pdf
description: Read, extract, merge, split, and create PDF files. Use when the user wants to work with PDFs — extracting text or tables, combining files, rotating pages, adding watermarks, or creating new PDFs from content.
---

# PDF Skill

Work with PDFs using `pypdf` for manipulation and `reportlab` for creation.

## When to Use

- Extract text or tables from a PDF
- Merge multiple PDFs into one
- Split a PDF into separate pages or ranges
- Create a new PDF from content
- Rotate pages, add watermarks, encrypt

## Setup

```bash
pip install pypdf reportlab --break-system-packages
```

## Reading / Extracting Text

```python
from pypdf import PdfReader

reader = PdfReader('input.pdf')
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"--- Page {i+1} ---\n{text}")
```

## Merging PDFs

```python
from pypdf import PdfMerger

merger = PdfMerger()
for f in ['file1.pdf', 'file2.pdf', 'file3.pdf']:
    merger.append(f)
merger.write('merged.pdf')
merger.close()
```

## Splitting a PDF

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader('input.pdf')
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f'page_{i+1}.pdf', 'wb') as f:
        writer.write(f)
```

## Creating a PDF from Scratch

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

doc = SimpleDocTemplate('output.pdf', pagesize=A4)
styles = getSampleStyleSheet()
story = []

story.append(Paragraph('My Report', styles['Title']))
story.append(Spacer(1, 12))
story.append(Paragraph('Introduction paragraph here.', styles['Normal']))

# Table
data = [['Name', 'Value'], ['Item A', '100'], ['Item B', '200']]
table = Table(data)
table.setStyle([('BACKGROUND', (0,0), (-1,0), colors.grey),
                ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
                ('GRID',       (0,0), (-1,-1), 0.5, colors.black)])
story.append(table)

doc.build(story)
print("Saved output.pdf")
```

## Key Rules

- Always output to `/mnt/user-data/outputs/` for delivery
- For scanned PDFs with no selectable text, note this to the user — OCR is needed (install `pytesseract` + `pdf2image`)
- Use `pypdf` for manipulation, `reportlab` for creation — don't mix them
