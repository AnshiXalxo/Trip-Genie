import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = ''; // same origin

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('token');
}
function setToken(t) {
  localStorage.setItem('token', t);
}
function clearToken() {
  localStorage.removeItem('token');
}
function getCurrentUser() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.name || payload.email || payload.userId || 'You';
  } catch {
    return 'You';
  }
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Something went wrong');
  return data;
}

// avatar color from name
const AVATAR_COLORS = [
  'linear-gradient(135deg, #e040fb, #7c4dff)',
  'linear-gradient(135deg, #448aff, #69f0ae)',
  'linear-gradient(135deg, #ff6e40, #ffd740)',
  'linear-gradient(135deg, #e040fb, #448aff)',
  'linear-gradient(135deg, #69f0ae, #448aff)',
  'linear-gradient(135deg, #ff5252, #e040fb)',
  'linear-gradient(135deg, #ffd740, #69f0ae)',
];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─────────────────────────────────────────────
// Toast System
// ─────────────────────────────────────────────
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((text, type = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, text, type }]);
    // start exit animation after 2.5s, remove after 3s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, 2500);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2900);
  }, []);

  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type} ${t.exiting ? 'toast-exit' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );

  return { addToast, ToastContainer };
}

// ─────────────────────────────────────────────
// Background Blobs
// ─────────────────────────────────────────────
function Blobs() {
  return (
    <>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </>
  );
}

