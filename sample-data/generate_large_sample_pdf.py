from __future__ import annotations

import zlib
from pathlib import Path
from textwrap import wrap


OUTPUT = Path(__file__).with_name("healthintel-large-appeal-packet-with-images.pdf")
PAGE_WIDTH = 612
PAGE_HEIGHT = 792


class PdfWriter:
    def __init__(self) -> None:
        self.objects: list[bytes | None] = []

    def add(self, data: bytes | None = None) -> int:
        self.objects.append(data)
        return len(self.objects)

    def set(self, object_id: int, data: bytes) -> None:
        self.objects[object_id - 1] = data

    def write(self, path: Path) -> None:
        pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]

        for index, data in enumerate(self.objects, start=1):
            if data is None:
                raise ValueError(f"PDF object {index} was not populated")
            offsets.append(len(pdf))
            pdf.extend(f"{index} 0 obj\n".encode("ascii"))
            pdf.extend(data)
            pdf.extend(b"\nendobj\n")

        xref_offset = len(pdf)
        pdf.extend(f"xref\n0 {len(self.objects) + 1}\n".encode("ascii"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(self.objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("ascii")
        )
        path.write_bytes(pdf)


def stream_object(payload: bytes) -> bytes:
    compressed = zlib.compress(payload, level=6)
    return (
        b"<< /Filter /FlateDecode /Length "
        + str(len(compressed)).encode("ascii")
        + b" >>\nstream\n"
        + compressed
        + b"\nendstream"
    )


def image_object(width: int, height: int, pixels: bytes) -> bytes:
    compressed = zlib.compress(pixels, level=6)
    return (
        (
            f"<< /Type /XObject /Subtype /Image /Width {width} /Height {height} "
            "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "
            f"/Length {len(compressed)} >>\nstream\n"
        ).encode("ascii")
        + compressed
        + b"\nendstream"
    )


def rgb_canvas(width: int, height: int, color: tuple[int, int, int]) -> bytearray:
    r, g, b = color
    return bytearray([r, g, b] * width * height)


def set_pixel(
    pixels: bytearray,
    width: int,
    height: int,
    x: int,
    y: int,
    color: tuple[int, int, int],
) -> None:
    if not (0 <= x < width and 0 <= y < height):
        return
    index = (y * width + x) * 3
    pixels[index : index + 3] = bytes(color)


def fill_rect(
    pixels: bytearray,
    width: int,
    height: int,
    x: int,
    y: int,
    rect_width: int,
    rect_height: int,
    color: tuple[int, int, int],
) -> None:
    for row in range(max(0, y), min(height, y + rect_height)):
        for col in range(max(0, x), min(width, x + rect_width)):
            set_pixel(pixels, width, height, col, row, color)


def draw_line(
    pixels: bytearray,
    width: int,
    height: int,
    start: tuple[int, int],
    end: tuple[int, int],
    color: tuple[int, int, int],
    thickness: int = 1,
) -> None:
    x1, y1 = start
    x2, y2 = end
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for step in range(steps + 1):
        x = round(x1 + (x2 - x1) * step / steps)
        y = round(y1 + (y2 - y1) * step / steps)
        fill_rect(pixels, width, height, x, y, thickness, thickness, color)


def create_scan_image() -> tuple[int, int, bytes]:
    width, height = 520, 360
    pixels = rgb_canvas(width, height, (246, 246, 241))
    for y in range(height):
        for x in range(width):
            shade = 246 - ((x * 7 + y * 11) % 11)
            set_pixel(pixels, width, height, x, y, (shade, shade, shade - 4))

    fill_rect(pixels, width, height, 38, 24, 444, 304, (255, 255, 250))
    for x in range(38, 482):
        set_pixel(pixels, width, height, x, 24, (95, 95, 95))
        set_pixel(pixels, width, height, x, 328, (95, 95, 95))
    for y in range(24, 329):
        set_pixel(pixels, width, height, 38, y, (95, 95, 95))
        set_pixel(pixels, width, height, 482, y, (95, 95, 95))

    fill_rect(pixels, width, height, 68, 52, 210, 14, (28, 62, 85))
    fill_rect(pixels, width, height, 68, 84, 350, 7, (42, 42, 42))
    fill_rect(pixels, width, height, 68, 104, 280, 6, (42, 42, 42))
    for row in range(7):
        y = 138 + row * 22
        fill_rect(pixels, width, height, 68, y, 380 - row * 18, 5, (55, 55, 55))
    fill_rect(pixels, width, height, 68, 292, 118, 16, (25, 25, 25))
    fill_rect(pixels, width, height, 210, 292, 118, 16, (25, 25, 25))
    draw_line(pixels, width, height, (70, 252), (450, 272), (130, 130, 130), 2)
    return width, height, bytes(pixels)


def create_chart_image() -> tuple[int, int, bytes]:
    width, height = 600, 260
    pixels = rgb_canvas(width, height, (251, 253, 252))
    axis = (58, 70, 83)
    grid = (218, 228, 232)

    for y in [48, 88, 128, 168, 208]:
        draw_line(pixels, width, height, (58, y), (560, y), grid)
    draw_line(pixels, width, height, (58, 30), (58, 218), axis, 2)
    draw_line(pixels, width, height, (58, 218), (560, 218), axis, 2)

    bars = [
        (82, 120, (50, 130, 184)),
        (146, 138, (50, 130, 184)),
        (210, 152, (31, 141, 112)),
        (274, 160, (31, 141, 112)),
        (338, 172, (234, 126, 56)),
        (402, 182, (224, 88, 88)),
    ]
    for x, value, color in bars:
        fill_rect(pixels, width, height, x, 218 - value, 42, value, color)
        fill_rect(pixels, width, height, x + 4, 218 - value + 4, 42, value, (0, 0, 0))

    line_points = [
        (82, 152),
        (146, 141),
        (210, 130),
        (274, 120),
        (338, 98),
        (402, 82),
        (466, 76),
    ]
    for start, end in zip(line_points, line_points[1:], strict=False):
        draw_line(pixels, width, height, start, end, (111, 63, 168), 3)
    for point in line_points:
        fill_rect(
            pixels, width, height, point[0] - 4, point[1] - 4, 8, 8, (111, 63, 168)
        )

    return width, height, bytes(pixels)


def create_heatmap_image() -> tuple[int, int, bytes]:
    width, height = 540, 250
    pixels = rgb_canvas(width, height, (250, 250, 248))
    colors = [
        (225, 245, 240),
        (162, 221, 209),
        (94, 177, 167),
        (254, 224, 139),
        (244, 109, 67),
    ]
    for row in range(5):
        for col in range(6):
            color = colors[(row + col * 2) % len(colors)]
            fill_rect(
                pixels, width, height, 44 + col * 78, 38 + row * 34, 66, 24, color
            )
            draw_line(
                pixels,
                width,
                height,
                (44 + col * 78, 38 + row * 34),
                (110 + col * 78, 38 + row * 34),
                (78, 86, 92),
            )
    draw_line(pixels, width, height, (36, 28), (516, 28), (74, 85, 94), 2)
    draw_line(pixels, width, height, (36, 220), (516, 220), (74, 85, 94), 2)
    for x in range(36, 517, 80):
        draw_line(pixels, width, height, (x, 28), (x, 220), (180, 190, 196))
    return width, height, bytes(pixels)


def pdf_escape(value: str) -> str:
    return value.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def add_text(
    commands: list[str],
    text: str,
    x: int,
    y: int,
    *,
    font: str = "F1",
    size: int = 9,
    color: tuple[float, float, float] = (0.12, 0.15, 0.18),
) -> None:
    commands.append("BT")
    commands.append(f"{color[0]} {color[1]} {color[2]} rg")
    commands.append(f"/{font} {size} Tf")
    commands.append(f"{x} {y} Td")
    commands.append(f"({pdf_escape(text)}) Tj")
    commands.append("ET")


def add_wrapped(
    commands: list[str],
    text: str,
    x: int,
    y: int,
    *,
    width: int = 92,
    font: str = "F1",
    size: int = 9,
    leading: int = 12,
    prefix: str = "",
) -> int:
    lines = wrap(text, width=width)
    for index, line in enumerate(lines):
        add_text(
            commands,
            f"{prefix if index == 0 else '  '}{line}",
            x,
            y,
            font=font,
            size=size,
        )
        y -= leading
    return y


def add_page_content(
    title: str,
    sections: list[tuple[str, list[str]]],
    page_number: int,
    *,
    image_name: str | None = None,
    image_caption: str | None = None,
) -> bytes:
    commands: list[str] = []
    commands.append("0.94 0.97 0.98 rg 0 760 612 32 re f")
    commands.append("0.10 0.38 0.45 rg 0 756 612 4 re f")
    add_text(
        commands, "HealthIntel Synthetic Appeal Packet", 40, 771, font="F2", size=10
    )
    add_text(commands, f"Page {page_number}", 540, 771, font="F1", size=8)
    add_text(commands, title, 40, 730, font="F2", size=15, color=(0.08, 0.12, 0.16))

    y = 704
    lower_limit = 312 if image_name else 62
    for heading, items in sections:
        if y < lower_limit + 24:
            break
        add_text(commands, heading, 40, y, font="F2", size=10, color=(0.06, 0.31, 0.36))
        y -= 15
        for item in items:
            bullet = "- " if not item.startswith("|") else ""
            y = add_wrapped(commands, item, 54, y, width=92, prefix=bullet)
            y -= 4
            if y < lower_limit:
                break
        y -= 4

    if image_name:
        commands.append(f"q 500 0 0 210 56 86 cm /{image_name} Do Q")
        commands.append("0.83 0.88 0.90 RG 56 86 500 210 re S")
        if image_caption:
            add_wrapped(commands, image_caption, 56, 68, width=86, size=8, leading=10)

    add_text(
        commands,
        "Synthetic data for demo testing only. No real patient information.",
        40,
        30,
        size=7,
        color=(0.38, 0.42, 0.46),
    )
    return stream_object("\n".join(commands).encode("latin-1"))


PAGES: list[dict[str, object]] = [
    {
        "title": "Appeal Cover Sheet And Intake Metadata",
        "sections": [
            (
                "Case Snapshot",
                [
                    "Case ID HI-LARGE-24088. Member Elena Thompson, age 59, Commercial PPO. Provider North Valley Spine Institute.",
                    "Appeal type is medical necessity. Review request is expedited because the provider documents progressive weakness and sleep disruption from radicular pain.",
                    "Service requested is MRI lumbar spine without contrast after denial of prior authorization.",
                    "Initial denial stated that the packet did not clearly demonstrate six weeks of conservative care or objective neurologic deficit.",
                ],
            ),
            (
                "Triage Flags",
                [
                    "Urgency: expedited review requested within 72 hours.",
                    "Specialty routing: orthopedic spine or neurology reviewer recommended.",
                    "Risk signal: worsening left foot dorsiflexion weakness, gait instability, and persistent numbness in L5 distribution.",
                ],
            ),
            (
                "Documents In Packet",
                [
                    "Denial letter, provider appeal letter, primary care notes, physical therapy notes, medication list, orthopedic consult, pain diary, and image attachments.",
                    "Some supporting pages are embedded as image scans to mimic real-world faxed packets.",
                ],
            ),
        ],
    },
    {
        "title": "Plan Denial Letter",
        "sections": [
            (
                "Denial Rationale",
                [
                    "The requested MRI lumbar spine without contrast was denied as not medically necessary under plan imaging policy IMG-LSP-204.",
                    "The reviewer noted that conservative therapy duration was unclear and that objective neurologic findings were not summarized in the original prior authorization request.",
                    "The plan requested documentation of at least six weeks of provider-directed conservative treatment, progressive neurologic deficit, or red flag features.",
                ],
            ),
            (
                "Policy Criteria Cited",
                [
                    "Criterion 1: persistent radiculopathy after conservative treatment including medication management and physical therapy.",
                    "Criterion 2: objective neurologic deficit such as motor weakness, abnormal reflex, sensory deficit, or positive nerve tension signs.",
                    "Criterion 3: imaging expected to change management, including injection planning, surgical referral, or exclusion of compressive lesion.",
                ],
            ),
            (
                "Appeal Issue",
                [
                    "Provider states the original submission was fragmented and did not include the complete physical therapy record or the latest neurologic exam.",
                    "Appeal packet now includes additional notes supporting duration and objective deficit.",
                ],
            ),
        ],
    },
    {
        "title": "Provider Appeal Letter",
        "sections": [
            (
                "Appeal Argument",
                [
                    "Dr. Aaron Mehta requests reversal of the denial because the member has persistent lumbar radiculopathy despite conservative care.",
                    "Symptoms have continued for more than eight weeks and include pain radiating below the knee, paresthesia, and weakness affecting ambulation.",
                    "MRI is requested to evaluate suspected L4-L5 or L5-S1 nerve root compression and to guide the next treatment step.",
                ],
            ),
            (
                "Clinical Impact",
                [
                    "The provider documents that the patient cannot sleep through the night, has missed work, and has difficulty walking more than one block.",
                    "Treatment options under consideration include epidural steroid injection, spine surgery referral, or continued conservative care if imaging does not show compression.",
                    "Provider asks for expedited appeal because progressive weakness may affect care access if review waits for the standard timeline.",
                ],
            ),
        ],
    },
    {
        "title": "Primary Care And Pain History",
        "sections": [
            (
                "Primary Care Notes",
                [
                    "2026-02-04: New low back pain radiating to the left buttock and calf. Pain score 8 of 10. Ibuprofen, heat, home stretching, and activity modification recommended.",
                    "2026-02-13: Persistent pain. Positive straight-leg raise on the left. Cyclobenzaprine added for night spasms.",
                    "2026-03-02: Patient reports numbness over dorsum of left foot and difficulty climbing stairs. Referral to physical therapy placed.",
                    "2026-03-21: Pain continues despite medication and home exercise. Provider notes possible radiculopathy and orders specialist evaluation.",
                ],
            ),
            (
                "Patient-Reported Impact",
                [
                    "Pain diary reports six nights per week with sleep interruption.",
                    "Member reports using a cane during longer walks because of instability.",
                    "No fever, cancer history, bowel or bladder dysfunction, or recent trauma documented.",
                ],
            ),
        ],
    },
    {
        "title": "Physical Therapy Notes With Scanned Attachment",
        "image": "ImScan",
        "caption": "Embedded scan-style image: physical therapy plan of care. Current PDF text extraction reads the selectable text on this page, but image-only content requires OCR.",
        "sections": [
            (
                "Physical Therapy Summary",
                [
                    "Formal PT began 2026-02-20 and continued through 2026-04-03 for nine documented visits.",
                    "Modalities included core stabilization, nerve glides, manual therapy, graded walking, and a home exercise program.",
                    "Progress note from 2026-03-28 says lumbar range of motion improved slightly, but leg pain and numbness persisted.",
                ],
            ),
            (
                "Functional Findings",
                [
                    "Oswestry disability score improved from 46 percent to 40 percent, which the therapist described as limited improvement.",
                    "Therapist recommended advanced imaging or specialist follow-up due to persistent radicular symptoms.",
                ],
            ),
        ],
    },
    {
        "title": "Medication And Conservative Therapy Utilization",
        "image": "ImChart",
        "caption": "Embedded chart image: conservative therapy timeline and pain trend. Text below the image is intentionally not machine-readable without OCR.",
        "sections": [
            (
                "Medication Trials",
                [
                    "Ibuprofen 600 mg three times daily as needed from 2026-02-04 to 2026-03-18, partial relief only.",
                    "Cyclobenzaprine 5 mg nightly from 2026-02-13 to 2026-03-10, stopped due to morning sedation.",
                    "Gabapentin 100 mg nightly started 2026-03-21 and titrated to 300 mg nightly with mild improvement in sleep but persistent leg symptoms.",
                ],
            ),
            (
                "Conservative Care Duration",
                [
                    "Provider-directed conservative care totals more than eight weeks when PCP management, medications, home exercise, and formal PT are combined.",
                    "The clearest documentation gap is that therapy dates are split across separate notes rather than summarized in one table.",
                ],
            ),
        ],
    },
    {
        "title": "Orthopedic Spine Consultation",
        "sections": [
            (
                "Specialist Exam",
                [
                    "2026-04-08 orthopedic spine visit documents left ankle dorsiflexion 4 of 5, great toe extension 4 of 5, and decreased sensation over the left dorsal foot.",
                    "Straight-leg raise is positive at 38 degrees on the left and negative on the right.",
                    "Reflexes are symmetric. No saddle anesthesia. No bowel or bladder symptoms.",
                    "Assessment: lumbar radiculopathy with suspected L4-L5 disc herniation and progressive motor deficit.",
                ],
            ),
            (
                "Plan",
                [
                    "MRI lumbar spine without contrast requested before injection or surgery discussion.",
                    "Specialist states imaging will determine whether an epidural steroid injection is appropriate or whether urgent surgical consultation is needed.",
                    "Provider recommends expedited authorization because weakness is worsening over two visits.",
                ],
            ),
        ],
    },
    {
        "title": "Guideline And Policy Match",
        "image": "ImHeatmap",
        "caption": "Embedded guideline heatmap image: criteria strength by source. The selectable text on this page contains the same key criteria for extraction.",
        "sections": [
            (
                "Guideline Signals Supporting Approval",
                [
                    "Persistent radicular pain after provider-directed conservative therapy is documented across PCP and PT records.",
                    "Objective neurologic deficit is documented by the orthopedic specialist: dorsiflexion weakness and sensory loss.",
                    "Requested MRI is expected to change management by guiding injection planning or surgical referral.",
                ],
            ),
            (
                "Signals Creating Review Caution",
                [
                    "Denial reviewer correctly noted that the original packet did not summarize therapy duration clearly.",
                    "Some PT details are present only in scan-style attachment, so source reliability depends on OCR or manual review.",
                ],
            ),
        ],
    },
    {
        "title": "Evidence Map",
        "sections": [
            (
                "Evidence Supporting Overturn",
                [
                    "| Source | Key fact | Review value |",
                    "| PCP notes | positive straight-leg raise and persistent symptoms | supports radiculopathy |",
                    "| PT notes | nine visits with limited improvement | supports failed conservative therapy |",
                    "| Specialist note | motor weakness and sensory loss | supports objective neurologic deficit |",
                    "| Appeal letter | imaging will guide injection or surgical referral | supports management impact |",
                ],
            ),
            (
                "Evidence Supporting Uphold",
                [
                    "Original prior authorization packet was incomplete and did not include the most recent specialist exam.",
                    "Conservative therapy duration requires synthesis across multiple documents rather than a single attestation.",
                    "No red flag symptoms such as cancer history, infection, trauma, or cauda equina syndrome are documented.",
                ],
            ),
        ],
    },
    {
        "title": "Missing Documents And QA Concerns",
        "sections": [
            (
                "Potential Missing Items",
                [
                    "Complete PT plan of care with therapist signature, if the scanned image is not accepted as documentation.",
                    "Medication fill history could confirm duration, but provider notes already document trials.",
                    "Any prior imaging report should be requested if available, although no prior lumbar MRI is referenced.",
                ],
            ),
            (
                "QA Checks",
                [
                    "Confirm expedited criteria because the appeal letter cites progressive weakness, but the exact onset date of weakness is not perfectly clear.",
                    "Confirm reviewer specialty alignment with spine, orthopedic, neurology, or musculoskeletal clinical expertise.",
                    "Ensure decision letter cites both conservative therapy and objective neurologic deficit to address the original denial rationale.",
                ],
            ),
        ],
    },
    {
        "title": "Draft Decision Support Output",
        "sections": [
            (
                "Suggested Review Position",
                [
                    "Likely approve or overturn denial if reviewer accepts the appeal packet as demonstrating more than six weeks of conservative care and objective neurologic deficit.",
                    "The appeal record now addresses the two main denial gaps: duration of conservative therapy and specialist-documented motor weakness.",
                    "Because imaging will guide treatment selection, the management-impact criterion is also met.",
                ],
            ),
            (
                "Draft Rationale",
                [
                    "The member has persistent lumbar radiculopathy despite medications, home exercise, and formal physical therapy.",
                    "Orthopedic spine evaluation documents objective motor weakness and sensory deficit, and MRI is needed to determine next treatment steps.",
                    "Decision should cite policy IMG-LSP-204 and the latest specialist exam date.",
                ],
            ),
        ],
    },
    {
        "title": "Operational Audit Trail",
        "sections": [
            (
                "Processing Notes",
                [
                    "Packet received 2026-04-12 at 09:14 local time. Expedited appeal clock started on receipt.",
                    "Automated triage classified the appeal as medical necessity, high priority, spine specialty, and deadline-sensitive.",
                    "Suggested reviewer: orthopedic spine reviewer with backup neurology reviewer if spine queue capacity is unavailable.",
                    "Audit requirement: preserve extracted facts, source document references, reviewer action, and decision letter rationale.",
                ],
            ),
            (
                "Synthetic Test Coverage",
                [
                    "This packet is designed to test long PDF extraction, image attachments, clinical summarization, guideline signals, routing, missing documentation, and draft recommendation generation.",
                    "No real patient information is included.",
                ],
            ),
        ],
    },
]


def build_pdf() -> None:
    writer = PdfWriter()
    catalog_ref = writer.add()
    pages_ref = writer.add()
    font_ref = writer.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    bold_ref = writer.add(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
    )

    scan_w, scan_h, scan_pixels = create_scan_image()
    chart_w, chart_h, chart_pixels = create_chart_image()
    heat_w, heat_h, heat_pixels = create_heatmap_image()

    scan_ref = writer.add(image_object(scan_w, scan_h, scan_pixels))
    chart_ref = writer.add(image_object(chart_w, chart_h, chart_pixels))
    heat_ref = writer.add(image_object(heat_w, heat_h, heat_pixels))

    image_refs = {
        "ImScan": scan_ref,
        "ImChart": chart_ref,
        "ImHeatmap": heat_ref,
    }

    page_refs: list[int] = []
    for index, page in enumerate(PAGES, start=1):
        content = add_page_content(
            str(page["title"]),
            page["sections"],  # type: ignore[arg-type]
            index,
            image_name=page.get("image"),  # type: ignore[arg-type]
            image_caption=page.get("caption"),  # type: ignore[arg-type]
        )
        content_ref = writer.add(content)
        xobjects = " ".join(f"/{name} {ref} 0 R" for name, ref in image_refs.items())
        page_ref = writer.add(
            (
                f"<< /Type /Page /Parent {pages_ref} 0 R "
                f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {font_ref} 0 R /F2 {bold_ref} 0 R >> "
                f"/XObject << {xobjects} >> >> "
                f"/Contents {content_ref} 0 R >>"
            ).encode("ascii")
        )
        page_refs.append(page_ref)

    kids = " ".join(f"{page_ref} 0 R" for page_ref in page_refs)
    writer.set(
        catalog_ref, f"<< /Type /Catalog /Pages {pages_ref} 0 R >>".encode("ascii")
    )
    writer.set(
        pages_ref,
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_refs)} >>".encode("ascii"),
    )
    writer.write(OUTPUT)


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT)
    print(f"{OUTPUT.stat().st_size} bytes")
