"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Account {
  id: number;
  account_number: string;
  balance: number;
  currency: string;
  account_type: string;
}

interface AIInsight {
  type: string;
  title: string;
  recommendation: string;
  explanation: string;
  confidence: number;
  risks: string;
}

interface Transaction {
  id: number;
  amount: number;
  currency: string;
  transaction_type: string;
  description: string;
  ai_category: string;
  timestamp: string;
}

interface Beneficiary {
  id: number;
  name: string;
  account_number: string;
  bank_name: string;
}

interface SpendingCategory {
  name: string;
  amount: number;
}

interface SpendingInsights {
  categories: SpendingCategory[];
  total_spending: number;
}

const CATEGORY_COLORS = ["#0a1f44","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Toast { id: number; message: string; type: "success" | "error" | "info"; }
interface Receipt { title: string; lines: {label: string; value: string}[]; }

interface MarketItem { symbol: string; name: string; price: number; change: number; type: string; trend: string; yield?: string; }

interface FinancialGoal { name: string; target: number; current: number; percent?: number; }

interface UserProfile { id: number; name: string; risk_tolerance: string; monthly_income_target: number; financial_goals: FinancialGoal[]; }

interface ComprehensiveAdvice {
  spending_analysis: {
    total_spent: number;
    this_month_spent: number;
    spending_trend: string;
    top_categories: [string, number][];
    anomalies: string[];
  };
  budgeting: {
    savings_rate: string;
    strategy: string;
    advice: string;
  };
  investments: { name: string; yield: string; risk: string; description: string; }[];
  market: MarketItem[];
  goals: FinancialGoal[];
  risk_profile: string;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [name, setName] = useState("");
  const [activeTab, setActiveTab] = useState("Home");
  const [spendingInsights, setSpendingInsights] = useState<SpendingInsights | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();

  // Enhanced AI Advisor State
  const [comprehensiveAdvice, setComprehensiveAdvice] = useState<ComprehensiveAdvice | null>(null);
  const [aiMarketExplanation, setAiMarketExplanation] = useState<string>("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [simulationResults, setSimulationResults] = useState<any>(null);
  const [advisorSubTab, setAdvisorSubTab] = useState("Insights"); // Insights, Simulation, Market, Profile

  // Simulation Form State
  const [simSavings, setSimSavings] = useState("500");
  const [simInvestment, setSimInvestment] = useState("2000");
  const [simYears, setSimYears] = useState("5");
  const [simReturn, setSimReturn] = useState("0.15");

  // Transfer Form State
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destAccount, setDestAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transferMsg, setTransferMsg] = useState("");
  const [expandedNav, setExpandedNav] = useState<string | null>("Transfer");

  // Beneficiary State
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [benName, setBenName] = useState("");
  const [benAccount, setBenAccount] = useState("");
  const [benBank, setBenBank] = useState("CABS");
  const [benMsg, setBenMsg] = useState("");

  // Airtime State
  const [airtimePhone, setAirtimePhone] = useState("");
  const [airtimeAmount, setAirtimeAmount] = useState("");
  const [airtimeMsg, setAirtimeMsg] = useState("");

  // Bill Payment State
  const [billerName, setBillerName] = useState("ZESA Prepaid");
  const [billReference, setBillReference] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billMsg, setBillMsg] = useState("");

  // Bulk Payment State
  interface BulkRow { id: number; destination: string; amount: string; description: string; }
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { id: 1, destination: "", amount: "", description: "" },
  ]);
  const [bulkSourceAccountId, setBulkSourceAccountId] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{destination: string; amount: number; status: string}[]>([]);
  const [bulkNextId, setBulkNextId] = useState(2);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [bulkHistoryFilter, setBulkHistoryFilter] = useState("");

  // CSV Upload handler
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").filter(l => l.trim());
      let nextId = bulkNextId;
      const newRows: BulkRow[] = lines.slice(1).map(line => {
        const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
        const row: BulkRow = { id: nextId++, destination: parts[0] || "", amount: parts[1] || "", description: parts[2] || "" };
        return row;
      }).filter(r => r.destination);
      if (newRows.length > 0) {
        setBulkRows(newRows);
        setBulkNextId(nextId);
        showToast(`✅ Loaded ${newRows.length} rows from CSV.`, "success");
      } else {
        showToast("❌ No valid rows found. Ensure CSV has columns: account_number,amount,description", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const fetchAccounts = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/accounts/summary?user_id=${userId}`);
      if (!res.ok) throw new Error("Backend server responded with an error.");
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0 && !sourceAccountId) {
        setSourceAccountId(data[0].id.toString());
      }
      setApiError(null);
      return data;
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setApiError("Backend Unreachable. Please ensure the API is running.");
      return [];
    }
  };

  const fetchInsights = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/insights?user_id=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setSpendingInsights(data);
    } catch (err) {
      console.error("Error fetching insights:", err);
    }
  };

  const fetchTransactions = async (accountId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/${accountId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const fetchBeneficiaries = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/beneficiaries?user_id=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBeneficiaries(data);
    } catch (err) {
      console.error("Error fetching beneficiaries:", err);
    }
  };

  const fetchAllData = useCallback(async (userId: string) => {
    try {
      const accs = await fetchAccounts(userId);
      if (accs.length > 0) {
        fetchTransactions(accs[0].id);
      }
      
      // Secondary fetches
      fetchBeneficiaries(userId);
      fetchInsights(userId);
      fetchComprehensiveAdvice(userId);
      fetchUserProfile(userId);
      fetchMarketAiInsight();
      
      // AI Recommendation
      fetch(`${API_BASE_URL}/api/ai/advisor?user_id=${userId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => data && setInsight(data))
        .catch(err => console.error("Error fetching AI insight:", err));
    } catch (err) {
      setApiError("Failed to connect to banking server.");
    }
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const userName = localStorage.getItem("name");
    
    if (!userId) {
      router.push("/");
      return;
    }
    setName(userName || "");
    fetchAllData(userId);
  }, [router, fetchAllData]);

  const fetchComprehensiveAdvice = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/advisor/comprehensive?user_id=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setComprehensiveAdvice(data);
    } catch (err) { console.error("Error fetching comprehensive advice:", err); }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/profile?user_id=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setUserProfile(data);
    } catch (err) { console.error("Error fetching user profile:", err); }
  };

  const fetchMarketAiInsight = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market/ai_insight`);
      if (!res.ok) return;
      const data = await res.json();
      setAiMarketExplanation(data.explanation);
    } catch (err) { console.error("Error fetching market insight:", err); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userProfile.id,
          risk_tolerance: userProfile.risk_tolerance,
          monthly_income_target: userProfile.monthly_income_target,
          financial_goals: userProfile.financial_goals
        })
      });
      if (res.ok) {
        showToast("Profile updated successfully!", "success");
        fetchComprehensiveAdvice(userProfile.id.toString());
      }
    } catch (err) { showToast("Failed to update profile", "error"); }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/advisor/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_savings: parseFloat(simSavings),
          investment_amount: parseFloat(simInvestment),
          horizon_years: parseInt(simYears),
          expected_return: parseFloat(simReturn)
        })
      });
      const data = await res.json();
      setSimulationResults(data);
      showToast("Simulation completed!", "success");
    } catch (err) { showToast("Simulation failed", "error"); }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_account_id: parseInt(sourceAccountId),
          amount: parseFloat(amount),
          destination_account_number: destAccount,
          description: description
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Transfer successful! IMTT Charged: ${data.imtt_charged}`, "success");
        showReceipt("Transfer Receipt", [
          {label: "Amount", value: `${accounts.find(a => a.id.toString() === sourceAccountId)?.currency === "USD" ? "$" : "ZWG "}${parseFloat(amount).toFixed(2)}`},
          {label: "Destination", value: destAccount},
          {label: "Reference", value: description},
          {label: "IMTT Tax", value: `ZWG ${data.imtt_charged.toFixed(2)}`}
        ]);
        setAmount("");
        setDestAccount("");
        setDescription("");
        const userId = localStorage.getItem("user_id");
        if (userId) fetchAccounts(userId);
        fetchTransactions(parseInt(sourceAccountId));
      } else {
        showToast(`Error: ${data.detail}`, "error");
      }
    } catch (err) {
      showToast("Transfer failed due to network error.", "error");
    }
  };

  const handleSimulateScan = () => {
    setDestAccount("USD123456"); 
    setAmount("50.00");
    setDescription("TM Pick n Pay Groceries");
    setActiveTab("Transfer");
    setTransferMsg("QR Code Scanned! Form populated.");
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setBenMsg("");
    const userId = localStorage.getItem("user_id");
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/beneficiaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId),
          name: benName,
          account_number: benAccount,
          bank_name: benBank
        })
      });
      if (res.ok) {
        setBenMsg("Beneficiary added successfully!");
        setBenName("");
        setBenAccount("");
        setBenBank("CABS");
        fetchBeneficiaries(userId);
      } else {
        setBenMsg("Error adding beneficiary.");
      }
    } catch (err) {
      setBenMsg("Network error.");
    }
  };

  const handleBuyAirtime = async (e: React.FormEvent, network: string) => {
    e.preventDefault();
    setAirtimeMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/airtime/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: parseInt(sourceAccountId),
          network: network,
          phone_number: airtimePhone,
          amount: parseFloat(airtimeAmount)
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully purchased ${network} airtime!`, "success");
        showReceipt("Airtime Receipt", [
          {label: "Network", value: network},
          {label: "Phone", value: airtimePhone},
          {label: "Amount", value: `${accounts.find(a => a.id.toString() === sourceAccountId)?.currency === "USD" ? "$" : "ZWG "}${parseFloat(airtimeAmount).toFixed(2)}`}
        ]);
        setAirtimePhone("");
        setAirtimeAmount("");
        const userId = localStorage.getItem("user_id");
        if (userId) fetchAccounts(userId);
        fetchTransactions(parseInt(sourceAccountId));
      } else {
        showToast(`Error: ${data.detail}`, "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/bills/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: parseInt(sourceAccountId),
          biller_name: billerName,
          account_reference: billReference,
          amount: parseFloat(billAmount)
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully paid ${billerName}!`, "success");
        showReceipt("Bill Payment Receipt", [
          {label: "Biller", value: billerName},
          {label: "Reference", value: billReference},
          {label: "Amount", value: `${accounts.find(a => a.id.toString() === sourceAccountId)?.currency === "USD" ? "$" : "ZWG "}${parseFloat(billAmount).toFixed(2)}`}
        ]);
        setBillReference("");
        setBillAmount("");
        const userId = localStorage.getItem("user_id");
        if (userId) fetchAccounts(userId);
        fetchTransactions(parseInt(sourceAccountId));
      } else {
        showToast(`Error: ${data.detail}`, "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    }
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, { id: bulkNextId, destination: "", amount: "", description: "" }]);
    setBulkNextId(prev => prev + 1);
  };

  const removeBulkRow = (id: number) => {
    setBulkRows(prev => prev.filter(r => r.id !== id));
  };

  const updateBulkRow = (id: number, field: keyof { destination: string; amount: string; description: string }, value: string) => {
    setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const bulkTotal = bulkRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const bulkSourceAcc = accounts.find(a => a.id.toString() === (bulkSourceAccountId || accounts[0]?.id.toString()));
  const bulkImtt = bulkSourceAcc?.currency === "ZWG"
    ? bulkRows.reduce((sum, r) => { const a = parseFloat(r.amount) || 0; return sum + (a > 100 ? a * 0.02 : 0); }, 0)
    : 0;
  const bulkGrandTotal = bulkTotal + bulkImtt;

  const executeBulkTransfer = async () => {
    setShowConfirmModal(false);
    setBulkMsg("");
    setBulkResults([]);
    setBulkLoading(true);
    const srcId = parseInt(bulkSourceAccountId || accounts[0]?.id.toString());
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/bulk_transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_account_id: srcId,
          payments: bulkRows.map(r => ({
            destination_account_number: r.destination,
            amount: parseFloat(r.amount),
            description: r.description
          }))
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Batch processed: ${data.message}`, "success");
        showReceipt("Bulk Payment Summary", [
          {label: "Total Recipients", value: data.results.length.toString()},
          {label: "Total Amount", value: `${bulkSourceAcc?.currency === "USD" ? "$" : "ZWG "}${bulkTotal.toFixed(2)}`},
          {label: "Total IMTT", value: `ZWG ${data.total_imtt_charged.toFixed(2)}`},
          {label: "Grand Total", value: `${bulkSourceAcc?.currency === "USD" ? "$" : "ZWG "}${(bulkTotal + data.total_imtt_charged).toFixed(2)}`}
        ]);
        setBulkResults(data.results);
        setBulkRows([{ id: 1, destination: "", amount: "", description: "" }]);
        setBulkNextId(2);
        const userId = localStorage.getItem("user_id");
        if (userId) fetchAccounts(userId);
        fetchTransactions(srcId);
      } else {
        showToast(`Error: ${data.detail}`, "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const showToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const showReceipt = useCallback((title: string, lines: Receipt["lines"]) => {
    setReceipt({ title, lines });
  }, []);

  const toggleNav = (nav: string) => {
    if (expandedNav === nav) {
      setExpandedNav(null);
    } else {
      setExpandedNav(nav);
      // Automatically set active tab to the first option in the group if applicable
      if (nav === "Transfer") setActiveTab("History");
      if (nav === "Bill Payments") setActiveTab("Bill Categories");
      if (nav === "Airtime") setActiveTab("Econet");
    }
  };

  return (
    <div data-theme={darkMode ? "dark" : "light"} className="dashboard-layout">
      {/* Toast Notifications */}
      <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:9999, display:"flex", flexDirection:"column", gap:"0.75rem" }}>
        {toasts.map(t => (
          <div key={t.id} className={`badge-${t.type}`} style={{
            padding:"1rem 1.5rem", borderRadius:"16px", fontWeight:700, fontSize:"0.9rem",
            background: t.type==="success" ? "var(--success)" : t.type==="error" ? "var(--error)" : "var(--primary)",
            color:"white", boxShadow:"var(--shadow-lg)",
            display:"flex", alignItems:"center", gap:"0.75rem", minWidth:"300px",
            animation:"slideInRight 0.3s ease",
          }}>
            <span style={{fontSize:"1.2rem"}}>{t.type==="success"?"✅":t.type==="error"?"❌":"ℹ️"}</span>
            {t.message}
          </div>
        ))}
      </div>

      {/* e-Receipt Modal */}
      {receipt && (
        <div className="modal-overlay" onClick={() => setReceipt(null)}>
          <div className="modal-content animate-up" style={{width:"min(400px,90vw)"}} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🧾</div>
              <h2 className="brand-font" style={{margin:0,fontSize:"1.5rem"}}>{receipt.title}</h2>
              <p className="mt-1" style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>{new Date().toLocaleString("en-ZW")}</p>
            </div>
            <div style={{borderTop:"2px dashed var(--border-color)",paddingTop:"1.5rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              {receipt.lines.map((l,i) => (
                <div key={i} className="flex justify-between" style={{fontSize:"0.95rem"}}>
                  <span style={{color:"var(--text-muted)"}}>{l.label}</span>
                  <strong style={{color:"var(--text-main)"}}>{l.value}</strong>
                </div>
              ))}
            </div>
            <div style={{borderTop:"2px dashed var(--border-color)",marginTop:"1.5rem",paddingTop:"1.5rem"}}>
              <button onClick={() => setReceipt(null)} className="btn-premium w-full">Close Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Maker-Checker Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content animate-up" style={{width:"min(540px,90vw)"}} onClick={e => e.stopPropagation()}>
            <h2 className="brand-font" style={{margin:"0 0 0.5rem",color:"var(--primary)",fontSize:"1.3rem"}}>⚠️ Confirm Bulk Payment</h2>
            <p style={{color:"var(--text-muted)",fontSize:"0.9rem",marginBottom:"1.25rem"}}>Please review the payment details before authorising.</p>
            <div style={{background:"var(--bg-color)",borderRadius:"16px",padding:"1.5rem",marginBottom:"1.25rem",fontSize:"0.9rem", border:"1px solid var(--border-color)"}}>
              <div className="flex justify-between mb-2"><span>Recipients</span><strong>{bulkRows.length}</strong></div>
              <div className="flex justify-between mb-2"><span>Subtotal</span><strong>{bulkSourceAcc?.currency==="USD"?"$":"ZWG "}{bulkTotal.toFixed(2)}</strong></div>
              {bulkImtt > 0 && <div className="flex justify-between mb-2"><span style={{color:"var(--error)"}}>IMTT (2%)</span><strong style={{color:"var(--error)"}}>ZWG {bulkImtt.toFixed(2)}</strong></div>}
              <div className="flex justify-between mt-4" style={{paddingTop:"1rem",borderTop:"1px solid var(--border-color)"}}><span style={{fontWeight:700}}>Total to Debit</span><strong style={{color:"var(--primary)",fontSize:"1.2rem"}}>{bulkSourceAcc?.currency==="USD"?"$":"ZWG "}{bulkGrandTotal.toFixed(2)}</strong></div>
            </div>
            <div style={{maxHeight:"200px",overflowY:"auto",marginBottom:"1.5rem", borderRadius:"12px", border:"1px solid var(--border-color)"}}>
              <table className="table-premium" style={{fontSize:"0.8rem"}}>
                <thead><tr style={{background:"var(--bg-color)"}}><th style={{padding:"0.6rem"}}>Account</th><th style={{textAlign:"right",padding:"0.6rem"}}>Amount</th><th style={{padding:"0.6rem"}}>Reference</th></tr></thead>
                <tbody>{bulkRows.map((r,i)=><tr key={i}><td style={{padding:"0.5rem",fontFamily:"monospace"}}>{r.destination}</td><td style={{textAlign:"right",padding:"0.5rem",fontWeight:700}}>{bulkSourceAcc?.currency==="USD"?"$":"ZWG "}{parseFloat(r.amount||"0").toFixed(2)}</td><td style={{padding:"0.5rem",color:"var(--text-muted)"}}>{r.description}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="flex gap-4">
              <button onClick={()=>setShowConfirmModal(false)} className="btn-premium" style={{flex:1, background:"var(--bg-color)", color:"var(--text-main)", border:"1px solid var(--border-color)"}}>Cancel</button>
              <button onClick={executeBulkTransfer} className="btn-premium" style={{flex:2}}>✅ Authorise & Execute</button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo brand-font">
          <span style={{background:"var(--primary)", color:"white", padding:"0.4rem", borderRadius:"12px", fontSize:"1.2rem"}}>🏦</span>
          IB Advisor
          <button onClick={() => setSidebarOpen(false)} style={{background:"none", border:"none", fontSize:"1.5rem", color:"var(--text-main)", marginLeft:"auto"}} className="mobile-only">✕</button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === "Home" ? "active" : ""}`} onClick={() => { setActiveTab("Home"); setSidebarOpen(false); }}>
            <span>⌂ Home</span>
          </button>
          
          <button className={`nav-item ${activeTab === "AI Advisor" ? "active" : ""}`} onClick={() => { setActiveTab("AI Advisor"); setSidebarOpen(false); }}>
            <span>🤖 AI Advisor</span>
          </button>
          
          <button className={`nav-item ${["History", "Transfer", "Bulk Payment", "Bulk History"].includes(activeTab) ? "active" : ""}`} onClick={() => toggleNav("Transfer")}>
            <span>⇄ Transfer</span>
            <span>{expandedNav === "Transfer" ? "▲" : "▼"}</span>
          </button>
          {expandedNav === "Transfer" && (
            <div className="nav-subgroup">
              <a className={`nav-subitem ${activeTab === "History" ? "active" : ""}`} onClick={() => { setActiveTab("History"); setSidebarOpen(false); }}>View History</a>
              <a className={`nav-subitem ${activeTab === "Transfer" ? "active" : ""}`} onClick={() => { setActiveTab("Transfer"); setSidebarOpen(false); }}>Send Money</a>
              <a className={`nav-subitem ${activeTab === "Bulk Payment" ? "active" : ""}`} onClick={() => { setActiveTab("Bulk Payment"); setSidebarOpen(false); }}>Bulk Transfer</a>
              <a className={`nav-subitem ${activeTab === "Bulk History" ? "active" : ""}`} onClick={() => { setActiveTab("Bulk History"); setSidebarOpen(false); }}>Bulk History</a>
            </div>
          )}

          <button className={`nav-item ${["View Payments", "Bill Categories"].includes(activeTab) ? "active" : ""}`} onClick={() => toggleNav("Bill Payments")}>
            <span>$ Bill Payments</span>
            <span>{expandedNav === "Bill Payments" ? "▲" : "▼"}</span>
          </button>
          {expandedNav === "Bill Payments" && (
            <div className="nav-subgroup">
              <a className={`nav-subitem ${activeTab === "Bill Categories" ? "active" : ""}`} onClick={() => { setActiveTab("Bill Categories"); setSidebarOpen(false); }}>Pay Bills</a>
              <a className={`nav-subitem ${activeTab === "View Payments" ? "active" : ""}`} onClick={() => { setActiveTab("View Payments"); setSidebarOpen(false); }}>Payment History</a>
            </div>
          )}

          <button className={`nav-item ${["Econet", "NetOne", "Telecel"].includes(activeTab) ? "active" : ""}`} onClick={() => toggleNav("Airtime")}>
            <span>📱 Airtime</span>
            <span>{expandedNav === "Airtime" ? "▲" : "▼"}</span>
          </button>
          {expandedNav === "Airtime" && (
            <div className="nav-subgroup">
              <a className={`nav-subitem ${activeTab === "Econet" ? "active" : ""}`} onClick={() => { setActiveTab("Econet"); setSidebarOpen(false); }}>Econet</a>
              <a className={`nav-subitem ${activeTab === "NetOne" ? "active" : ""}`} onClick={() => { setActiveTab("NetOne"); setSidebarOpen(false); }}>NetOne</a>
              <a className={`nav-subitem ${activeTab === "Telecel" ? "active" : ""}`} onClick={() => { setActiveTab("Telecel"); setSidebarOpen(false); }}>Telecel</a>
            </div>
          )}

          <button className={`nav-item ${["Add Beneficiary", "Manage Beneficiaries"].includes(activeTab) ? "active" : ""}`} onClick={() => toggleNav("Beneficiaries")}>
            <span>👥 Beneficiaries</span>
            <span>{expandedNav === "Beneficiaries" ? "▲" : "▼"}</span>
          </button>
          {expandedNav === "Beneficiaries" && (
            <div className="nav-subgroup">
              <a className={`nav-subitem ${activeTab === "Add Beneficiary" ? "active" : ""}`} onClick={() => { setActiveTab("Add Beneficiary"); setSidebarOpen(false); }}>Add New</a>
              <a className={`nav-subitem ${activeTab === "Manage Beneficiaries" ? "active" : ""}`} onClick={() => { setActiveTab("Manage Beneficiaries"); setSidebarOpen(false); }}>Manage Saved</a>
            </div>
          )}

          <button className={`nav-item ${activeTab === "Manage" ? "active" : ""}`} onClick={() => { setActiveTab("Manage"); setSidebarOpen(false); }}>
            <span>⚙ Security</span>
          </button>
        </nav>
        <div style={{padding: "1.5rem"}}>
          <button className="nav-item" onClick={handleLogout} style={{color: "var(--error)"}}>
            ↳ Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="top-bar">
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <button onClick={() => setSidebarOpen(true)} className="mobile-only" style={{ background:"none", border:"none", fontSize:"1.8rem", cursor:"pointer", color:"var(--text-main)" }}>☰</button>
            <div className="user-welcome brand-font" style={{fontSize:"1.25rem"}}>
              Welcome, <strong>{name}</strong>
            </div>
          </div>
          <div className="theme-toggle" onClick={() => setDarkMode(!darkMode)} style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", cursor: "pointer", padding: "0.5rem 1rem", borderRadius: "100px", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "var(--shadow-sm)" }}>
            <span style={{ fontSize: "1.1rem" }}>{darkMode ? "🌙" : "☀️"}</span>
            <span style={{fontSize:"0.85rem", fontWeight:700, color:"var(--text-muted)"}}>{darkMode ? "DARK" : "LIGHT"}</span>
          </div>
        </div>

        {apiError && (
          <div style={{
            background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b",
            padding: "1rem 1.5rem", borderRadius: "12px", marginBottom: "2rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "var(--shadow-sm)", animation: "slideInDown 0.3s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.2rem" }}>🚨</span>
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem" }}>Connection Error</strong>
                <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{apiError}</span>
              </div>
            </div>
            <button 
              onClick={() => { const uid = localStorage.getItem("user_id"); if (uid) fetchAllData(uid); }}
              className="btn-premium"
              style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", background: "#991b1b" }}
            >
              🔄 Retry Connection
            </button>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="dashboard-left">
            {activeTab === "Home" && (
              <>
                <h2 className="section-title">Accounts Overview</h2>
                <div className="accounts-row">
                  {accounts.map(acc => (
                    <div key={acc.id} className="account-card" style={{animation:"slideInUp 0.3s ease"}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem"}}>
                        <div style={{fontSize:"1.2rem", fontWeight:800}}>{acc.account_type}</div>
                        <span style={{fontSize:"1.5rem"}}>{acc.currency === "USD" ? "🇺🇸" : "🇿🇼"}</span>
                      </div>
                      <div style={{fontSize:"0.85rem", opacity:0.8, marginBottom:"0.25rem"}}>Available Balance</div>
                      <div style={{fontSize:"1.8rem", fontWeight:800, marginBottom:"1rem"}}>
                        {acc.currency === "USD" ? "$" : "ZWG "}
                        {acc.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid rgba(255,255,255,0.2)", paddingTop:"1rem"}}>
                        <span style={{fontFamily:"monospace", fontSize:"0.9rem"}}>{acc.account_number}</span>
                        <button className="btn-premium" style={{background:"rgba(255,255,255,0.2)", padding:"0.4rem 0.8rem", fontSize:"0.75rem"}} onClick={() => { setSourceAccountId(acc.id.toString()); fetchTransactions(acc.id); setActiveTab("History"); }}>Details</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{marginTop:"3rem"}}>
                  <h2 className="section-title">Quick Shortcuts</h2>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:"1.25rem"}}>
                    {[{icon:"⇄",label:"RTGS",tab:"Transfer", color:"#3b82f6"}, {icon:"⚡",label:"ZIPIT",tab:"Transfer", color:"#10b981"}, {icon:"📱",label:"Airtime",tab:"Econet", color:"#f59e0b"}, {icon:"📷",label:"Scan",tab:"Scan", color:"#ef4444"}].map(s => (
                      <div key={s.label} className="card-premium" style={{textAlign:"center", cursor:"pointer", padding:"1.5rem"}} onClick={s.label==="Scan" ? handleSimulateScan : () => setActiveTab(s.tab)}>
                        <div style={{width:"48px", height:"48px", background:s.color, color:"white", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 0.75rem", fontSize:"1.25rem", boxShadow:`0 8px 16px -4px ${s.color}66`}}>{s.icon}</div>
                        <span style={{fontWeight:700, fontSize:"0.9rem"}}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "AI Advisor" && (
              <div className="animate-up">
                <div className="flex justify-between items-center mb-6 mobile-stack">
                  <h2 className="section-title" style={{marginBottom:0}}>AI Advisor Suite</h2>
                  <div className="sub-tab-group">
                    {["Insights", "Investments", "Simulation", "Market", "Profile"].map(t => (
                      <button 
                        key={t} 
                        className={`sub-tab-btn ${advisorSubTab === t ? "active" : ""}`}
                        onClick={() => setAdvisorSubTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {advisorSubTab === "Insights" && (
                  <div className="animate-up">
                    {comprehensiveAdvice ? (
                      <>
                        <div className="advisor-hero card-premium" style={{ borderLeft: "8px solid var(--primary)", marginBottom: "2rem" }}>
                          <div className="flex gap-6 items-center mobile-stack">
                            <div className="advisor-avatar">🤖</div>
                            <div style={{flex:1}}>
                              <div className="badge badge-primary mb-3">AI ANALYSIS</div>
                              <h3 className="brand-font" style={{fontSize:"1.8rem", margin:0}}>Monthly Financial Health</h3>
                              <p style={{fontSize:"1.1rem", color:"var(--text-main)", marginTop:"0.5rem", lineHeight:1.6}}>
                                Your spending this month is <strong>{comprehensiveAdvice.spending_analysis.spending_trend === "up" ? "increasing" : comprehensiveAdvice.spending_analysis.spending_trend === "down" ? "decreasing" : "stable"}</strong> compared to last month.
                                Current savings rate: <span className="text-success" style={{fontWeight:800}}>{comprehensiveAdvice.budgeting.savings_rate}</span>
                              </p>
                            </div>
                            <div className="spending-circular-preview">
                               <div style={{fontSize:"2.5rem"}}>{comprehensiveAdvice.spending_analysis.spending_trend === "up" ? "📈" : "📉"}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid-2-1">
                          <div className="flex flex-col gap-6">
                             <div className="card-premium">
                               <h4 className="brand-font mb-4">Spending Anomalies & Trends</h4>
                               <div className="flex flex-col gap-3">
                                  {comprehensiveAdvice.spending_analysis.anomalies.map((an, i) => (
                                    <div key={i} className="anomaly-item">
                                      <span className="anomaly-icon">⚠️</span>
                                      <p>{an}</p>
                                    </div>
                                  ))}
                               </div>
                             </div>

                             <div className="card-premium" style={{background:"var(--primary)", color:"white"}}>
                                <h4 className="brand-font mb-4" style={{color:"var(--accent)"}}>Budgeting Strategy</h4>
                                <div className="strategy-badge">{comprehensiveAdvice.budgeting.strategy}</div>
                                <p style={{lineHeight:1.7, fontSize:"1.05rem", marginTop:"1rem"}}>{comprehensiveAdvice.budgeting.advice}</p>
                             </div>
                          </div>

                          <div className="card-premium">
                            <h4 className="brand-font mb-4">Top Spending Categories</h4>
                            <div className="flex flex-col gap-6">
                              {comprehensiveAdvice.spending_analysis.top_categories.map(([cat, amt], i) => {
                                const pct = (amt / comprehensiveAdvice.spending_analysis.total_spent) * 100;
                                return (
                                  <div key={cat}>
                                    <div className="flex justify-between mb-2">
                                      <span style={{fontWeight:700}}>{cat}</span>
                                      <span style={{color:"var(--text-muted)"}}>{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                      <div className="progress-bar-fill" style={{width: `${pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length]}}></div>
                                    </div>
                                    <div style={{fontSize:"0.8rem", marginTop:"0.5rem", fontWeight:700}}>ZWG {amt.toLocaleString()}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Generating personalized insights...</p>
                      </div>
                    )}
                  </div>
                )}

                {advisorSubTab === "Investments" && (
                  <div className="animate-up">
                    <div className="flex justify-between items-center mb-6 mobile-stack">
                       <h3 className="brand-font" style={{margin:0}}>Recommended for {comprehensiveAdvice?.risk_profile} Risk</h3>
                       <div className="badge badge-success">Strategy: Capital Appreciation</div>
                    </div>
                    <div className="investment-grid">
                      {comprehensiveAdvice?.investments.map((inv, i) => (
                        <div key={i} className="card-premium inv-card">
                          <div className="inv-header">
                            <div className="inv-icon">{inv.risk === "High" || inv.risk === "Aggressive" ? "🚀" : "🛡️"}</div>
                            <div className="inv-yield">{inv.yield}</div>
                          </div>
                          <h4 className="brand-font mt-4 mb-2" style={{fontSize:"1.3rem"}}>{inv.name}</h4>
                          <p style={{color:"var(--text-muted)", fontSize:"0.9rem", lineHeight:1.6}}>{inv.description}</p>
                          <div className="flex justify-between items-center mt-6">
                             <div className="badge" style={{background:"var(--bg-color)", color:"var(--text-main)"}}>{inv.risk} Risk</div>
                             <button className="btn-premium" style={{fontSize:"0.8rem", padding:"0.5rem 1rem"}}>Invest Now</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {advisorSubTab === "Simulation" && (
                  <div className="animate-up">
                    <div className="grid-1-2">
                      <div className="card-premium">
                        <h3 className="brand-font mb-6">Wealth Projection</h3>
                        <form onSubmit={handleRunSimulation} className="flex flex-col gap-4">
                           <div className="form-group">
                             <label className="form-label">Initial Investment ($)</label>
                             <input className="input-premium" type="number" value={simInvestment} onChange={e => setSimInvestment(e.target.value)} />
                           </div>
                           <div className="form-group">
                             <label className="form-label">Monthly Savings ($)</label>
                             <input className="input-premium" type="number" value={simSavings} onChange={e => setSimSavings(e.target.value)} />
                           </div>
                           <div className="form-group">
                             <label className="form-label">Horizon (Years)</label>
                             <input className="input-premium" type="number" value={simYears} onChange={e => setSimYears(e.target.value)} />
                           </div>
                           <div className="form-group">
                             <label className="form-label">Expected Return (e.g. 0.15)</label>
                             <input className="input-premium" type="number" step="0.01" value={simReturn} onChange={e => setSimReturn(e.target.value)} />
                           </div>
                           <button type="submit" className="btn-premium mt-2">Run Simulation</button>
                        </form>
                      </div>

                      <div className="card-premium" style={{minHeight:"400px"}}>
                        {simulationResults ? (
                          <>
                            <div className="flex justify-between mb-8 mobile-stack">
                               <div>
                                 <div className="form-label">FINAL PROJECTED WEALTH</div>
                                 <div className="brand-font" style={{fontSize:"2.5rem", color:"var(--success)"}}>${simulationResults.final_wealth.toLocaleString()}</div>
                               </div>
                               <div style={{textAlign:"right"}} className="mobile-left">
                                 <div className="form-label">TOTAL INTEREST EARNED</div>
                                 <div style={{fontSize:"1.2rem", fontWeight:800, color:"var(--primary)"}}>${simulationResults.total_interest.toLocaleString()}</div>
                               </div>
                            </div>
                            
                            <div className="sim-chart-area">
                               {simulationResults.yearly_breakdown.map((year: any, i: number) => (
                                 <div key={i} className="sim-bar-group">
                                    <div className="sim-bar-container">
                                       <div className="sim-bar-wealth" style={{height: `${(year.wealth / simulationResults.final_wealth) * 100}%`}}></div>
                                       <div className="sim-bar-contrib" style={{height: `${(year.contributions / simulationResults.final_wealth) * 100}%`}}></div>
                                    </div>
                                    <span className="sim-bar-label">Y{year.year}</span>
                                 </div>
                               ))}
                            </div>
                            <div className="flex gap-4 mt-6 justify-center">
                               <div className="flex items-center gap-2"><div style={{width:12, height:12, background:"var(--success)", borderRadius:3}}></div> <span style={{fontSize:"0.75rem", fontWeight:700}}>Interest</span></div>
                               <div className="flex items-center gap-2"><div style={{width:12, height:12, background:"var(--primary)", borderRadius:3}}></div> <span style={{fontSize:"0.75rem", fontWeight:700}}>Contributions</span></div>
                            </div>
                          </>
                        ) : (
                          <div className="empty-state">
                             <div style={{fontSize:"4rem", marginBottom:"1rem"}}>📈</div>
                             <p className="brand-font" style={{fontSize:"1.2rem"}}>Wealth Projection Tool</p>
                             <p style={{marginTop:"0.5rem"}}>Adjust the parameters on the left to see your potential growth over time.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {advisorSubTab === "Market" && (
                  <div className="animate-up">
                    <div className="card-premium advisor-hero mb-6" style={{background:"var(--bg-color)", border:"1px solid var(--border-color)"}}>
                       <div className="flex gap-6 items-center mobile-stack">
                          <div style={{fontSize:"3.5rem"}}>🌍</div>
                          <div style={{flex:1}}>
                            <h3 className="brand-font" style={{margin:0}}>Market Awareness Insights</h3>
                            <p style={{lineHeight:1.7, color:"var(--text-main)", fontSize:"1.1rem", marginTop:"0.5rem"}}>
                              {aiMarketExplanation || "Connecting to global and local market data feeds... Analyzing trends for you."}
                            </p>
                          </div>
                       </div>
                    </div>

                    <div className="market-grid">
                       {comprehensiveAdvice?.market.map((m, i) => (
                         <div key={i} className="card-premium market-card">
                            <div className="flex justify-between items-start mb-4">
                               <div>
                                 <div style={{fontSize:"0.75rem", fontWeight:800, color:"var(--text-muted)", letterSpacing:"0.05em"}}>{m.type}</div>
                                 <h4 className="brand-font" style={{fontSize:"1.1rem", margin:"0.25rem 0"}}>{m.name}</h4>
                                 <div style={{fontFamily:"monospace", fontSize:"0.8rem", color:"var(--primary)"}}>{m.symbol}</div>
                               </div>
                               <div className={`market-trend ${m.trend.toLowerCase().replace(' ','-')}`}>{m.trend}</div>
                            </div>
                            <div className="flex justify-between items-end">
                               <div>
                                  <div style={{fontSize:"1.4rem", fontWeight:800}}>{m.type === "Crypto" ? "$" : "ZWG "}{m.price.toLocaleString()}</div>
                                  <div style={{fontSize:"0.85rem", color: m.change >= 0 ? "var(--success)" : "var(--error)", fontWeight:700}}>
                                    {m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change)}%
                                  </div>
                               </div>
                               {m.yield && <div className="market-yield">Yield: {m.yield}</div>}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {advisorSubTab === "Profile" && (
                  <div className="animate-up">
                    <div className="grid-2-1">
                       <div className="card-premium">
                          <h3 className="brand-font mb-6">Financial Profile & Risk</h3>
                          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-6">
                             <div className="form-group">
                               <label className="form-label">Monthly Target Income (ZWG)</label>
                               <input className="input-premium" type="number" value={userProfile?.monthly_income_target || 0} onChange={e => setUserProfile(p => p ? {...p, monthly_income_target: parseFloat(e.target.value)} : null)} />
                             </div>
                             <div className="form-group">
                               <label className="form-label">Risk Tolerance</label>
                               <div className="risk-selector">
                                  {["LOW", "MEDIUM", "HIGH"].map(r => (
                                    <button 
                                      type="button"
                                      key={r} 
                                      className={`risk-btn ${userProfile?.risk_tolerance === r ? "active" : ""}`}
                                      onClick={() => setUserProfile(p => p ? {...p, risk_tolerance: r} : null)}
                                    >
                                      {r}
                                    </button>
                                  ))}
                               </div>
                             </div>
                             <div className="form-group">
                               <label className="form-label">Financial Goals</label>
                               <div className="goals-list-edit" style={{display:"flex", flexDirection:"column", gap:"0.75rem"}}>
                                  {userProfile?.financial_goals.map((g, i) => (
                                    <div key={i} className="goal-edit-item">
                                       <input className="input-premium" style={{flex:2}} placeholder="Goal Name" value={g.name} onChange={e => {
                                          const newGoals = [...userProfile!.financial_goals];
                                          newGoals[i].name = e.target.value;
                                          setUserProfile({...userProfile!, financial_goals: newGoals});
                                       }} />
                                       <input className="input-premium" style={{flex:1}} type="number" placeholder="Target" value={g.target} onChange={e => {
                                          const newGoals = [...userProfile!.financial_goals];
                                          newGoals[i].target = parseFloat(e.target.value);
                                          setUserProfile({...userProfile!, financial_goals: newGoals});
                                       }} />
                                    </div>
                                  ))}
                               </div>
                             </div>
                             <button type="submit" className="btn-premium">Save Profile Changes</button>
                          </form>
                       </div>

                       <div className="card-premium">
                          <h3 className="brand-font mb-6">Goal Progress</h3>
                          <div className="flex flex-col gap-8">
                             {comprehensiveAdvice?.goals.map((g, i) => (
                               <div key={i}>
                                  <div className="flex justify-between mb-3">
                                     <span style={{fontWeight:800}}>{g.name}</span>
                                     <span style={{color:"var(--primary)", fontWeight:800}}>{g.percent}%</span>
                                  </div>
                                  <div className="progress-bar-bg" style={{height:12}}>
                                     <div className="progress-bar-fill" style={{width: `${g.percent}%`, background:"var(--success)"}}></div>
                                  </div>
                                  <div className="flex justify-between mt-2" style={{fontSize:"0.8rem", color:"var(--text-muted)"}}>
                                     <span>Current: ${g.current.toLocaleString()}</span>
                                     <span>Target: ${g.target.toLocaleString()}</span>
                                  </div>
                               </div>
                             ))}
                             {(!comprehensiveAdvice?.goals || comprehensiveAdvice.goals.length === 0) && (
                               <p style={{color:"var(--text-muted)", textAlign:"center"}}>No active goals found. Set them in your profile!</p>
                             )}
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Transfer" && (
              <div className="animate-up">
                <h2 className="section-title">Send Funds</h2>
                <div className="card-premium">
                  <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="form-group">
                      <label className="form-label">SOURCE ACCOUNT</label>
                      <select className="input-premium" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} required>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.currency} - {acc.account_number} (Bal: {acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">DESTINATION ACCOUNT</label>
                      <div className="flex gap-4 mobile-stack">
                        <input className="input-premium" style={{ flex: 1 }} type="text" placeholder="Enter account number" value={destAccount} onChange={(e) => setDestAccount(e.target.value)} required />
                        {beneficiaries.length > 0 && (
                          <select className="input-premium" style={{ width: "220px" }} onChange={(e) => {
                            if (e.target.value) setDestAccount(e.target.value);
                          }}>
                            <option value="">Select Beneficiary</option>
                            {beneficiaries.map(ben => (
                              <option key={ben.id} value={ben.account_number}>{ben.name} ({ben.bank_name})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}} className="mobile-stack">
                      <div className="form-group">
                        <label className="form-label">AMOUNT</label>
                        <input className="input-premium" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">REFERENCE</label>
                        <input className="input-premium" type="text" placeholder="Transfer description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2">Send Funds Now</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "History" && (
              <div className="animate-up">
                <h2 className="section-title">Transaction History</h2>
                <div className="flex gap-4 mb-4 items-center mobile-stack">
                  <div style={{flex:1}}>
                    <label className="form-label">SELECT ACCOUNT</label>
                    <select value={sourceAccountId} onChange={(e) => { setSourceAccountId(e.target.value); fetchTransactions(parseInt(e.target.value)); }} className="input-premium">
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.currency} - {acc.account_number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2" style={{alignSelf:"flex-end"}}>
                    <a
                      href={`${API_BASE_URL}/api/accounts/statement?account_id=${sourceAccountId}`}
                      download
                      className="btn-premium"
                      style={{background:"var(--success)"}}
                    >
                      ⬇️ Statement
                    </a>
                    <button className="btn-premium" style={{ background: "var(--bg-color)", color: "var(--text-main)", border: "1px solid var(--border-color)" }} onClick={() => setActiveTab("Home")}>Back</button>
                  </div>
                </div>
                <div className="card-premium" style={{padding:0, overflow:"hidden"}}>
                  {transactions.length === 0 ? <p style={{ padding: "2rem", color: "var(--text-muted)", textAlign:"center" }}>No transactions found for this account.</p> : (
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>AI Category</th>
                          <th>Type</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id}>
                            <td style={{ color: "var(--text-muted)", fontSize:"0.85rem" }}>{new Date(tx.timestamp).toLocaleDateString()}</td>
                            <td style={{fontWeight:700}}>{tx.description}</td>
                            <td>
                              <span className="badge badge-primary">
                                {tx.ai_category || "General"}
                              </span>
                            </td>
                            <td style={{fontSize:"0.85rem", color:"var(--text-muted)"}}>{tx.transaction_type}</td>
                            <td style={{ textAlign: "right", color: tx.amount < 0 ? "var(--error)" : "var(--success)", fontWeight: 800 }}>
                              {tx.currency === "USD" ? "$" : "ZWG "}{Math.abs(tx.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Bulk Payment" && (
              <div className="animate-up">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="section-title" style={{ marginBottom: 0 }}>Bulk Multi-Transfer</h2>
                  <div className="flex gap-2">
                    <button className="btn-premium" style={{ background: "var(--bg-color)", color: "var(--text-main)", border: "1px solid var(--border-color)" }} onClick={addBulkRow}>+ Add Row</button>
                    <label className="btn-premium" style={{ background: "var(--accent)", color: "#0a1f44", cursor: "pointer" }}>
                      📥 Import CSV <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>

                <div className="card-premium mb-4">
                  <div className="mb-4">
                    <label className="form-label">SELECT FUNDING ACCOUNT</label>
                    <select className="input-premium" value={bulkSourceAccountId} onChange={(e) => setBulkSourceAccountId(e.target.value)}>
                      <option value="">Choose an account...</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.currency} - {acc.account_number} (Bal: {acc.balance.toLocaleString()})</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-4 mb-4">
                    {bulkRows.map((row, index) => (
                      <div key={row.id} className="bulk-row-grid animate-up" style={{ background: "var(--bg-color)", border: "1px solid var(--border-color)", padding: "1.25rem", borderRadius: "16px", display:"grid", gridTemplateColumns:"30px 1fr 120px 1fr 40px", gap:"1rem", alignItems:"center" }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 800 }}>#{index + 1}</div>
                        <input className="input-premium" placeholder="Recipient Account" value={row.destination} onChange={(e) => updateBulkRow(row.id, "destination", e.target.value)} />
                        <input className="input-premium" type="number" placeholder="Amount" value={row.amount} onChange={(e) => updateBulkRow(row.id, "amount", e.target.value)} />
                        <input className="input-premium" placeholder="Reference" value={row.description} onChange={(e) => updateBulkRow(row.id, "description", e.target.value)} />
                        <button onClick={() => removeBulkRow(row.id)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "1.2rem", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑️</button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center" style={{ padding: "1.5rem", background: "var(--primary)", borderRadius: "20px", color: "white", boxShadow:"var(--shadow-lg)" }}>
                    <div>
                      <span style={{ fontSize: "0.9rem", opacity: 0.8, fontWeight: 700 }}>TOTAL SETTLEMENT</span>
                      <div className="brand-font" style={{ fontSize: "1.8rem", color: "var(--accent)", fontWeight: 800 }}>
                        {bulkSourceAcc?.currency === "USD" ? "$" : "ZWG "}{bulkTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button className="btn-premium" style={{ width: "240px", background: "white", color: "var(--primary)" }} onClick={handleBulkTransfer} disabled={bulkLoading || bulkRows.some(r => !r.destination || !r.amount)}>
                      {bulkLoading ? "⏳ Processing..." : "🚀 Review & Execute"}
                    </button>
                  </div>
                </div>

                {bulkResults.length > 0 && (
                  <div className="card-premium" style={{ padding: 0, overflow: "hidden" }}>
                    <h3 className="brand-font" style={{ padding: "1.5rem", margin: 0, fontSize: "1.2rem", borderBottom:"1px solid var(--border-color)" }}>Execution Results</h3>
                    <table className="table-premium">
                      <thead>
                        <tr><th>Recipient</th><th>Status</th><th>Message</th></tr>
                      </thead>
                      <tbody>
                        {bulkResults.map((res: any, i) => (
                          <tr key={i}>
                            <td style={{fontFamily:"monospace"}}>{res.destination}</td>
                            <td><span className={`badge ${res.status === "processed" ? "badge-success" : "badge-error"}`}>{res.status}</span></td>
                            <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Payment successful</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Manage" && (
              <div className="animate-up">
                <h2 className="section-title">Account Management</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem" }} className="mobile-stack">
                  <div className="card-premium">
                    <div className="text-center mb-4">
                      <div style={{ width: "100px", height: "100px", background: "var(--primary)", borderRadius: "30px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: "3rem", color: "white", boxShadow: "var(--shadow-lg)" }}>👤</div>
                      <h3 className="brand-font" style={{ margin: 0, fontSize: "1.5rem" }}>{name}</h3>
                      <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Elite Private Banking</p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div style={{ padding: "1.25rem", background: "var(--bg-color)", borderRadius: "16px", border: "1px solid var(--border-color)" }}>
                        <div className="form-label mb-2">PHONE NUMBER</div>
                        <div style={{ fontWeight: 700 }}>{localStorage.getItem("user_id") === "2" ? "0771234567" : "0772123456"}</div>
                      </div>
                      <div style={{ padding: "1.25rem", background: "var(--bg-color)", borderRadius: "16px", border: "1px solid var(--border-color)" }}>
                        <div className="form-label mb-2">SECURITY STATUS</div>
                        <div style={{ color: "var(--success)", fontWeight: 700 }}>✓ Multi-Factor Authentication Enabled</div>
                      </div>
                    </div>
                  </div>

                  <div className="card-premium">
                    <h3 className="brand-font mb-4" style={{ fontSize: "1.25rem" }}>Security Controls</h3>
                    <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); showToast("Security PIN updated!", "success"); }}>
                      <div className="form-group">
                        <label className="form-label">CURRENT PIN</label>
                        <input className="input-premium" type="password" maxLength={6} placeholder="••••••" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">NEW PIN</label>
                        <input className="input-premium" type="password" maxLength={6} placeholder="••••••" />
                      </div>
                      <button className="btn-premium mt-2" type="submit">Update Security PIN</button>
                    </form>
                  </div>
                </div>

                <div style={{ marginTop: "3rem" }}>
                  <h3 className="section-title" style={{ fontSize: "1.25rem" }}>Linked Services</h3>
                  <div className="card-premium" style={{ padding: 0 }}>
                    {accounts.map((acc, i) => (
                      <div key={acc.id} className="flex justify-between items-center" style={{ padding: "1.5rem", borderBottom: i === accounts.length - 1 ? "none" : "1px solid var(--border-color)" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{acc.account_type} Account</div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{acc.account_number} · {acc.currency}</div>
                        </div>
                        <a href={`${API_BASE_URL}/api/accounts/statement?account_id=${acc.id}`} download className="btn-premium" style={{ background: "transparent", color: "var(--primary)", border: "1px solid var(--primary)", padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Statement</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(activeTab === "Econet" || activeTab === "NetOne" || activeTab === "Telecel") && (
              <div className="animate-up">
                <h2 className="section-title">Buy {activeTab} Airtime</h2>
                <div className="card-premium">
                  <form onSubmit={(e) => handleBuyAirtime(e, activeTab)} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="form-group">
                      <label className="form-label">SOURCE ACCOUNT</label>
                      <select className="input-premium" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} required>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.currency} - {acc.account_number} ({acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}} className="mobile-stack">
                      <div className="form-group">
                        <label className="form-label">PHONE NUMBER</label>
                        <input className="input-premium" type="text" placeholder="e.g. 0772123456" value={airtimePhone} onChange={(e) => setAirtimePhone(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">AMOUNT</label>
                        <input className="input-premium" type="number" step="0.01" placeholder="0.00" value={airtimeAmount} onChange={(e) => setAirtimeAmount(e.target.value)} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2">Recharge Now</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "Add Beneficiary" && (
              <div className="animate-up">
                <h2 className="section-title">Add Beneficiary</h2>
                <div className="card-premium">
                  <form onSubmit={handleAddBeneficiary} style={{display: "flex", flexDirection: "column", gap: "1.5rem"}}>
                    <div className="form-group">
                      <label className="form-label">BENEFICIARY NAME</label>
                      <input className="input-premium" type="text" placeholder="Full name" value={benName} onChange={(e) => setBenName(e.target.value)} required />
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}} className="mobile-stack">
                      <div className="form-group">
                        <label className="form-label">ACCOUNT NUMBER</label>
                        <input className="input-premium" type="text" placeholder="Destination account" value={benAccount} onChange={(e) => setBenAccount(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">BANK NAME</label>
                        <select className="input-premium" value={benBank} onChange={(e) => setBenBank(e.target.value)} required>
                          <option value="CABS">CABS</option>
                          <option value="CBZ">CBZ</option>
                          <option value="Stanbic">Stanbic</option>
                          <option value="FBC">FBC</option>
                          <option value="Nedbank">Nedbank</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2">Save Beneficiary</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "Manage Beneficiaries" && (
              <div className="animate-up">
                <h2 className="section-title">Saved Beneficiaries</h2>
                <div className="card-premium" style={{padding:0, overflow:"hidden"}}>
                  {beneficiaries.length === 0 ? <p style={{padding:"2rem", color:"var(--text-muted)"}}>No beneficiaries found.</p> : (
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Account Details</th>
                          <th>Bank</th>
                          <th style={{textAlign:"right"}}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beneficiaries.map(ben => (
                          <tr key={ben.id}>
                            <td style={{fontWeight:700}}>{ben.name}</td>
                            <td style={{fontFamily:"monospace", color:"var(--text-muted)"}}>{ben.account_number}</td>
                            <td><span className="badge badge-primary">{ben.bank_name}</span></td>
                            <td style={{textAlign:"right"}}>
                              <button className="btn-premium" style={{padding:"0.5rem 1rem", fontSize:"0.8rem"}} onClick={() => {
                                setDestAccount(ben.account_number);
                                setActiveTab("Transfer");
                              }}>Send Funds</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {(activeTab === "Bill Categories" || activeTab === "Bill Payments") && (
              <div className="animate-up">
                <h2 className="section-title">Pay Bill</h2>
                <div className="card-premium">
                  <form onSubmit={handlePayBill} style={{display: "flex", flexDirection: "column", gap: "1.5rem"}}>
                    <div className="form-group">
                      <label className="form-label">SOURCE ACCOUNT</label>
                      <select className="input-premium" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} required>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.currency} - {acc.account_number} ({acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">SELECT BILLER</label>
                      <select className="input-premium" value={billerName} onChange={(e) => setBillerName(e.target.value)} required>
                        <option value="ZESA Prepaid">ZESA Prepaid Token</option>
                        <option value="City of Harare">City of Harare Water</option>
                        <option value="DStv">DStv Subscription</option>
                        <option value="ZIMRA">ZIMRA Taxes</option>
                      </select>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}} className="mobile-stack">
                      <div className="form-group">
                        <label className="form-label">METER / ACC NUMBER</label>
                        <input className="input-premium" type="text" placeholder="Reference number" value={billReference} onChange={(e) => setBillReference(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">AMOUNT</label>
                        <input className="input-premium" type="number" step="0.01" placeholder="0.00" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2">Complete Payment</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "View Payments" && (
              <div className="animate-up">
                <h2 className="section-title">Utility Payment History</h2>
                <div className="card-premium" style={{padding:0, overflow:"hidden"}}>
                  {transactions.filter(tx => tx.transaction_type === "BILL_PAYMENT" || tx.transaction_type === "AIRTIME").length === 0 ? <p style={{padding:"2rem", color:"var(--text-muted)"}}>No utility payments found.</p> : (
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Service / Description</th>
                          <th style={{textAlign: "right"}}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.filter(tx => tx.transaction_type === "BILL_PAYMENT" || tx.transaction_type === "AIRTIME").map(tx => (
                          <tr key={tx.id}>
                            <td style={{color: "var(--text-muted)", fontSize:"0.85rem"}}>{new Date(tx.timestamp).toLocaleDateString()}</td>
                            <td style={{fontWeight:600}}>{tx.description}</td>
                            <td style={{textAlign: "right", color: "var(--error)", fontWeight: 800}}>
                              {tx.currency === "USD" ? "$" : "ZWG "}{Math.abs(tx.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}


            {activeTab === "Bulk History" && (
              <div className="animate-up">
                <h2 className="section-title">Bulk Payment Log</h2>
                <div className="flex gap-4 mb-4 items-center mobile-stack">
                  <div style={{flex:1}}>
                    <label className="form-label">SEARCH ENTRIES</label>
                    <input
                      className="input-premium"
                      type="text"
                      placeholder="Filter by description..."
                      value={bulkHistoryFilter}
                      onChange={e => setBulkHistoryFilter(e.target.value)}
                    />
                  </div>
                  <div style={{width:"240px"}}>
                    <label className="form-label">ACCOUNT</label>
                    <select className="input-premium" value={sourceAccountId}
                      onChange={e => { setSourceAccountId(e.target.value); fetchTransactions(parseInt(e.target.value)); }}>
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.currency} — {acc.account_number}</option>)}
                    </select>
                  </div>
                </div>
                <div className="card-premium" style={{padding:0, overflow:"hidden"}}>
                  {(() => {
                    const bulkTxs = transactions.filter(tx =>
                      (tx.transaction_type === "BULK_TRANSFER_OUT" || tx.transaction_type === "TAX") &&
                      (!bulkHistoryFilter || tx.description.toLowerCase().includes(bulkHistoryFilter.toLowerCase()))
                    );
                    if (bulkTxs.length === 0) return <p style={{color:"var(--text-muted)",textAlign:"center",padding:"3rem"}}>No matching bulk payments found.</p>;
                    return (
                      <table className="table-premium">
                        <thead>
                          <tr>
                            <th>Date</th><th>Description</th><th>Classification</th><th style={{textAlign:"right"}}>Settlement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkTxs.map(tx => (
                            <tr key={tx.id}>
                              <td style={{color:"var(--text-muted)", fontSize:"0.85rem"}}>{new Date(tx.timestamp).toLocaleDateString()}</td>
                              <td style={{fontWeight:600}}>{tx.description}</td>
                              <td>
                                <span className={`badge ${tx.transaction_type==="TAX"?"badge-error":"badge-primary"}`}>
                                  {tx.transaction_type}
                                </span>
                              </td>
                              <td style={{textAlign:"right",color:"var(--error)",fontWeight:800}}>
                                {tx.currency==="USD"?"$":"ZWG "}{Math.abs(tx.amount).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-right">
            <div className="card-premium" style={{ borderRadius: "12px", padding: "1.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
              <div className="form-label mb-4" style={{ fontSize: "0.7rem", opacity: 0.8 }}>SPENDING OVERVIEW</div>
              <div style={{ position: "relative", width: "150px", height: "150px", margin: "0 auto 1.5rem" }}>
                <svg width="150" height="150" viewBox="0 0 100 100">
                  {spendingInsights?.categories.slice(0, 5).reduce((acc, cat, i) => {
                    const pct = spendingInsights.total_spending > 0 ? (cat.amount / spendingInsights.total_spending) : 0;
                    const offset = acc.total;
                    acc.total += pct;
                    const dash = pct * 251.2;
                    const off = offset * 251.2;
                    acc.elems.push(<circle key={i} cx="50" cy="50" r="40" fill="transparent" stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} strokeWidth="12" strokeDasharray={`${dash} 251.2`} strokeDashoffset={-off} transform="rotate(-90 50 50)" />);
                    return acc;
                  }, { total: 0, elems: [] as any[] }).elems}
                  <circle cx="50" cy="50" r="32" fill="var(--card-bg)" />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>Total</div>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>ZWG {spendingInsights?.total_spending.toFixed(0)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {spendingInsights?.categories.slice(0, 4).map((cat, i) => (
                  <div key={cat.name} className="flex justify-between items-center" style={{ fontSize: "0.75rem" }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}></div>
                      <span style={{ color: "var(--text-muted)" }}>{cat.name}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>ZWG {cat.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)", borderRadius: "12px", padding: "1.25rem", color: "white", boxShadow: "var(--shadow-lg)" }}>
              <div className="form-label mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>QUICK ACTIONS</div>
              <div className="flex flex-col gap-2">
                {([{ icon: "⇄", label: "Transfer", tab: "Transfer" }, { icon: "💼", label: "Bulk Pay", tab: "Bulk Payment" }, { icon: "📱", label: "Airtime", tab: "Econet" }, { icon: "⚙", label: "Security", tab: "Manage" }]).map(({ icon, label, tab }) => (
                  <button key={label} onClick={() => setActiveTab(tab)}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "white", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", textAlign: "left", transition: "all 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: darkMode ? "rgba(250,204,21,0.1)" : "#fef3c7", borderRadius: "12px", padding: "1.25rem", border: `1px solid ${darkMode ? "var(--accent)" : "#fde68a"}`, display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ fontSize: "1.5rem" }}>💡</div>
              <div style={{ fontSize: "0.85rem", color: darkMode ? "var(--accent)" : "#92400e", lineHeight: 1.5 }}>
                <strong>Pro Tip:</strong> You can now download full CSV statements directly from the history tab.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