// ─────────────────────────────────────────────
// Auth Page (unchanged API calls)
// ─────────────────────────────────────────────
function AuthPage({ onLogin, addToast }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const resetForm = () => { setName(''); setEmail(''); setPassword(''); setMessage(null); };
  const switchMode = (m) => { resetForm(); setMode(m); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
        addToast('Account created! Logging you in…', 'success');
        const loginData = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        setToken(loginData.token);
        setTimeout(() => onLogin(), 400);
      } else {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        setToken(data.token);
        addToast('Welcome back! ✨', 'success');
        onLogin();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-card scale-in" id="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '3rem' }}>🧞‍♂️</span>
        </div>
        <h1 className="page-title">Trip Genie</h1>
        <p className="page-subtitle">Your magical travel companion</p>

        <div className="auth-toggle" id="auth-toggle">
          <button type="button" className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')} id="toggle-login">Login</button>
          <button type="button" className={`auth-toggle-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')} id="toggle-register">Register</button>
        </div>

        {message && <div className={`message message-${message.type}`} id="auth-message">{message.text}</div>}

        <form onSubmit={handleSubmit} id="auth-form">
          {mode === 'register' && (
            <div className="form-group fade-in" key="name-field">
              <label className="form-label" htmlFor="auth-name">Name</label>
              <input className="form-input" id="auth-name" name="name" type="text" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="form-group fade-in delay-1">
            <label className="form-label" htmlFor="auth-email">Email</label>
            <input className="form-input" id="auth-email" name="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group fade-in delay-2">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input className="form-input" id="auth-password" name="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          <button type="submit" className="btn-primary fade-in delay-3" disabled={loading} id="auth-submit" style={{ marginTop: 8 }}>
            <span>{loading && <span className="spinner" />}{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create Trip Form (unchanged API)
// ─────────────────────────────────────────────
function CreateTripForm({ onCreated, addToast }) {
  const [form, setForm] = useState({ title: '', from: '', to: '', budget: '', people: '', days: '' });
  const [loading, setLoading] = useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trip = await api('/api/trips', {
        method: 'POST', auth: true,
        body: { title: form.title, from: form.from, to: form.to, budget: Number(form.budget), people: Number(form.people), days: Number(form.days) },
      });
      setForm({ title: '', from: '', to: '', budget: '', people: '', days: '' });
      onCreated(trip);
      addToast('Trip created! 🎉', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in-up">
      <h2 className="section-title"><span>🗺️</span> Create a Trip</h2>
      <form onSubmit={handleSubmit} id="create-trip-form">
        <div className="form-group">
          <label className="form-label" htmlFor="trip-title">Trip Title</label>
          <input className="form-input" id="trip-title" name="title" type="text" placeholder="e.g. Goa Summer Vibes" value={form.title} onChange={(e) => update('title', e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="trip-from">From</label>
            <input className="form-input" id="trip-from" name="from" type="text" placeholder="e.g. Mumbai" value={form.from} onChange={(e) => update('from', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="trip-to">To</label>
            <input className="form-input" id="trip-to" name="to" type="text" placeholder="e.g. Goa" value={form.to} onChange={(e) => update('to', e.target.value)} required />
          </div>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label" htmlFor="trip-budget">Budget (₹)</label>
            <input className="form-input" id="trip-budget" name="budget" type="number" placeholder="15000" min="0" value={form.budget} onChange={(e) => update('budget', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="trip-people">People</label>
            <input className="form-input" id="trip-people" name="people" type="number" placeholder="4" min="1" value={form.people} onChange={(e) => update('people', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="trip-days">Days</label>
            <input className="form-input" id="trip-days" name="days" type="number" placeholder="5" min="1" value={form.days} onChange={(e) => update('days', e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading} id="create-trip-btn" style={{ marginTop: 6 }}>
          <span>{loading && <span className="spinner" />}✨ Create New Trip</span>
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Join Trip Section
// ─────────────────────────────────────────────
function JoinTripSection({ addToast, onJoined }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const data = await api('/api/trips/join', { method: 'POST', auth: true, body: { code: code.trim() } });
      addToast('Joined trip successfully! 🎉', 'success');
      setCode('');
      if (onJoined) onJoined(data.trip || data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
      <input className="form-input" placeholder="Enter trip code to join…" value={code} onChange={e => setCode(e.target.value)} style={{ flex: 1 }} />
      <button type="submit" className="btn-small btn-accent" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
        {loading ? <span className="spinner" style={{ width: 14, height: 14, marginRight: 4 }} /> : null}Join
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Trip Card
// ─────────────────────────────────────────────
function TripCard({ trip, onClick, index }) {
  return (
    <div className={`trip-card fade-in-up delay-${Math.min(index + 1, 6)}`} onClick={onClick} id={`trip-card-${trip._id || trip.id || index}`} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="trip-card-title">{trip.title}</div>
      <div className="trip-card-route">
        <span>{trip.from}</span>
        <span className="arrow">→</span>
        <span>{trip.to}</span>
      </div>
      <div className="trip-card-meta">
        <span className="trip-meta-item"><span className="icon">💰</span> ₹{trip.budget?.toLocaleString()}</span>
        <span className="trip-meta-item"><span className="icon">👥</span> {trip.people}</span>
        <span className="trip-meta-item"><span className="icon">📅</span> {trip.days}d</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────
function OverviewTab({ trip, members, expenses }) {
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const tripId = trip._id || trip.id || '';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tripId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fade-in">
      {/* Quick Stats */}
      <div className="overview-stats">
        <div className="overview-stat">
          <span className="overview-stat-icon">🗺️</span>
          <div className="overview-stat-value">{trip.from} → {trip.to}</div>
          <div className="overview-stat-label">Route</div>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-icon">💰</span>
          <div className="overview-stat-value">₹{trip.budget?.toLocaleString()}</div>
          <div className="overview-stat-label">Budget</div>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-icon">👥</span>
          <div className="overview-stat-value">{members.length || trip.people}</div>
          <div className="overview-stat-label">People</div>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-icon">📅</span>
          <div className="overview-stat-value">{trip.days}</div>
          <div className="overview-stat-label">Days</div>
        </div>
      </div>

      {/* Spent vs Budget */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span>Spent: ₹{totalSpent.toLocaleString()}</span>
          <span>Budget: ₹{trip.budget?.toLocaleString()}</span>
        </div>
        <div style={{ height: 6, background: 'var(--input-bg)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--input-border)' }}>
          <div style={{
            height: '100%',
            width: `${Math.min((totalSpent / (trip.budget || 1)) * 100, 100)}%`,
            background: totalSpent > trip.budget ? 'var(--accent-red)' : 'var(--gradient-btn)',
            borderRadius: 8,
            transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      </div>

      {/* Members */}
      <h3 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
        <span>👥</span> Members
      </h3>
      {members.length > 0 ? (
        <div className="members-list">
          {members.map((m, i) => {
            const name = typeof m === 'string' ? m : (m.name || m.email || 'Member');
            return (
              <div className="member-badge" key={i}>
                <div className="member-avatar" style={{ background: avatarColor(name) }}>{initials(name)}</div>
                {name}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>No members info available</p>
      )}

      {/* Invite Code */}
      <h3 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12, marginTop: 8 }}>
        <span>🔗</span> Invite Friends
      </h3>
      <div className="invite-section">
        <span className="invite-label">Code:</span>
        <span className="invite-code">{tripId || 'N/A'}</span>
        <button className="btn-small" onClick={handleCopy} type="button">
          {copied ? <span className="copy-feedback">Copied!</span> : '📋 Copy'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Expenses Tab
// ─────────────────────────────────────────────
function ExpensesTab({ trip, expenses, setExpenses, addToast }) {
  const [form, setForm] = useState({ title: '', amount: '', paidBy: '', splitBetween: '' });
  const [loading, setLoading] = useState(false);
  const tripId = trip._id || trip.id;

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const expense = await api(`/api/trips/${tripId}/expenses`, {
        method: 'POST', auth: true,
        body: {
          title: form.title,
          amount: Number(form.amount),
          paidBy: form.paidBy,
          splitBetween: Number(form.splitBetween) || trip.people || 1,
        },
      });
      const newExp = expense.expense || expense;
      setExpenses(prev => [newExp, ...prev]);
      setForm({ title: '', amount: '', paidBy: '', splitBetween: '' });
      addToast('Expense added! 💸', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Smart Split Calculation
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const people = trip.people || 1;
  const perPerson = totalSpent / people;

  // Calculate per-payer totals
  const payerTotals = {};
  expenses.forEach(e => {
    const payer = e.paidBy || 'Unknown';
    payerTotals[payer] = (payerTotals[payer] || 0) + (e.amount || 0);
  });

  // Simplify debts
  const payers = Object.keys(payerTotals);
  const settlements = [];
  if (payers.length > 0 && totalSpent > 0) {
    // Each payer: balance = paid - fair share
    const balances = {};
    payers.forEach(p => {
      balances[p] = payerTotals[p] - perPerson;
    });
    // Greedy settle
    const debtors = [];
    const creditors = [];
    Object.entries(balances).forEach(([name, bal]) => {
      if (bal < -0.01) debtors.push({ name, amount: -bal });
      else if (bal > 0.01) creditors.push({ name, amount: bal });
    });
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    let di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
      if (transfer > 0.01) {
        settlements.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(transfer) });
      }
      debtors[di].amount -= transfer;
      creditors[ci].amount -= transfer;
      if (debtors[di].amount < 0.01) di++;
      if (creditors[ci].amount < 0.01) ci++;
    }
  }

  return (
    <div className="fade-in">
      {/* Add Expense Form */}
      <form onSubmit={handleAdd} style={{ marginBottom: 24 }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Expense</label>
            <input className="form-input" placeholder="e.g. Dinner 🍝" value={form.title} onChange={e => update('title', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" placeholder="500" min="1" value={form.amount} onChange={e => update('amount', e.target.value)} required />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Paid By</label>
            <input className="form-input" placeholder="e.g. Aman" value={form.paidBy} onChange={e => update('paidBy', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Split Between</label>
            <input className="form-input" type="number" placeholder={`${trip.people || 'All'}`} min="1" value={form.splitBetween} onChange={e => update('splitBetween', e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
          <span>{loading && <span className="spinner" />}💸 Add Expense</span>
        </button>
      </form>

      {/* Expense List */}
      {expenses.length > 0 ? (
        <>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}><span>📋</span> All Expenses</h3>
          <div className="expense-list">
            {expenses.map((exp, i) => (
              <div className="expense-card" key={exp._id || exp.id || i} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="expense-left">
                  <span className="expense-title">{exp.title}</span>
                  <span className="expense-paid">Paid by {exp.paidBy}</span>
                </div>
                <div className="expense-right">
                  <div className="expense-amount">₹{exp.amount?.toLocaleString()}</div>
                  <div className="expense-split">÷ {exp.splitBetween || people} people</div>
                </div>
              </div>
            ))}
          </div>

          {/* Split Summary */}
          <div className="split-summary" style={{ marginTop: 20 }}>
            <div className="split-total">
              <span>📊</span> Split Summary
            </div>
            <div className="split-row">
              <span className="split-owes">Total Spent</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{totalSpent.toLocaleString()}</span>
            </div>
            <div className="split-row">
              <span className="split-owes">Per Person (÷{people})</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{Math.round(perPerson).toLocaleString()}</span>
            </div>
            {payers.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
                {payers.map(p => (
                  <div className="split-row" key={p}>
                    <span className="split-owes">{p} paid</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{payerTotals[p].toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
            {settlements.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Settlements</div>
                {settlements.map((s, i) => (
                  <div className="split-row" key={i}>
                    <span className="split-owes">{s.from} owes {s.to}</span>
                    <span className="split-amount-negative">₹{s.amount.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state empty-state-small">
          <span className="empty-state-icon" style={{ fontSize: '2rem' }}>💸</span>
          <p>No expenses yet</p>
          <p style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--text-muted)' }}>Add your first expense above!</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Chat Tab
// ─────────────────────────────────────────────
function ChatTab({ trip, addToast }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const messagesEndRef = useRef(null);
  const tripId = trip._id || trip.id;
  const currentUser = getCurrentUser();

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api(`/api/trips/${tripId}/messages`, { auth: true });
      setMessages(Array.isArray(data) ? data : data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchMessages();
    // poll every 8s
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api(`/api/trips/${tripId}/messages`, {
        method: 'POST', auth: true,
        body: { text: text.trim() },
      });
      const newMsg = msg.message || msg;
      setMessages(prev => [...prev, newMsg]);
      setText('');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fade-in">
      <div className="chat-container">
        <div className="chat-messages">
          {loadingMsgs ? (
            <div className="empty-state empty-state-small" style={{ padding: '40px 0' }}>
              <span className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state empty-state-small" style={{ padding: '60px 0' }}>
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p style={{ marginTop: 8, fontSize: '0.9rem' }}>No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const sender = msg.sender?.name || msg.senderName || msg.sender || 'Unknown';
              const isOwn = sender === currentUser || msg.isOwn;
              return (
                <div key={msg._id || msg.id || i} className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}>
                  {!isOwn && <div className="chat-sender">{sender}</div>}
                  <div>{msg.text || msg.message}</div>
                  <div className="chat-time">{formatTime(msg.createdAt || msg.timestamp)}</div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input-bar" onSubmit={handleSend}>
          <input className="chat-input" placeholder="Type a message…" value={text} onChange={e => setText(e.target.value)} maxLength={500} />
          <button type="submit" className="chat-send-btn" disabled={sending || !text.trim()}>
            {sending ? <span className="spinner" style={{ width: 14, height: 14, marginRight: 0 }} /> : 'Send ✨'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Media Tab
// ─────────────────────────────────────────────
function MediaTab({ trip, addToast }) {
  const [media, setMedia] = useState([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const tripId = trip._id || trip.id;

  const fetchMedia = useCallback(async () => {
    try {
      const data = await api(`/api/trips/${tripId}/media`, { auth: true });
      setMedia(Array.isArray(data) ? data : data.media || []);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoadingMedia(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const item = await api(`/api/trips/${tripId}/media`, {
        method: 'POST', auth: true,
        body: { url: url.trim() },
      });
      const newItem = item.media || item;
      setMedia(prev => [...prev, newItem]);
      setUrl('');
      addToast('Memory saved! 📸', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <form onSubmit={handleUpload} className="media-upload-zone">
        <input className="form-input" placeholder="Paste image URL…" value={url} onChange={e => setUrl(e.target.value)} type="url" />
        <button type="submit" className="btn-small btn-accent" disabled={loading} style={{ padding: '12px 20px' }}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14, marginRight: 0 }} /> : '📸 Add'}
        </button>
      </form>

      {loadingMedia ? (
        <div className="empty-state empty-state-small">
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      ) : media.length === 0 ? (
        <div className="empty-state empty-state-small">
          <span className="empty-state-icon" style={{ fontSize: '2rem' }}>📸</span>
          <p>No memories yet</p>
          <p style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--text-muted)' }}>Add image URLs to build your gallery!</p>
        </div>
      ) : (
        <div className="media-gallery">
          {media.map((item, i) => {
            const imageUrl = typeof item === 'string' ? item : (item.url || item.imageUrl || '');
            return (
              <div className="media-item fade-in" key={item._id || item.id || i} style={{ animationDelay: `${i * 0.05}s` }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={`Memory ${i + 1}`} loading="lazy" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div className="media-placeholder" style={{ display: imageUrl ? 'none' : 'flex' }}>📷</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Itinerary Tab (AI Planner)
// ─────────────────────────────────────────────
function ItineraryTab({ trip, addToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addingDay, setAddingDay] = useState(null);
  const tripId = trip._id || trip.id;

  const fetchItinerary = useCallback(async () => {
    try {
      const data = await api(`/api/trips/${tripId}/itinerary`, { auth: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load itinerary:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchItinerary();
  }, [fetchItinerary]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await api(`/api/trips/${tripId}/itinerary/generate`, {
        method: 'POST', auth: true,
        body: { from: trip.from, to: trip.to, days: trip.days, budget: trip.budget, people: trip.people },
      });
      setItems(Array.isArray(data) ? data : []);
      addToast('Itinerary generated! ✨', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to generate', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (itemId) => {
    try {
      await api(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: 'DELETE', auth: true,
      });
      setItems(prev => prev.filter(i => (i._id || i.id) !== itemId));
      addToast('Item removed 🗑️', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleEdit = async (itemId, updates) => {
    try {
      const updated = await api(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: 'PUT', auth: true,
        body: updates,
      });
      setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, ...updated } : i));
      setEditItem(null);
      addToast('Item updated ✏️', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAdd = async (dayNumber, newItem) => {
    try {
      const added = await api(`/api/trips/${tripId}/itinerary`, {
        method: 'POST', auth: true,
        body: { ...newItem, dayNumber },
      });
      setItems(prev => [...prev, added]);
      setAddingDay(null);
      addToast('Activity added! 🎯', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Group by day
  const dayMap = {};
  items.forEach(item => {
    const d = item.dayNumber || 1;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(item);
  });
  const dayNumbers = Object.keys(dayMap).map(Number).sort((a, b) => a - b);
  // If no items, show days based on trip
  const totalDays = Math.max(trip.days || 1, ...dayNumbers, 0);

  const timeSlotOrder = { morning: 0, afternoon: 1, evening: 2 };

  if (loading) {
    return (
      <div className="empty-state empty-state-small" style={{ padding: '60px 0' }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="itinerary-header">
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            🗺️ Trip Itinerary
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {items.length > 0
              ? `${items.length} activities across ${dayNumbers.length} day${dayNumbers.length !== 1 ? 's' : ''}`
              : 'Generate an AI-powered plan for your trip!'
            }
          </p>
        </div>
        <button
          className="btn-generate"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} /> Generating...</>
          ) : (
            items.length > 0 ? '🔄 Regenerate' : '✨ Generate with AI'
          )}
        </button>
      </div>

      {items.length === 0 && !generating ? (
        <div className="empty-state empty-state-small" style={{ padding: '60px 0' }}>
          <span style={{ fontSize: '2.5rem' }}>🤖</span>
          <p style={{ marginTop: 12, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            No itinerary yet
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Click "Generate with AI" to create a personalized plan for {trip.to || 'your destination'}
          </p>
        </div>
      ) : (
        <div className="itinerary-days">
          {dayNumbers.map(day => {
            const dayItems = (dayMap[day] || []).sort(
              (a, b) => (timeSlotOrder[a.timeSlot] ?? 9) - (timeSlotOrder[b.timeSlot] ?? 9)
            );
            return (
              <div key={day} className="itinerary-day" style={{ animationDelay: `${(day - 1) * 0.08}s` }}>
                <div className="day-header">
                  <span className="day-label">
                    📅 Day {day}
                    <span className="day-badge">{dayItems.length} activities</span>
                  </span>
                </div>
                <div className="day-items">
                  {dayItems.map((item, i) => (
                    <div key={item._id || item.id || i} className="itinerary-card" style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="itin-time">
                        <span className={`itin-time-badge itin-time-${item.timeSlot || 'morning'}`}>
                          {item.timeSlot || 'morning'}
                        </span>
                      </div>
                      <div className="itin-content">
                        <div className="itin-title">
                          {item.title}
                          <span className={`itin-type-badge itin-type-${item.type || 'activity'}`}>
                            {item.type || 'activity'}
                          </span>
                        </div>
                        {item.description && <div className="itin-desc">{item.description}</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          {item.place && (
                            <span className="itin-place" style={{ margin: 0 }}>📍 {item.place}</span>
                          )}
                          {item.estimatedCost && (
                            <span className="itin-cost-badge">💰 {item.estimatedCost}</span>
                          )}
                        </div>
                        {item.travelTip && (
                          <div className="itin-travel-tip">🚗 {item.travelTip}</div>
                        )}
                      </div>
                      <div className="itin-actions">
                        <button className="itin-action-btn" title="Edit" onClick={() => setEditItem(item)}>✏️</button>
                        <button className="itin-action-btn delete" title="Delete" onClick={() => handleDelete(item._id || item.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  {addingDay === day ? (
                    <AddItemForm dayNumber={day} onAdd={handleAdd} onCancel={() => setAddingDay(null)} />
                  ) : (
                    <button className="itin-add-btn" onClick={() => setAddingDay(day)}>
                      + Add activity to Day {day}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <EditItemModal
          item={editItem}
          onSave={(updates) => handleEdit(editItem._id || editItem.id, updates)}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Add Item Form (inline)
// ─────────────────────────────────────────────
function AddItemForm({ dayNumber, onAdd, onCancel }) {
  const [form, setForm] = useState({ title: '', description: '', place: '', timeSlot: 'morning', type: 'activity' });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await onAdd(dayNumber, form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="itinerary-card" style={{ flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select className="form-input" value={form.timeSlot} onChange={e => update('timeSlot', e.target.value)} style={{ padding: '10px 12px' }}>
          <option value="morning">🌅 Morning</option>
          <option value="afternoon">☀️ Afternoon</option>
          <option value="evening">🌙 Evening</option>
        </select>
        <select className="form-input" value={form.type} onChange={e => update('type', e.target.value)} style={{ padding: '10px 12px' }}>
          <option value="activity">🎯 Activity</option>
          <option value="sightseeing">🏛️ Sightseeing</option>
          <option value="food">🍜 Food</option>
          <option value="travel">🚗 Travel</option>
          <option value="shopping">🛍️ Shopping</option>
          <option value="rest">😴 Rest</option>
        </select>
      </div>
      <input className="form-input" placeholder="Activity title…" value={form.title} onChange={e => update('title', e.target.value)} required />
      <input className="form-input" placeholder="Description (optional)" value={form.description} onChange={e => update('description', e.target.value)} />
      <input className="form-input" placeholder="📍 Place name (optional)" value={form.place} onChange={e => update('place', e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✅ Add'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ padding: '10px 16px' }}>Cancel</button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────
// Edit Item Modal
// ─────────────────────────────────────────────
function EditItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    title: item.title || '',
    description: item.description || '',
    place: item.place || '',
    timeSlot: item.timeSlot || 'morning',
    type: item.type || 'activity',
  });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <h3 className="modal-title">✏️ Edit Activity</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label className="form-label">Time Slot</label>
                <select className="form-input" value={form.timeSlot} onChange={e => update('timeSlot', e.target.value)}>
                  <option value="morning">🌅 Morning</option>
                  <option value="afternoon">☀️ Afternoon</option>
                  <option value="evening">🌙 Evening</option>
                </select>
              </div>
              <div>
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="activity">🎯 Activity</option>
                  <option value="sightseeing">🏛️ Sightseeing</option>
                  <option value="food">🍜 Food</option>
                  <option value="travel">🚗 Travel</option>
                  <option value="shopping">🛍️ Shopping</option>
                  <option value="rest">😴 Rest</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Title</label>
              <input className="form-input" value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Place</label>
              <input className="form-input" value={form.place} onChange={e => update('place', e.target.value)} placeholder="📍 Place or area name" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Trip Detail View (Tabbed)
// ─────────────────────────────────────────────
function TripDetail({ trip, onBack, addToast }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const tripId = trip._id || trip.id;

  // Fetch expenses for overview + expense tab
  const fetchExpenses = useCallback(async () => {
    try {
      const data = await api(`/api/trips/${tripId}/expenses`, { auth: true });
      setExpenses(Array.isArray(data) ? data : data.expenses || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [tripId]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    try {
      const data = await api(`/api/trips/${tripId}/members`, { auth: true });
      setMembers(Array.isArray(data) ? data : data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }, [tripId]);

  useEffect(() => {
    fetchExpenses();
    fetchMembers();
  }, [fetchExpenses, fetchMembers]);
  const tabs = [
    { key: 'overview', label: '📋 Overview' },
    { key: 'itinerary', label: '🤖 Itinerary' },
    { key: 'expenses', label: '💸 Expenses' },
    { key: 'chat', label: '💬 Chat' },
    { key: 'media', label: '📸 Media' },
  ];

  return (
    <div className="trip-detail scale-in" id="trip-detail-view">
      <div className="trip-detail-header">
        <button className="btn-secondary" onClick={onBack} id="back-btn">← Back</button>
        <h2 className="trip-detail-title">{trip.title}</h2>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar" id="trip-tabs">
        {tabs.map(t => (
          <button key={t.key} type="button" className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card glass-card-wide fade-in-up" style={{ maxWidth: '100%' }}>
        {activeTab === 'overview' && (
          <OverviewTab trip={trip} members={members} expenses={expenses} />
        )}

        {activeTab === 'expenses' && (
          loadingExpenses ? (
            <div className="empty-state empty-state-small"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
          ) : (
            <ExpensesTab trip={trip} expenses={expenses} setExpenses={setExpenses} addToast={addToast} />
          )
        )}

        {activeTab === 'chat' && (
          <ChatTab trip={trip} addToast={addToast} />
        )}

        {activeTab === 'itinerary' && (
          <ItineraryTab trip={trip} addToast={addToast} />
        )}

        {activeTab === 'media' && (
          <MediaTab trip={trip} addToast={addToast} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
function Dashboard({ onLogout, addToast }) {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const fetchTrips = useCallback(async () => {
    try {
      const data = await api('/api/trips', { auth: true });
      setTrips(Array.isArray(data) ? data : data.trips || []);
    } catch (err) {
      console.error('Failed to fetch trips:', err);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleTripCreated = (newTrip) => {
    const trip = newTrip.trip || newTrip;
    setTrips(prev => [trip, ...prev]);
  };

  const handleTripJoined = (trip) => {
    if (trip) setTrips(prev => [trip, ...prev]);
    else fetchTrips(); // refetch if joined trip shape unclear
  };

  // Dashboard Insights
  const totalTrips = trips.length;
  const totalBudget = trips.reduce((s, t) => s + (t.budget || 0), 0);
  const totalDays = trips.reduce((s, t) => s + (t.days || 0), 0);

  // ── Trip Detail View ──
  if (selectedTrip) {
    return (
      <div className="app-container">
        <TripDetail trip={selectedTrip} onBack={() => setSelectedTrip(null)} addToast={addToast} />
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }} className="fade-in">
        <span style={{ fontSize: '3.2rem' }}>🧞‍♂️</span>
      </div>
      <h1 className="page-title fade-in">Welcome to Trip Genie ✨</h1>
      <p className="page-subtitle fade-in delay-1">Plan your next adventure like magic</p>

      {/* Dashboard Insights */}
      {!loadingTrips && trips.length > 0 && (
        <div className="stats-row fade-in-up delay-2" id="dashboard-stats">
          <div className="stat-card">
            <span className="stat-icon">🧳</span>
            <div className="stat-value">{totalTrips}</div>
            <div className="stat-label">Total Trips</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-value">₹{totalBudget.toLocaleString()}</div>
            <div className="stat-label">Total Budget</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📅</span>
            <div className="stat-value">{totalDays}</div>
            <div className="stat-label">Adventure Days</div>
          </div>
        </div>
      )}

      {/* Create Trip + Join Trip */}
      <div className="glass-card glass-card-wide fade-in-up delay-2" id="create-trip-section">
        <CreateTripForm onCreated={handleTripCreated} addToast={addToast} />
        <div className="divider" />
        <h3 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>
          <span>🔗</span> Join a Trip
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Got a trip code from a friend?</p>
        <JoinTripSection addToast={addToast} onJoined={handleTripJoined} />
      </div>

      {/* Divider */}
      <div className="divider" style={{ maxWidth: 800 }} />

      {/* Trips List */}
      <div style={{ width: '100%', maxWidth: 800 }}>
        <h2 className="section-title fade-in delay-3">
          <span>🧳</span> Your Trips
        </h2>

        {loadingTrips ? (
          <div className="empty-state">
            <span className="spinner" style={{ width: 28, height: 28 }} />
            <p style={{ marginTop: 12 }}>Loading your trips…</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="empty-state fade-in" id="no-trips">
            <span className="empty-state-icon">😔</span>
            <p>No trips yet</p>
            <p style={{ fontSize: '0.9rem', marginTop: 4 }}>Create your first adventure above!</p>
          </div>
        ) : (
          <div className="trips-grid" id="trips-list">
            {trips.map((trip, i) => (
              <TripCard key={trip._id || trip.id || i} trip={trip} index={i} onClick={() => setSelectedTrip(trip)} />
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <button className="btn-logout fade-in delay-5" onClick={onLogout} id="logout-btn">
        🚪 Logout
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const { addToast, ToastContainer } = useToast();

  const handleLogin = () => setAuthed(true);
  const handleLogout = () => {
    clearToken();
    setAuthed(false);
    addToast('Logged out successfully', 'info');
  };

  return (
    <>
      <Blobs />
      <ToastContainer />
      {authed ? (
        <Dashboard onLogout={handleLogout} addToast={addToast} />
      ) : (
        <AuthPage onLogin={handleLogin} addToast={addToast} />
      )}
    </>
  );
}
