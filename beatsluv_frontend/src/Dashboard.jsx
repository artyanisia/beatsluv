import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import showcaseImage from "./assets/vision-showcase.png";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";
const COLORS = ["#0075ff", "#01b574", "#00bcff", "#7551ff", "#ffb547", "#e31a5f", "#38bdf8"];

const ENDPOINTS = {
  overview: "/analytics/overview",
  genres: "/analytics/genre-distribution",
  moods: "/analytics/mood-analysis",
  tempos: "/analytics/tempo-distribution",
  durations: "/analytics/duration-analysis",
  ratings: "/analytics/rating-analysis",
  trends: "/analytics/trends-over-time",
  users: "/analytics/user-preferences",
  keys: "/analytics/key-distribution",
  aiPerformance: "/analytics/ai-performance",
  monthly: "/analytics/monthly-evolution",
};

const CHART_VIEWS = [
  { value: "genres", label: "Analiza genuri" },
  { value: "ratings", label: "Analiza evaluari" },
  { value: "trends", label: "Tendinte temporale" },
  { value: "technical", label: "Date Tehnice" },
  { value: "users", label: "Analiza utilizatori" },
];

const chartAxis = {
  tick: { fill: "#a0aec0", fontSize: 12 },
  axisLine: false,
  tickLine: false,
};

const tooltipStyle = {
  background: "rgba(6, 11, 40, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "14px",
  color: "#ffffff",
};

function roText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const translations = {
    "Analiza generarii muzicale": "Analiza generarii muzicale",
    "Urmarire feedback": "Urmarire feedback",
    "Performanta AI": "Performanta AI",
    "Distributia tempo-ului": "Distributia tempo-ului",
    "Distributia duratelor": "Distributia duratelor",
    "Frecventa tonalitatilor": "Frecventa tonalitatilor",
    "Temperatura AI vs rating": "Temperatura AI vs rating",
    "Piese create in timp": "Piese create in timp",
    "Evolutie lunara": "Evolutie lunara",
    "Distributia ratingurilor": "Distributia ratingurilor",
    "Rating mediu dupa gen": "Rating mediu dupa gen",
    "Utilizatori activi": "Utilizatori activi",
    "Interactiunea utilizatorilor": "Interactiunea utilizatorilor",
    "Nu exista inca date despre performanta AI.": "Nu exista inca date despre performanta AI.",
    "Nu exista date recente despre tendinte.": "Nu exista date recente despre tendinte.",
    "Nu exista date lunare inca.": "Nu exista date lunare inca.",
    "Nu exista ratinguri inca.": "Nu exista ratinguri inca.",
    "Nu exista genuri evaluate inca.": "Nu exista genuri evaluate inca.",
    "Nu exista date despre activitatea utilizatorilor.": "Nu exista date despre activitatea utilizatorilor.",
  };

  return translations[value] || value;
}

function DashboardIcon({ name }) {
  const icons = {
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    sales: (
      <>
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    star: (
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.86 1.18 6.87L12 17.77 5.82 21 7 14.13l-5-4.86 6.91-1.01L12 2Z" />
    ),
    more: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="svg-icon">
      {icons[name]}
    </svg>
  );
}

function EmptyState({ children }) {
  return <p className="empty-state">{roText(children)}</p>;
}

function VisionStatCard({ label, value, icon, change, isPositive = true }) {
  return (
    <div className="stat-card metric-card">
      <div>
        <p className="stat-card-title">{roText(label)}</p>
        <div className="stat-card-value">{value}</div>
        <p className={`stat-card-change ${isPositive ? "positive" : "negative"}`}>{roText(change)}</p>
      </div>
      <div className="stat-card-icon">
        <DashboardIcon name={icon} />
      </div>
    </div>
  );
}

function ProgressRing({ value, max = 100, label, color = "blue", center }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(value / max, 1));
  const dash = `${progress * circumference} ${circumference}`;

  return (
    <div className="progress-ring-block">
      <div className="progress-ring">
        <svg width="136" height="136" viewBox="0 0 136 136">
          <circle className="progress-ring-bg" cx="68" cy="68" r={radius} fill="none" />
          <circle
            className={`progress-ring-circle ${color}`}
            cx="68"
            cy="68"
            r={radius}
            fill="none"
            strokeDasharray={dash}
            transform="rotate(-90 68 68)"
          />
        </svg>
        <div className={`progress-value ${color}`}>{center}</div>
      </div>
      <div className="progress-label">{roText(label)}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3>{roText(title)}</h3>
      {children}
    </div>
  );
}

