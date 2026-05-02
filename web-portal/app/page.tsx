"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const Icon = ({ children, size = 24, color = "currentColor", className = "" }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const IconLock = (props: any) => <Icon {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>;
const IconShield = (props: any) => <Icon {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>;
const IconUser = (props: any) => <Icon {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const IconCreditCard = (props: any) => <Icon {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" x2="23" y1="10" y2="10" /></Icon>;
const IconGlobe = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Icon>;
const IconZap = (props: any) => <Icon {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>;
const IconLibrary = (props: any) => <Icon {...props}><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></Icon>;

const IconBank = (props: any) => <Icon {...props}><path d="M3 21h18" /><path d="M3 10h18" /><path d="M5 6l7-3 7 3" /><path d="M4 10v11" /><path d="M20 10v11" /><path d="M8 14v3" /><path d="M12 14v3" /><path d="M16 14v3" /></Icon>;
const IconAdvisor = (props: any) => <Icon {...props}><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></Icon>;
const IconTransfer = (props: any) => <Icon {...props}><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></Icon>;
const IconBulk = (props: any) => <Icon {...props}><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></Icon>;
const IconEye = (props: any) => <Icon {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>;
const IconEyeOff = (props: any) => <Icon {...props}><path d="M9.88 9.88 2 2" /><path d="M17.36 17.36 22 22" /><path d="M2 12s3-7 10-7a9.46 9.46 0 0 1 5.4 1.76" /><path d="M21.21 15.89A10.11 10.11 0 0 1 12 19c-7 0-10-7-10-7a9.27 9.27 0 0 1 2.11-2.61" /><path d="M9.17 9.17a3 3 0 1 0 4.24 4.24" /></Icon>;
const IconAlert = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></Icon>;
const IconCheck = (props: any) => <Icon {...props}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconLoader = (props: any) => <Icon {...props} className="animate-spin"><path d="M21 12a9 9 0 1 1-6.21-8.58" /></Icon>;

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
        padding: "var(--space-2xl)",
        color: "white",
      }} className="login-brand-panel">
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #facc15, #f59e0b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "var(--space-lg)",
            boxShadow: "0 8px 24px rgba(250,204,21,0.35)"
          }}>
            <IconBank size={32} color="white" />
          </div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0 0 var(--space-xs)", lineHeight: 1.1 }}>
            IB AI Advisor
          </h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.75, margin: 0, fontWeight: 300 }}>
            Intelligent Internet Banking for Zimbabwe
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {[
            { icon: <IconTransfer size={20} color="white" />, title: "Dual-Currency", desc: "Manage ZiG & USD accounts seamlessly" },
            { icon: <IconAdvisor size={20} color="white" />, title: "AI-Powered Insights", desc: "Personalized financial recommendations" },
            { icon: <IconBulk size={20} color="white" />, title: "Bulk Payments", desc: "Process payroll & supplier batches instantly" },
            { icon: <IconShield size={20} color="white" />, title: "Bank-Grade Security", desc: "2FA & encrypted session management" },
          ].map(f => (
            <div key={f.title} style={{ display: "flex", gap: "var(--space-md)", alignItems: "flex-start" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "var(--radius-sm)",
                background: "rgba(255,255,255,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{f.title}</div>
                <div style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: "var(--space-2xs)" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: "var(--space-xl)", opacity: 0.4, fontSize: "0.75rem" }}>
          © 2026 IB AI Advisor · Licensed by RBZ · FSC Regulated
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        width: "460px",
        background: "var(--card-bg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "var(--space-2xl)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.3)",
      }} className="login-form-panel">
        {/* Tab switcher */}
        <div style={{
          display: "flex", background: "var(--bg-color)", borderRadius: "var(--radius-md)",
          padding: "var(--space-2xs)", marginBottom: "var(--space-xl)",
        }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "var(--space-sm)", border: "none", cursor: "pointer",
                borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: "0.9rem", transition: "all 0.2s",
                background: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "white" : "var(--text-muted)",
              }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <h2 style={{ margin: "0 0 var(--space-xs)", color: "var(--text-main)", fontSize: "1.5rem", fontWeight: 800 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p style={{ margin: "0 0 var(--space-lg)", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {mode === "login" ? "Sign in to your banking portal" : "Open your digital banking account"}
        </p>

        {error && (
          <div style={{
            padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-md)",
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--error)", color: "var(--error)",
            fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-xs)"
          }}>
            <IconAlert size={16} color="var(--error)" /> {error}
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>

          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>Full Name</label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Tendai Moyo" required={mode === "register"}
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>Mobile Number</label>
            <input
              type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)}
              placeholder="e.g. 0772123456" required
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={e => Object.assign(e.target.style, inputStyle)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
              {mode === "login" ? "PIN" : "Create PIN"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={pinVisible ? "text" : "password"}
                value={pin} onChange={e => setPin(e.target.value)}
                placeholder={mode === "login" ? "Enter your PIN" : "Min. 4 digits"} required
                maxLength={6}
                style={{ ...inputStyle, paddingRight: "var(--space-xl)" }}
                onFocus={e => Object.assign(e.target.style, { ...inputFocusStyle, paddingRight: "var(--space-xl)" })}
                onBlur={e => Object.assign(e.target.style, { ...inputStyle, paddingRight: "var(--space-xl)" })}
              />
              <button type="button" onClick={() => setPinVisible(v => !v)}
                style={{
                  position: "absolute", right: "var(--space-sm)", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem",
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                {pinVisible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>Confirm PIN</label>
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
            padding: "var(--space-md)", background: loading ? "var(--text-muted)" : "var(--primary)",
            color: "white", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700,
            fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s", marginTop: "var(--space-xs)",
            boxShadow: loading ? "none" : "var(--shadow)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"var(--space-sm)"
          }}>
            {loading ? <><IconLoader size={20} color="white" /> Authenticating...</> : mode === "login" ? <><IconLock size={20} color="white" /> Sign In Securely</> : <><IconCheck size={20} color="white" /> Create Account</>}
          </button>
        </form>

        {mode === "login" && (
          <div style={{ marginTop: "var(--space-lg)", textAlign: "center" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, display:"flex", alignItems:"center", justifyContent:"center", gap:"var(--space-xs)" }}>
              <IconShield size={14} color="var(--text-muted)" /> 256-bit SSL encrypted · Session timeout: 15 min
            </p>
          </div>
        )}

        <div style={{
          marginTop: "var(--space-xl)", padding: "var(--space-md)", background: "var(--bg-color)",
          borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.78rem", color: "var(--text-muted)"
        }}>
          <strong style={{ color: "var(--primary)" }}>Demo Credentials:</strong><br />
          Mobile: <code style={{ background: "var(--border-color)", padding: "0.1rem 0.3rem", borderRadius: "3px", color: "var(--text-main)" }}>0772123456</code> · PIN: <code style={{ background: "var(--border-color)", padding: "0.1rem 0.3rem", borderRadius: "3px", color: "var(--text-main)" }}>1234</code>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "var(--space-sm) var(--space-md)",
  border: "1.5px solid var(--border-color)", borderRadius: "var(--radius-sm)",
  fontSize: "0.95rem", boxSizing: "border-box",
  background: "var(--bg-color)", color: "var(--text-main)", outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "var(--primary)",
  boxShadow: "0 0 0 3px rgba(10,31,68,0.12)",
};
