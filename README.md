# AutoResearch

An AI system where four agents work together to research any topic and write a report.

🔗 **Live:** [autoresearch-ai-three.vercel.app](https://autoresearch-ai-three.vercel.app/)

---

## How it works

1. **Planner** — breaks your question into focused sub-questions
2. **Researcher** — searches the web and summarizes findings
3. **Critic** — reviews the research and flags any gaps
4. **Synthesizer** — writes the final report with citations

---

## Built with

- LangGraph — connects the agents together
- FastAPI — backend API with real-time streaming
- Claude (Anthropic) — the AI powering each agent
- Tavily — web search
- React + Vite — frontend

---

## Run it locally

**1. Clone and install**
```bash
git clone https://github.com/Shourav5000/autoresearch_ai.git
cd autoresearch_ai
pip install -r requirements.txt
npm install
```

**2. Create a `.env` file with your API keys**
```
ANTHROPIC_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
```

**3. Start the backend**
```bash
python run.py
```

**4. Start the frontend**
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start researching.

---

## Author

**Shourav Kumar Mandal** — [LinkedIn](https://linkedin.com/in/shourav-mandal) · [GitHub](https://github.com/Shourav5000)
