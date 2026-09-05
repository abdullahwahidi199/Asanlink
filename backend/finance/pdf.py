from datetime import datetime


def _escape_pdf_text(value):
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def render_transactions_pdf(rows, metadata):
    """Render a dependency-free, valid single-font PDF report.

    The report intentionally uses a compact landscape-like data presentation and
    paginates at 34 ledger rows so it remains useful without an optional PDF package.
    """

    title = metadata.get("title", "Finance transaction report")
    company = metadata.get("company", "Asanlink")
    generated = metadata.get("generated", datetime.now().isoformat(timespec="minutes"))
    filters = metadata.get("filters", "None")
    page_rows = [rows[index:index + 34] for index in range(0, len(rows), 34)] or [[]]
    objects = []
    page_ids = []
    font_id = 3
    next_id = 4

    for page_number, chunk in enumerate(page_rows, start=1):
        page_id, content_id = next_id, next_id + 1
        next_id += 2
        page_ids.append(page_id)
        commands = [
            "BT", "/F1 18 Tf", "50 790 Td", f"({_escape_pdf_text(company)}) Tj",
            "/F1 13 Tf", "0 -24 Td", f"({_escape_pdf_text(title)}) Tj",
            "/F1 8 Tf", "0 -17 Td", f"(Generated: {_escape_pdf_text(generated)}) Tj",
            "0 -12 Td", f"(Filters: {_escape_pdf_text(filters)[:110]}) Tj",
            "0 -22 Td", "(Date       Type          Member                 Description                         Amount        Status) Tj",
            "0 -10 Td", "(----------------------------------------------------------------------------------------------------) Tj",
        ]
        for row in chunk:
            line = (
                f"{row['date'][:10]:10}  {row['type'][:12]:12}  "
                f"{row['member']['full_name'][:20]:20}  {row['description'][:35]:35}  "
                f"{row['currency']} {row['amount']:>11}  {row['status'][:12]}"
            )
            commands.extend(("0 -15 Td", f"({_escape_pdf_text(line)}) Tj"))
        commands.extend(("0 -24 Td", f"(Page {page_number} of {len(page_rows)}  |  {len(rows)} transactions total) Tj", "ET"))
        stream = "\n".join(commands).encode("latin-1", errors="replace")
        page_object = f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>".encode()
        content_object = b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        objects.extend(((page_id, page_object), (content_id, content_object)))

    all_objects = [
        (1, b"<< /Type /Catalog /Pages 2 0 R >>"),
        (2, f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] /Count {len(page_ids)} >>".encode()),
        (3, b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"),
        *objects,
    ]
    all_objects.sort(key=lambda item: item[0])
    document = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = {0: 0}
    for object_id, body in all_objects:
        offsets[object_id] = len(document)
        document.extend(f"{object_id} 0 obj\n".encode())
        document.extend(body)
        document.extend(b"\nendobj\n")
    xref = len(document)
    size = max(offsets) + 1
    document.extend(f"xref\n0 {size}\n".encode())
    document.extend(b"0000000000 65535 f \n")
    for object_id in range(1, size):
        document.extend(f"{offsets[object_id]:010d} 00000 n \n".encode())
    document.extend(f"trailer\n<< /Size {size} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(document)
