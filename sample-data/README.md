# Sample Data

This folder contains synthetic files for testing the HealthIntel demo.

## Files

```text
healthintel-sample-appeal-packet.pdf
healthintel-large-appeal-packet-with-images.pdf
```

Use these PDFs on the `/intake` page to test upload, PDF text extraction,
summary-first LLM extraction, deterministic fallback extraction, and case packet
generation.

The smaller packet is a quick 3-page smoke test. The larger packet is a 12-page
appeal packet with embedded image-style attachments, chart-like visuals,
timeline notes, guideline signals, evidence mapping, and missing-document
signals.

To regenerate the larger packet:

```powershell
python sample-data\generate_large_sample_pdf.py
```

The sample is fake and contains no real patient information.
