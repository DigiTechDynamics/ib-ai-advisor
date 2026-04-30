"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mobileNumber, setMobileNumber] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: mobileNumber, pin }),
      });
      if (!res.ok) throw new Error("Invalid credentials. Please try again.");
      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("name", data.name);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? (err.message === "Failed to fetch" ? "Backend Unreachable. Please ensure the API is running." : err.message) : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    if (pin.length < 4) { setError("PIN must be at least 4 digits."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: mobileNumber, pin }),
      });
      if (!res.ok) throw new Error("Registration failed. Please try again.");
      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("name", fullName || data.name);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? (err.message === "Failed to fetch" ? "Backend Unreachable. Please ensure the API is running." : err.message) : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "linear-gradient(135deg, #0a1f44 0%, #1e3a8a 50%, #0f172a 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Left branding panel */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "4rem",
        color: "white",
      }} className="login-brand-panel">
        <div style={{ marginBottom: "3rem" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "linear-gradient(135deg, #facc15, #f59e0b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.75rem", marginBottom: "1.5rem",
            boxShadow: "0 8px 24px rgba(250,204,21,0.35)"
          }}>🏦</div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0 0 0.5rem", lineHeight: 1.1 }}>
            IB AI Advisor
          </h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.75, margin: 0, fontWeight: 300 }}>
            Intelligent Internet Banking for Zimbabwe
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {[
            { icon: "⇄", title: "Dual-Currency", desc: "Manage ZiG & USD accounts seamlessly" },
            { icon: "🤖", title: "AI-Powered Insights", desc: "Personalized financial recommendations" },
            { icon: "💼", title: "Bulk Payments", desc: "Process payroll & supplier batches instantly" },
            { icon: "🔐", title: "Bank-Grade Security", desc: "2FA & encrypted session management" },
          ].map(f => (
            <div key={f.title} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "10px",
                background: "rgba(255,255,255,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{f.title}</div>
                <div style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: "0.1rem" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: "3rem", opacity: 0.4, fontSize: "0.75rem" }}>
          © 2026 IB AI Advisor · Licensed by RBZ · FSC Regulated
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        width: "460px",
        background: "rgba(255,255,255,0.97)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "3rem",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.3)",
      }} className="login-form-panel">
        {/* Tab switcher */}
        <div style={{
          display: "flex", background: "#f3f4f6", borderRadius: "10px",
          padding: "4px", marginBottom: "2rem",
        }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "0.6rem", border: "none", cursor: "pointer",
                borderRadius: "8px", fontWeight: 700, fontSize: "0.9rem", transition: "all 0.2s",
                background: mode === m ? "#0a1f44" : "transparent",
                color: mode === m ? "white" : "#6b7280",
              }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <h2 style={{ margin: "0 0 0.35rem", color: "#0a1f44", fontSize: "1.5rem", fontWeight: 800 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p style={{ margin: "0 0 1.75rem", color: "#6b7280", fontSize: "0.9rem" }}>
          {mode === "login" ? "Sign in to your banking portal" : "Open your digital banking account"}
        </p>

        {error && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1.25rem",
            background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c",
            fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem"
          }}>⚠️ {error}</div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Full Name</label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Tendai Moyo" required={mode === "register"}
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Mobile Number</label>
            <input
              type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)}
              placeholder="e.g. 0772123456" required
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={e => Object.assign(e.target.style, inputStyle)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
              {mode === "login" ? "PIN" : "Create PIN"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={pinVisible ? "text" : "password"}
                value={pin} onChange={e => setPin(e.target.value)}
                placeholder={mode === "login" ? "Enter your PIN" : "Min. 4 digits"} required
                maxLength={6}
                style={{ ...inputStyle, paddingRight: "3rem" }}
                onFocus={e => Object.assign(e.target.style, { ...inputFocusStyle, paddingRight: "3rem" })}
                onBlur={e => Object.assign(e.target.style, { ...inputStyle, paddingRight: "3rem" })}
              />
              <button type="button" onClick={() => setPinVisible(v => !v)}
                style={{
                  position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "1rem"
                }}>
                {pinVisible ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Confirm PIN</label>
              <input
                type={pinVisible ? "text" : "password"}
                value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
                placeholder="Re-enter your PIN" required maxLength={6}
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
              />
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: "0.85rem", background: loading ? "#6b7280" : "linear-gradient(135deg, #0a1f44, #1e3a8a)",
            color: "white", border: "none", borderRadius: "10px", fontWeight: 700,
            fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s", marginTop: "0.5rem",
            boxShadow: loading ? "none" : "0 4px 15px rgba(10,31,68,0.35)"
          }}>
            {loading ? "⏳ Authenticating..." : mode === "login" ? "🔐 Sign In Securely" : "✅ Create Account"}
          </button>
        </form>

        {mode === "login" && (
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
              🔒 256-bit SSL encrypted · Session timeout: 15 min
            </p>
          </div>
        )}

        <div style={{
          marginTop: "2rem", padding: "1rem", background: "#f8fafc",
          borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "0.78rem", color: "#6b7280"
        }}>
          <strong style={{ color: "#0a1f44" }}>Demo Credentials:</strong><br />
          Mobile: <code style={{ background: "#e5e7eb", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>0772123456</code> · PIN: <code style={{ background: "#e5e7eb", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>1234</code>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.7rem 0.9rem",
  border: "1.5px solid #d1d5db", borderRadius: "8px",
  fontSize: "0.95rem", boxSizing: "border-box",
  background: "white", color: "#1f2937", outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#0a1f44",
  boxShadow: "0 0 0 3px rgba(10,31,68,0.12)",
};
