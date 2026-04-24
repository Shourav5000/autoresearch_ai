import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const AGENTS = [
  { id: 'planner',     label: 'Planner',     emoji: '🗂️', color: '#00e5a0', what: 'Breaks your question into focused sub-tasks',  doing: 'Breaking down your question...' },
  { id: 'researcher',  label: 'Researcher',  emoji: '🔍', color: '#4da6ff', what: 'Searches the web and summarizes findings',      doing: 'Searching the web...' },
  { id: 'critic',      label: 'Critic',      emoji: '🧐', color: '#f5a623', what: 'Reviews quality and identifies gaps',           doing: 'Checking research quality...' },
  { id: 'synthesizer', label: 'Synthesizer', emoji: '✍️', color: '#c77dff', what: 'Writes your final structured report',          doing: 'Writing your report...' },
]

const PHASE_ORDER = ['planner', 'researcher', 'critic', 'synthesizer']
const PHASE_MAP   = { planning: 'planner', researching: 'researcher', critiquing: 'critic', synthesizing: 'synthesizer', complete: 'synthesizer' }
const EXAMPLES    = [
  'Latest breakthroughs in protein folding AI',
  'How does RAG compare to fine-tuning LLMs?',
  'State of quantum computing in 2025',
  'How do multi-agent AI systems work?',
]

// ── History helpers ───────────────────────────────────────────
const HISTORY_KEY = 'autoresearch_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function saveToHistory(entry) {
  const history = loadHistory()
  const updated = [entry, ...history].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  return updated
}

