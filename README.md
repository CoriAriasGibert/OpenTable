# 🍽️ Restaurant Locator

A modern, map‑based restaurant discovery tool powered by **Algolia** search and **Leaflet** maps. Find your next favorite spot with real‑time geo‑search, faceted filters, and a sleek, mobile‑first interface.

🔗 **Live Demo**: [CoriAriasGibert.github.io/OpenTable](https://CoriAriasGibert.github.io/OpenTable)

---

## ✨ Features

- **📍 Geo‑Search & Interactive Map** – Move the map to discover restaurants in the visible area; markers update in real time.
- **🔍 Text Search** – Search by name, cuisine, or city with Algolia’s InstantSearch.
- **🎯 Strict AND Filters** – Combine cuisine, price, and dining style filters with precise `AND` logic for exact matches.
- **📱 Mobile‑First Design** – Glass‑morphism UI with a smooth blue‑to‑violet gradient, inspired by Alan’s clean aesthetic.
- **🔄 Map‑List Synchronization** – Click a card to fly to its marker; move the map to refresh results.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Search Engine** | [Algolia](https://www.algolia.com) (InstantSearch.js) |
| **Mapping** | [Leaflet](https://leafletjs.com) + [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 |
| **Data Processing** | Python (pandas, JSON) |
| **Hosting** | GitHub Pages |

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/CoriAriasGibert/OpenTable.git
cd OpenTable
```

### 2. Run locally
```bash
python3 -m http.server
```
Then open `http://localhost:8000` in your browser.

### 3. (Optional) Re‑index data
If you need to rebuild the Algolia index with updated data, run the Python scripts:

```bash
python process_data.py       # Merge CSV & JSON into a single enriched index
python update_images.py      # Fetch real images from OpenTable pages
python extract_images.py     # Extract and validate image URLs
```

---

## 📂 Project Structure

```
OpenTable/
├── index.html              # Main HTML page
├── index.css               # Modern glass‑morphism styles
├── index.js                # Core application logic (InstantSearch + Leaflet)
├── process_data.py         # Data merging & enrichment (CSV + JSON → JSON)
├── update_images.py        # Image scraping from OpenTable
├── extract_images.py       # Image validation & fallback assignment
├── dataset/                # Raw data sources (CSV, JSON)
├── resources/              # Additional assets
└── restaurants_with_real_images_final.json  # Final indexed dataset
```

---

## 🧠 How It Works

### Data Pipeline (Python)
- Merged CSV and JSON sources into a single structured index.
- Scraped real restaurant images; applied a fallback placeholder where missing.

### Frontend (JavaScript)
- **InstantSearch.js** handles search box, faceted filters, and pagination.
- **Leaflet** renders the map with marker clustering for performance.
- **Map movement** triggers a new geo‑search, updating both markers and the result list.
- **Text search** overrides geo‑filters and zooms to the result set.

### Design Philosophy
- Clean, professional, and mobile‑first.
- Glass‑morphism effects for depth without clutter.
- Responsive layout that works seamlessly on any device.


---

## 🙏 Acknowledgements

- Built with ❤️ using [Algolia](https://www.algolia.com) and [Leaflet](https://leafletjs.com).

**Happy discovering!** 🍽️🗺️
