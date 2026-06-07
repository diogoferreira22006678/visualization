# Paris Housing Price Dashboard

An interactive data visualization dashboard built with D3.js v7, exploring the [Paris Housing Price Prediction](https://www.kaggle.com/datasets/mssmartypants/paris-housing-price-prediction/data) dataset from Kaggle.

**Course:** Visualização de Informação — 2025/2026

---

## Features

- **KPI header** — animated counters for total properties, average price, average area, and pool percentage
- **Global filter bar** — price range slider, zone chips, and pool toggle; all charts update in sync
- **4 coordinated charts:**

| # | Chart | Encodings |
|---|-------|-----------|
| Q1 | Average Price by Zone | Bar height = avg price · Bar colour = avg area (m²) |
| Q2 | Price Trend by Build Year | Line = avg price · Dot radius = property count |
| Q3 | Price Distribution | Stacked histogram · Purple = old builds · Green = new builds |
| Q4 | Pool Proportion by Zone | 100% stacked bar · Blue = with pool · Gray = without |

- Animated transitions (cubic easing) on every filter interaction
- Contextual tooltips on all chart elements
- IQR outlier removal applied during data preprocessing

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| [D3.js](https://d3js.org/) | v7 | All charts and SVG rendering |
| [noUiSlider](https://refreshless.com/nouislider/) | 15.7.1 | Price range slider |
| HTML5 / CSS3 | — | Layout & dark glassmorphism theme |
| Python + `python-docx` | — | Report generation (`make_report.py`) |

---

## Getting Started

1. **Download the dataset** from [Kaggle](https://www.kaggle.com/datasets/mssmartypants/paris-housing-price-prediction/data) and place the CSV at:
   ```
   data/ParisHousing.csv
   ```

2. **Serve the project** from a local HTTP server (required for the CSV fetch):
   ```bash
   # Python
   python -m http.server 8080

   # Node.js
   npx serve .
   ```

3. Open `http://localhost:8080` in your browser.

> **Note:** Opening `index.html` directly as a `file://` URL will fail due to CORS restrictions on `d3.csv()`.

---

## Project Structure

```
.
├── index.html          # Dashboard entry point
├── css/
│   └── styles.css      # Dark theme, glassmorphism cards
├── js/
│   └── main.js         # D3 charts, filters, and state management
├── data/
│   └── ParisHousing.csv  # Dataset (not included — download from Kaggle)
├── make_report.py      # Generates Relatorio_Paris_Housing.docx
└── report.html         # Static report view
```

---

## Generating the Report

```bash
pip install python-docx
python make_report.py
```

Outputs `Relatorio_Paris_Housing.docx` with section-by-section chart descriptions and figure placeholders.
