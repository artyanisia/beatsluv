import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthForm from "./AuthForm";
import Dashboard from "./Dashboard";
import AdminPage from "./Admin";
import TrackLibrary from "./TrackLibrary";
import Generation from "./Generation";
import UserProfile from "./UserProfile";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Icon({ name }) {
  const icons = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    library: (
      <>
        <path d="M4 19.5V8a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v11.5" />
        <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
      </>
    ),
    admin: (
      <>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="m19.4 15 .6 2.1-2 3.5-2.2-.6a8.5 8.5 0 0 1-1.8 1.1l-.6 2.1h-4l-.6-2.1A8.5 8.5 0 0 1 7 20l-2.2.6-2-3.5.6-2.1a8.7 8.7 0 0 1 0-2L2.8 11l2-3.5 2.2.6A8.5 8.5 0 0 1 8.8 7l.6-2.1h4L14 7a8.5 8.5 0 0 1 1.8 1.1l2.2-.6 2 3.5-.6 2.1a8.7 8.7 0 0 1 0 1.9Z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M3 12A9 9 0 0 1 18.5 5.8" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="svg-icon">
      {icons[name]}
    </svg>
  );
}

function buildAudioUrl(audioUrl) {
  if (!audioUrl) {
    return "";
  }

  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }

  return `${API_BASE_URL}${audioUrl}`;
}

function AppContent() {
  const { user, logout, getAuthHeaders, loading } = useAuth();
  const isAdmin = user?.role === "ADMIN" && user?.email === "admin@gmail.com";

  const [currentView, setCurrentView] = useState("dashboard");

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Loading BeatsLuv...</div>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }


  const getPageTitle = () => {
    switch (currentView) {
      case "dashboard":
        return "Dashboard";
      case "generation":
        return "Generate Music";
      case "library":
        return "Track Library";
      case "profile":
        return "User Profile";
      case "admin":
        return "Admin Management";
      default:
        return "BeatsLuv";
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">B</div>
          <span className="brand-text">BeatsLuv</span>
        </div>
        <hr className="sidebar-divider" />

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${currentView === "dashboard" ? "active" : ""}`}
            onClick={() => setCurrentView("dashboard")}
          >
            <span className="nav-icon-box">
              <Icon name="dashboard" />
            </span>
            <span className="nav-text">Dashboard</span>
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "generation" ? "active" : ""}`}
            onClick={() => setCurrentView("generation")}
          >
            <span className="nav-icon-box">
              <Icon name="music" />
            </span>
            <span className="nav-text">Generate Music</span>
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "library" ? "active" : ""}`}
            onClick={() => setCurrentView("library")}
          >
            <span className="nav-icon-box">
              <Icon name="library" />
            </span>
            <span className="nav-text">Track Library</span>
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "profile" ? "active" : ""}`}
            onClick={() => setCurrentView("profile")}
          >
            <span className="nav-icon-box">
              <Icon name="user" />
            </span>
            <span className="nav-text">Profile</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              className={`nav-item ${currentView === "admin" ? "active" : ""}`}
              onClick={() => setCurrentView("admin")}
            >
              <span className="nav-icon-box">
                <Icon name="admin" />
              </span>
              <span className="nav-text">Admin</span>
            </button>
          )}

          <div className="nav-section-title">Account</div>
          <button type="button" className="nav-item logout-item" onClick={logout}>
            <span className="nav-icon-box">
              <Icon name="logout" />
            </span>
            <span className="nav-text">Sign Out</span>
          </button>
        </nav>
      </aside>

      <div className="main-content">
        <header className="main-header">
          <div className="header-left">
            <div className="breadcrumb">
              <span>Pages</span> / {getPageTitle()}
            </div>
            <h1 className="header-title">{getPageTitle()}</h1>
          </div>

          <div className="header-right">
            <button type="button" className="header-user-action" onClick={logout}>
              <Icon name="user" />
              <span>{user.email}</span>
            </button>
          </div>
        </header>

        <main className="content">
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "generation" && <Generation />}
          {currentView === "library" && <TrackLibrary />}
          {currentView === "profile" && <UserProfile />}
          {currentView === "admin" && <AdminPage />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error("Failed to render app:", error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;"><h2>Error loading BeatsLuv</h2><p>${error.message}</p><p>Check browser console for more details</p></div>`;
}