function deleteFromHistory(id) {
  const history = loadHistory().filter(h => h.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

// ── PDF Export ────────────────────────────────────────────────
function downloadPDF(query, report, sources) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const reportHtml = report
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')

  const sourcesHtml = sources.slice(0, 20).map((s, i) =>
    `<div class="source"><span class="src-num">${i + 1}</span><div><div class="src-title">${s.title}</div><div class="src-url">${s.url}</div></div></div>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${query}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.8; color: #1a1a1a; max-width: 780px; margin: 0 auto; padding: 60px 50px; }
  .cover { border-bottom: 2px solid #000; padding-bottom: 30px; margin-bottom: 40px; }
  .brand { font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #666; margin-bottom: 20px; }
  .cover h1 { font-size: 26px; font-weight: 700; line-height: 1.25; margin-bottom: 12px; }
  .meta { font-family: Arial, sans-serif; font-size: 11px; color: #888; }
  h1 { font-size: 22px; font-weight: 700; margin: 36px 0 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
  h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #007a5a; margin: 28px 0 8px; }
  h3 { font-size: 14px; font-weight: 700; margin: 20px 0 6px; }
  p { margin-bottom: 12px; }
  ul { padding-left: 20px; margin-bottom: 12px; }
  li { margin-bottom: 4px; }
  strong { font-weight: 700; }
  .sources-section { margin-top: 40px; border-top: 2px solid #000; padding-top: 24px; }
  .sources-section h2 { font-size: 14px; color: #000; margin-bottom: 16px; }
  .source { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start; }
  .src-num { font-family: Arial, sans-serif; font-size: 10px; color: #888; min-width: 20px; margin-top: 2px; }
  .src-title { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
  .src-url { font-size: 10px; color: #888; word-break: break-all; }
  @media print { body { padding: 40px; } }
</style>
</head>
<body>
  <div class="cover">
    <div class="brand">⬡ AutoResearch · AI Research Report</div>
    <h1>${query}</h1>
    <div class="meta">Generated ${date} · ${sources.length} sources · autoresearch-ai-three.vercel.app</div>
  </div>
  <div class="report-content">${reportHtml}</div>
  <div class="sources-section">
    <h2>Sources (${sources.length})</h2>
    ${sourcesHtml}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) {
    win.onload = () => {
      win.print()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }
}

// ── Sub-components ────────────────────────────────────────────
function ProgressBar({ agentPhase, complete }) {
  const idx = PHASE_ORDER.indexOf(PHASE_MAP[agentPhase] || 'planner')
  const pct = complete ? 100 : Math.round(((idx + 0.5) / 4) * 100)
  return (
    <div className="prog-wrap">
      <div className="prog-track"><div className="prog-fill" style={{ width: pct + '%' }} /></div>
      <span className="prog-label">{complete ? 'Complete!' : pct + '%'}</span>
    </div>
  )
}

function AgentRow({ agent, status, lastLog }) {
  const isActive = status === 'active'
  const isDone   = status === 'done'
  return (
    <div className={`arow arow-${status}`}>
      <div className="arow-emoji">{agent.emoji}</div>
      <div className="arow-body">
        <div className="arow-top">
          <span className="arow-name">{agent.label}</span>
          <span className={`apill apill-${status}`}>{isActive ? 'Working' : isDone ? 'Done' : 'Waiting'}</span>
        </div>
        <div className="arow-desc">{isActive && lastLog ? lastLog : agent.what}</div>
      </div>
      {isActive && <div className="arow-spinner" />}
      {isDone   && <span className="arow-check">✓</span>}
    </div>
  )
}

function LogFeed({ logs }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs.length])
  const col = { planner: '#00e5a0', researcher: '#4da6ff', critic: '#f5a623', synthesizer: '#c77dff' }
  return (
    <div className="logfeed">
      {!logs.length && <p className="log-empty">Agent activity will stream here in real time...</p>}
      {logs.map((l, i) => (
        <div key={i} className="logline">
          <span className="logbadge" style={{ background: col[l.agent] + '22', color: col[l.agent] }}>{l.agent}</span>
          <span className="logtext">{l.message}</span>
        </div>
      ))}
      <div ref={ref} />
    </div>
  )
}

function HistoryPanel({ history, onSelect, onDelete, onClose }) {
  if (!history.length) return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">Research History</span>
        <button className="history-close" onClick={onClose}>✕</button>
      </div>
      <div className="history-empty">No research yet. Your completed reports will appear here.</div>
    </div>
  )
  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">Research History</span>
        <button className="history-close" onClick={onClose}>✕</button>
      </div>
      <div className="history-list">
        {history.map(h => (
          <div key={h.id} className="history-item" onClick={() => onSelect(h)}>
            <div className="history-query">{h.query}</div>
            <div className="history-meta">{h.date} · {h.wordCount} words · {h.sourceCount} sources</div>
            <button className="history-delete" onClick={e => { e.stopPropagation(); onDelete(h.id) }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mobile Sidebar Drawer ─────────────────────────────────────
function SidebarDrawer({ onClose, children }) {
  return (
    <div className="sidebar-drawer">
      <div className="sidebar-drawer-backdrop" onClick={onClose} />
      <div className="sidebar-drawer-panel">
        <div className="drawer-header">
          <span className="drawer-title">Research Status</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]           = useState('')
  const [phase, setPhase]           = useState('idle')
  const [agentPhase, setAgentPhase] = useState('')
  const [logs, setLogs]             = useState([])
  const [tasks, setTasks]           = useState([])
  const [report, setReport]         = useState('')
  const [sources, setSources]       = useState([])
  const [iterations, setIterations] = useState(0)
  const [error, setError]           = useState('')
  const [tab, setTab]               = useState('agents')
  const [history, setHistory]       = useState(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)

  const getStatus = (id) => {
    if (phase === 'idle') return 'idle'
    if (phase === 'complete') return 'done'
    const cur = PHASE_MAP[agentPhase]
    const ci  = PHASE_ORDER.indexOf(cur)
    const ai  = PHASE_ORDER.indexOf(id)
    if (ai < ci) return 'done'
    if (ai === ci) return 'active'
    return 'idle'
  }

  const lastLog = (id) => {
    const al = logs.filter(l => l.agent === id)
    return al.length ? al[al.length - 1].message : ''
  }

  const handleEvent = (ev) => {
    switch (ev.type) {
      case 'phase':
        setAgentPhase(ev.data.phase)
        if (ev.data.phase === 'complete') { setPhase('complete'); setTab('report') }
        break
      case 'log':   setLogs(p => [...p, ev.data]); break
      case 'complete':
        setReport(ev.data.report || '')
        setSources(ev.data.sources || [])
        setTasks(ev.data.tasks || [])
        setIterations(ev.data.iterations || 0)
        setPhase('complete'); setAgentPhase('complete'); setTab('report')
        const entry = {
          id: Date.now().toString(),
          query: query.trim(),
          report: ev.data.report || '',
          sources: ev.data.sources || [],
          tasks: ev.data.tasks || [],
          iterations: ev.data.iterations || 0,
          date: new Date().toLocaleDateString(),
          wordCount: (ev.data.report || '').split(' ').length,
          sourceCount: (ev.data.sources || []).length,
        }
        setHistory(saveToHistory(entry))
        break
      case 'error': setError(ev.data.message); setPhase('error'); break
    }
  }

  const run = async () => {
    if (!query.trim() || phase === 'running') return
    setPhase('running'); setAgentPhase('planning')
    setLogs([]); setTasks([]); setReport(''); setSources([])
    setIterations(0); setError(''); setTab('agents')
    setShowHistory(false); setShowDrawer(false)

    try {
      const res = await fetch('/research/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try { handleEvent(JSON.parse(line.slice(6).trim())) } catch {}
        }
      }
    } catch {
      try {
        const res  = await fetch('/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
        })
        const data = await res.json()
        const ev = { type: 'complete', data }
        setLogs(data.logs || [])
        setTasks(data.tasks || [])
        handleEvent(ev)
      } catch (e) { setError(e.message); setPhase('error') }
    }
  }

  const loadHistoryItem = (item) => {
    setQuery(item.query)
    setReport(item.report)
    setSources(item.sources)
    setTasks(item.tasks)
    setIterations(item.iterations)
    setLogs([])
    setPhase('complete')
    setAgentPhase('complete')
    setTab('report')
    setShowHistory(false)
  }

  const handleDeleteHistory = (id) => {
    setHistory(deleteFromHistory(id))
  }

  const handlePDF = () => {
    setPdfLoading(true)
    setTimeout(() => {
      downloadPDF(query, report, sources)
      setPdfLoading(false)
    }, 100)
  }

  const reset = () => {
    setPhase('idle'); setAgentPhase(''); setLogs([]); setTasks([])
    setReport(''); setSources([]); setError(''); setQuery(''); setTab('agents')
    setShowHistory(false); setShowDrawer(false)
  }

  const running  = phase === 'running'
  const complete = phase === 'complete'

  // Shared sidebar content (used in both desktop sidebar and mobile drawer)
  const SidebarContent = () => (
    <>
      <div className="sb-section">
        <div className="sb-label">Your question</div>
        <div className="sb-query">{query}</div>
      </div>
      {running && (
        <div className="sb-section">
          <div className="sb-label">Overall progress</div>
          <ProgressBar agentPhase={agentPhase} complete={false} />
        </div>
      )}
      <div className="sb-section">
        <div className="sb-label">What each agent is doing</div>
        <div className="agent-list">
          {AGENTS.map(a => (
            <AgentRow key={a.id} agent={a} status={getStatus(a.id)} lastLog={lastLog(a.id)} />
          ))}
        </div>
      </div>
      {complete && (
        <div className="sb-section">
          <div className="sb-label">Report stats</div>
          <div className="stat-grid">
            {[
              { n: report.split(' ').length, l: 'words' },
              { n: sources.length,           l: 'sources' },
              { n: tasks.length,             l: 'sub-tasks' },
              { n: iterations,               l: 'review loops' },
            ].map(s => (
              <div key={s.l} className="stat-box">
                <span className="stat-n">{s.n}</span>
                <span className="stat-l">{s.l}</span>
              </div>
            ))}
          </div>
          <button className="btn-pdf" onClick={handlePDF} disabled={pdfLoading}>
            {pdfLoading ? '⏳ Preparing...' : '⬇ Download PDF'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className="app">
      {/* Header */}
      <header className="hdr">
        <div className="hdr-left">
          <span className="brand-hex">⬡</span>
          <span className="brand-name">AutoResearch</span>
          <span className="brand-tag">Multi-Agent AI</span>
        </div>
        <div className="hdr-right">
          {history.length > 0 && (
            <button className={`btn-ghost ${showHistory ? 'active' : ''}`} onClick={() => setShowHistory(v => !v)}>
              🕐 History ({history.length})
            </button>
          )}
          {phase !== 'idle' && <button className="btn-ghost" onClick={reset}>← New</button>}
        </div>
      </header>

      {/* History panel overlay */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onSelect={loadHistoryItem}
          onDelete={handleDeleteHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* ── IDLE ── */}
      {phase === 'idle' && (
        <div className="hero">
          <div className="hero-inner">
            <div className="hero-badge">LangGraph · Claude · Tavily</div>
            <h1 className="hero-h1">Research anything,<br />in minutes.</h1>
            <p className="hero-p">
              Ask any question. Four AI agents collaborate — planning, searching,
              fact-checking, and writing — to deliver a comprehensive cited report.
            </p>
            <div className="how-strip">
              {AGENTS.map((a, i) => (
                <div key={a.id} className="how-step">
                  <div className="how-num" style={{ background: a.color + '20', color: a.color }}>{i + 1}</div>
                  <div className="how-name">{a.emoji} {a.label}</div>
                  <div className="how-desc">{a.what}</div>
                </div>
              ))}
            </div>
            <div className="input-card">
              <label className="input-label">Your research question</label>
              <textarea
                className="q-input" rows={3}
                placeholder="e.g. What are the latest breakthroughs in AI agents?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
              />
              <div className="input-footer">
                <span className="input-hint">Tip: Ctrl + Enter to run</span>
                <button className="btn-run" onClick={run} disabled={!query.trim()}>Run Research →</button>
              </div>
            </div>
            <div className="examples">
              <span className="ex-label">Try:</span>
              {EXAMPLES.map(q => (
                <button key={q} className="ex-chip" onClick={() => setQuery(q)}>{q}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── WORKSPACE ── */}
      {phase !== 'idle' && (
        <div className="workspace">

          {/* Mobile status bar */}
          <div className="mobile-status-bar">
            <span className="mobile-status-query">{query}</span>
            <div className="mobile-agent-pills">
              {AGENTS.map(a => (
                <span key={a.id} className={`mobile-agent-pill ${getStatus(a.id)}`}>
                  {a.emoji}
                </span>
              ))}
            </div>
            <button className="sidebar-toggle" onClick={() => setShowDrawer(true)}>
              Details
            </button>
          </div>

          {/* Desktop sidebar */}
          <aside className="sidebar">
            <SidebarContent />
          </aside>

          {/* Mobile drawer */}
          {showDrawer && (
            <SidebarDrawer onClose={() => setShowDrawer(false)}>
              <SidebarContent />
            </SidebarDrawer>
          )}

          <main className="main">
            <div className="tabs">
              <button className={`tab ${tab === 'agents' ? 'tab-on' : ''}`} onClick={() => setTab('agents')}>
                {running ? '⚡ Live' : '📋 Log'}
              </button>
              <button className={`tab ${tab === 'tasks' ? 'tab-on' : ''}`} onClick={() => setTab('tasks')} disabled={!tasks.length}>
                🗂 Tasks {tasks.length ? `(${tasks.length})` : ''}
              </button>
              <button className={`tab ${tab === 'report' ? 'tab-on' : ''}`} onClick={() => setTab('report')} disabled={!report}>
                📄 Report {complete ? '✓' : ''}
              </button>
              <button className={`tab ${tab === 'sources' ? 'tab-on' : ''}`} onClick={() => setTab('sources')} disabled={!sources.length}>
                🔗 Sources {sources.length ? `(${sources.length})` : ''}
              </button>
            </div>

            <div className="tab-body">
              {tab === 'agents' && (
                <div>
                  {running && <div className="live-banner"><span className="live-dot" /> Agents working — activity streams in automatically</div>}
                  {complete && <div className="done-banner">✓ Research complete — switch to the Report tab to read your results</div>}
                  <LogFeed logs={logs} />
                </div>
              )}
              {tab === 'tasks' && (
                <div className="task-section">
                  <p className="tab-intro">The Planner broke your question into {tasks.length} focused sub-questions:</p>
                  {tasks.map((t, i) => (
                    <div key={t.id} className={`task-card ${t.status === 'done' ? 'task-done' : ''}`}>
                      <span className="task-n">{i + 1}</span>
                      <span className="task-q">{t.question}</span>
                      {t.status === 'done' && <span className="task-tick">✓</span>}
                    </div>
                  ))}
                </div>
              )}
              {tab === 'report' && report && (
                <div className="report-wrap">
                  <div className="report-meta-bar">
                    <span>AI-generated · {report.split(' ').length} words · {sources.length} sources</span>
                    <button className="btn-pdf-inline" onClick={handlePDF} disabled={pdfLoading}>
                      {pdfLoading ? 'Preparing...' : '⬇ Download PDF'}
                    </button>
                  </div>
                  <div className="report-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                  </div>
                </div>
              )}
              {tab === 'report' && !report && (
                <div className="empty-state">
                  <div className="spinner" />
                  <p>Your report will appear here when all agents finish...</p>
                </div>
              )}
              {tab === 'sources' && (
                <div className="sources-section">
                  <p className="tab-intro">{sources.length} web sources used to build your report:</p>
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="src-row">
                      <span className="src-i">{i + 1}</span>
                      <div className="src-info">
                        <div className="src-title">{s.title}</div>
                        <div className="src-domain">{s.source}</div>
                      </div>
                      <span className="src-arr">↗</span>
                    </a>
                  ))}
                </div>
              )}
              {phase === 'error' && (
                <div className="error-box">
                  <div className="error-title">Something went wrong</div>
                  <div className="error-msg">{error || 'Could not connect to the backend. Make sure python run.py is still running.'}</div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
