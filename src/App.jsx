import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const AGENTS = [
  { id: 'planner',     label: 'Planner',     emoji: '🗂️', color: '#00e5a0', what: 'Breaks your question into focused sub-tasks',    doing: 'Breaking down your question...' },
  { id: 'researcher',  label: 'Researcher',  emoji: '🔍', color: '#4da6ff', what: 'Searches the web and summarizes findings',        doing: 'Searching the web...' },
  { id: 'critic',      label: 'Critic',      emoji: '🧐', color: '#f5a623', what: 'Reviews quality and identifies gaps',             doing: 'Checking research quality...' },
  { id: 'synthesizer', label: 'Synthesizer', emoji: '✍️', color: '#c77dff', what: 'Writes your final structured report',            doing: 'Writing your report...' },
]

const PHASE_ORDER = ['planner', 'researcher', 'critic', 'synthesizer']
const PHASE_MAP   = { planning: 'planner', researching: 'researcher', critiquing: 'critic', synthesizing: 'synthesizer', complete: 'synthesizer' }
const EXAMPLES    = [
  'Latest breakthroughs in protein folding AI',
  'How does RAG compare to fine-tuning LLMs?',
  'State of quantum computing in 2025',
  'How do multi-agent AI systems work?',
]

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
        break
      case 'error': setError(ev.data.message); setPhase('error'); break
    }
  }

  const run = async () => {
    if (!query.trim() || phase === 'running') return
    setPhase('running'); setAgentPhase('planning')
    setLogs([]); setTasks([]); setReport(''); setSources([])
    setIterations(0); setError(''); setTab('agents')

    try {
      const res = await fetch('/research/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim() }) })
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
        const res  = await fetch('/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim() }) })
        const data = await res.json()
        setLogs(data.logs || []); setTasks(data.tasks || []); setReport(data.report || '')
        setSources(data.sources || []); setIterations(data.iterations || 0)
        setAgentPhase('complete'); setPhase('complete'); setTab('report')
      } catch (e) { setError(e.message); setPhase('error') }
    }
  }

  const reset = () => {
    setPhase('idle'); setAgentPhase(''); setLogs([]); setTasks([])
    setReport(''); setSources([]); setError(''); setQuery(''); setTab('agents')
  }

  const running  = phase === 'running'
  const complete = phase === 'complete'

  return (
    <div className="app">

      {/* Header */}
      <header className="hdr">
        <div className="hdr-left">
          <span className="brand-hex">⬡</span>
          <span className="brand-name">AutoResearch</span>
          <span className="brand-tag">Multi-Agent AI</span>
        </div>
        {phase !== 'idle' && <button className="btn-ghost" onClick={reset}>← New research</button>}
      </header>

      {/* ── IDLE: hero screen ── */}
      {phase === 'idle' && (
        <div className="hero">
          <div className="hero-inner">
            <div className="hero-badge">LangGraph · Claude · Tavily</div>
            <h1 className="hero-h1">Research anything,<br />in minutes.</h1>
            <p className="hero-p">
              Ask any question. Four AI agents collaborate — planning, searching,
              fact-checking, and writing — to deliver a comprehensive cited report.
            </p>

            {/* How it works */}
            <div className="how-strip">
              {AGENTS.map((a, i) => (
                <div key={a.id} className="how-step">
                  <div className="how-num" style={{ background: a.color + '20', color: a.color }}>{i + 1}</div>
                  <div className="how-name">{a.emoji} {a.label}</div>
                  <div className="how-desc">{a.what}</div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="input-card">
              <label className="input-label">Your research question</label>
              <textarea
                className="q-input"
                rows={3}
                placeholder="e.g. What are the latest breakthroughs in AI agents?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
              />
              <div className="input-footer">
                <span className="input-hint">Tip: Ctrl + Enter to run</span>
                <button className="btn-run" onClick={run} disabled={!query.trim()}>
                  Run Research →
                </button>
              </div>
            </div>

            <div className="examples">
              <span className="ex-label">Try an example:</span>
              {EXAMPLES.map(q => (
                <button key={q} className="ex-chip" onClick={() => setQuery(q)}>{q}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RUNNING / COMPLETE: workspace ── */}
      {phase !== 'idle' && (
        <div className="workspace">

          {/* Sidebar */}
          <aside className="sidebar">
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
                    { n: sources.length, l: 'sources' },
                    { n: tasks.length,   l: 'sub-tasks' },
                    { n: iterations,     l: 'review loops' },
                  ].map(s => (
                    <div key={s.l} className="stat-box">
                      <span className="stat-n">{s.n}</span>
                      <span className="stat-l">{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main */}
          <main className="main">
            <div className="tabs">
              <button className={`tab ${tab === 'agents' ? 'tab-on' : ''}`} onClick={() => setTab('agents')}>
                {running ? '⚡ Live Activity' : '📋 Agent Log'}
              </button>
              <button className={`tab ${tab === 'tasks' ? 'tab-on' : ''}`} onClick={() => setTab('tasks')} disabled={!tasks.length}>
                🗂 Sub-Tasks {tasks.length ? `(${tasks.length})` : ''}
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
                  {running && (
                    <div className="live-banner">
                      <span className="live-dot" /> Agents are working — new activity streams in automatically
                    </div>
                  )}
                  {complete && (
                    <div className="done-banner">
                      ✓ Research complete — switch to the Report tab to read your results
                    </div>
                  )}
                  <LogFeed logs={logs} />
                </div>
              )}

              {tab === 'tasks' && (
                <div className="task-section">
                  <p className="tab-intro">
                    The Planner broke your question into {tasks.length} focused sub-questions
                    for the Researcher to investigate independently:
                  </p>
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
                  <div className="report-meta">
                    AI-generated research report · {report.split(' ').length} words · {sources.length} sources cited
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
                  <p className="tab-intro">
                    {sources.length} web sources were found and used to build your report.
                    Click any to read the original:
                  </p>
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
                  <div className="error-msg">{error || 'Could not connect to the backend. Make sure python run.py is still running in your other terminal.'}</div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
