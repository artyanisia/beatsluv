# 🎵 BeatsLuv

An intelligent full-stack platform for AI-powered music generation, feedback analysis, and catalog management.

---

## 🚀 Tech Stack

* **Frontend:** React, Vite, Recharts, HTML5 Audio
* **Backend:** Python, FastAPI, Scikit-Learn
* **Database:** PostgreSQL (with SQLAlchemy)
* **AI & Media:** Stability AI API, server-side static storage

---

## ⚡ Key Features

* **AI Generation Pipeline:** Prompts trigger async synthesis via Stability AI. Resulting `.mp3`/`.wav` files are stored statically on the server while metadata and URLs are saved in PostgreSQL.
* **ML Rating Estimator:** Scikit-Learn Random Forest regression model predicts commercial rating based on technical track parameters before generation.
* **Smart Recommendations:** Suggests optimal Genre + Mood combinations based on historical user feedback ratings.
* **Interactive Dashboard:** Aggregated metrics (tempo averages, genre distribution) rendered in real-time with Recharts.
* **5-Axis Feedback:** Granular reviews evaluating melody, originality, emotional impact, commercial viability, and production quality.
* **Public Library & Playlists:** SQL-injection-safe catalog search with dynamic filters; M:N playlist relations with composite keys preventing duplicate entries.
* **Admin Back-Office:** Role-based (JWT) CRUD dashboard to moderate tracks, manage users, and curate collections.

---

## 🛠️ Quick Start

### 1. Clone & Setup Backend
```bash
git clone [https://github.com/your-username/beatsluv.git](https://github.com/your-username/beatsluv.git)
cd beatsluv/backend

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
Create .env in backend/:

Code snippet
DATABASE_URL=postgresql://postgres:password@localhost:5432/beatsluv_db
SECRET_KEY=your_jwt_secret
STABILITY_API_KEY=your_stability_key
Run server:

Bash
uvicorn main:app --reload --port 8000
2. Setup Frontend
Bash
cd ../frontend
npm install
npm run dev
App runs at http://localhost:5173 (API proxied to http://localhost:8000).