const Dashboard = () => {
  const { getAuthHeaders, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChart, setSelectedChart] = useState("genres");
  const [data, setData] = useState({
    overview: null,
    genres: [],
    moods: [],
    tempos: [],
    durations: [],
    ratings: { rating_distribution: [], genre_ratings: [] },
    trends: { daily_tracks: [], genre_trends: [] },
    users: { active_users: [], engagement: {} },
    keys: [],
    aiPerformance: [],
    monthly: [],
  });
  const [predictionForm, setPredictionForm] = useState({
    genre: "rock",
    mood: "energetic",
    key_signature: "C major",
    tempo: 120,
    duration_seconds: 180,
    ai_temperature: 0.7,
  });
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState("");

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  async function fetchAnalytics(key, path, headers) {
    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || `Nu s-au putut incarca datele pentru ${key}`);
    }
    return [key, payload];
  }

  async function loadAllAnalytics() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      const results = await Promise.all(
        Object.entries(ENDPOINTS).map(([key, path]) => fetchAnalytics(key, path, headers)),
      );

      setData((current) => ({
        ...current,
        ...Object.fromEntries(results),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePredictionSubmit(event) {
    event.preventDefault();
    setPredictionError("");
    setPrediction(null);

    try {
      const response = await fetch(`${API_BASE_URL}/predictions/popularity`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...predictionForm,
          tempo: Number(predictionForm.tempo),
          duration_seconds: Number(predictionForm.duration_seconds),
          ai_temperature: Number(predictionForm.ai_temperature),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "Predictia a esuat");
      }
      setPrediction(payload);
    } catch (err) {
      setPredictionError(err.message);
    }
  }

  function updatePredictionField(field, value) {
    setPredictionForm((current) => ({ ...current, [field]: value }));
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Se incarca statisticile...</div>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container glass-card">
        <h2>Eroare la incarcarea dashboardului</h2>
        <p>{error}</p>
        <button type="button" onClick={loadAllAnalytics}>
          Reincearca
        </button>
      </div>
    );
  }

  const { overview, genres, moods, tempos, durations, ratings, trends, users, keys, aiPerformance, monthly } = data;
  const ratingPercent = Math.round(((overview?.avg_rating || 0) / 5) * 100);

  return (
    <div className="dashboard">
      {overview && (
        <div className="stats-grid">
          <VisionStatCard
            label="Utilizatori Total"
            value={overview.total_users.toLocaleString()}
            icon="users"
            change="Conturi inregistrate in platforma"
          />
          <VisionStatCard
            label="Feedback Total"
            value={overview.total_feedback.toLocaleString()}
            icon="sales"
            change="Evaluari salvate in baza de date"
          />
          <VisionStatCard
            label="Piese Totale"
            value={overview.total_tracks.toLocaleString()}
            icon="music"
            change={`${overview.playable_tracks.toLocaleString()} piese cu audio disponibil`}
          />
          <VisionStatCard
            label="Evaluare Medie"
            value={`${overview.avg_rating}/5`}
            icon="star"
            change="Calculata din feedbackul utilizatorilor"
          />
        </div>
      )}

      <div className="analytics-header">
        <div className="analytics-title">
          <p className="eyebrow">Bine ai revenit, {user?.email?.split('@')[0]?.charAt(0)?.toUpperCase() + user?.email?.split('@')[0]?.slice(1) || 'Utilizator'}</p>
          <h1>Analiza generarii muzicale</h1>
          <p>Informatii bazate pe datele salvate in platforma. Exploreaza rezultatele prin grafice interactive.</p>
        </div>
      </div>

      <div className="analytics-metrics">
        <div className="card compact-card horizontal-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Urmarire feedback</h3>
              <p className="card-subtitle">Situatia evaluarilor in timp real</p>
            </div>
            <button type="button" className="icon-button" aria-label="Mai multe optiuni">
              <DashboardIcon name="more" />
            </button>
          </div>
          <div className="card-content">
            <div className="stacked-metrics">
              <div>
                <span>Feedback Total</span>
                <strong>{overview?.total_feedback || 0} recenzii</strong>
              </div>
              <div>
                <span>Scor Mediu</span>
                <strong>{overview?.avg_rating || 0}/5</strong>
              </div>
            </div>
            <ProgressRing value={ratingPercent} label="Bazat pe evaluarile utilizatorilor" center={`${ratingPercent}%`} />
          </div>
        </div>

        <div className="card compact-card horizontal-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Performanta AI</h3>
              <p className="card-subtitle">Scorul calitatii modelului</p>
            </div>
          </div>
          <div className="card-content">
            <ProgressRing value={93} label="Scor Total" center="9.3" color="green" />
          </div>
        </div>
      </div>

      <div className="analytics-controls">
        <div className="chart-selector">
          <p className="chart-selector-label">Selecteaza vizualizarea graficelor:</p>
          <div className="chart-tab-bar" role="tablist" aria-label="Vizualizarea graficelor">
            {CHART_VIEWS.map((view) => (
              <button
                key={view.value}
                type="button"
                role="tab"
                aria-selected={selectedChart === view.value}
                className={`chart-tab-button ${selectedChart === view.value ? "active" : ""}`}
                onClick={() => setSelectedChart(view.value)}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Render charts based on selected view */}
      <div className="charts-grid">
        {selectedChart === "genres" && (
          <>
            <ChartCard title="Piese dupa gen">
              {genres.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={genres} dataKey="count" nameKey="genre" outerRadius={102} label>
                      {genres.map((entry, index) => (
                        <Cell key={entry.genre} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista date despre genuri.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Piese dupa sentiment">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={moods}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="mood" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#0075ff" name="Piese" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tempo mediu dupa gen">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={genres}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="genre" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="avg_tempo" fill="#ffb547" name="BPM Mediu" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {selectedChart === "technical" && (
          <>
            <ChartCard title="Distributia tempo-ului">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tempos}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="tempo_range" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#00bcff" name="Piese" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distributia duratelor">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={durations}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="duration_range" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#7551ff" name="Piese" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Frecventa tonalitatilor">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={keys}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="key_signature" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#01b574" name="Piese" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Temperatura AI vs rating">
              {aiPerformance.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aiPerformance}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="temperature_range" {...chartAxis} />
                    <YAxis domain={[0, 5]} {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="avg_rating" fill="#e31a5f" name="Rating mediu" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista inca date despre performanta AI.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "trends" && (
          <>
            <ChartCard title="Piese create in timp">
              {trends.daily_tracks.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends.daily_tracks}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="date" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="#0075ff" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista date recente despre tendinte.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Evolutie lunara">
              {monthly.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthly}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="month" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="generated_count" stroke="#0075ff" strokeWidth={3} name="Generari" dot={false} />
                    <Line type="monotone" dataKey="feedback_count" stroke="#01b574" strokeWidth={3} name="Feedback" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista date lunare inca.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "ratings" && (
          <>
            <ChartCard title="Distributia ratingurilor">
              {ratings.rating_distribution.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratings.rating_distribution}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="rating" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#01b574" name="Feedback" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista ratinguri inca.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Rating mediu dupa gen">
              {ratings.genre_ratings.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratings.genre_ratings}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="genre" {...chartAxis} />
                    <YAxis domain={[0, 5]} {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="avg_rating" fill="#7551ff" name="Rating mediu" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista genuri evaluate inca.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "users" && (
          <>
            <ChartCard title="Utilizatori activi">
              {users.active_users.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={users.active_users.slice(0, 10)}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="user_id" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="tracks_created" fill="#38bdf8" name="Piese create" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>Nu exista date despre activitatea utilizatorilor.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Interactiunea utilizatorilor">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { metric: "Ascultari medii", value: users.engagement.avg_ascultari || 0 },
                  { metric: "Rata aprecieri", value: users.engagement.like_percentage || 0 },
                  { metric: "Rata descarcari", value: users.engagement.download_percentage || 0 },
                ]}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="metric" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#7551ff" name="Valoare" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </div>


      <div className="dashboard-footer">
        <button type="button" onClick={loadAllAnalytics} disabled={loading}>
          {loading ? "Se actualizeaza..." : "Actualizeaza datele"}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;

