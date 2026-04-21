import json
import asyncio
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from graph import research_graph
from state import ResearchState


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] AutoResearch API ready")
    yield
    print("[shutdown] AutoResearch API stopped")


app = FastAPI(
    title="AutoResearch API",
    description="Multi-agent AI research system powered by LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    query: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sse_event(event_type: str, data: dict) -> str:
    return json.dumps({"type": event_type, "data": data, "timestamp": _now()})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "autoresearch-api"}


@app.post("/research/stream")
async def research_stream(request: ResearchRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Query must not be empty")

    initial_state: ResearchState = {
        "query": query,
        "tasks": [],
        "search_results": [],
        "research_notes": [],
        "critique": None,
        "iteration": 0,
        "final_report": "",
        "sources": [],
        "phase": "planning",
        "agent_logs": [],
        "error": None,
    }

    async def event_generator():
        yield _sse_event("phase", {"phase": "planning", "query": query})

        seen_log_count = 0
        last_phase = "planning"
        current_state = initial_state

        try:
            async for event in research_graph.astream(initial_state, stream_mode="values"):
                current_state = event

                all_logs = current_state.get("agent_logs", [])
                new_logs = all_logs[seen_log_count:]
                for log in new_logs:
                    yield _sse_event("log", log)
                    await asyncio.sleep(0)
                seen_log_count = len(all_logs)

                current_phase = current_state.get("phase", "planning")
                if current_phase != last_phase:
                    yield _sse_event("phase", {"phase": current_phase})
                    last_phase = current_phase

                if current_phase == "failed":
                    yield _sse_event("error", {
                        "message": current_state.get("error", "Unknown error")
                    })
                    return

        except Exception as e:
            yield _sse_event("error", {"message": str(e)})
            return

        yield _sse_event("complete", {
            "report": current_state.get("final_report", ""),
            "sources": current_state.get("sources", []),
            "tasks": current_state.get("tasks", []),
            "iterations": current_state.get("iteration", 0),
        })

    return EventSourceResponse(event_generator())


@app.post("/research")
async def research_sync(request: ResearchRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Query must not be empty")

    initial_state: ResearchState = {
        "query": query,
        "tasks": [],
        "search_results": [],
        "research_notes": [],
        "critique": None,
        "iteration": 0,
        "final_report": "",
        "sources": [],
        "phase": "planning",
        "agent_logs": [],
        "error": None,
    }

    try:
        result = await research_graph.ainvoke(initial_state)
        return {
            "query": query,
            "report": result.get("final_report", ""),
            "sources": result.get("sources", []),
            "tasks": result.get("tasks", []),
            "iterations": result.get("iteration", 0),
            "logs": result.get("agent_logs", []),
            "phase": result.get("phase", "unknown"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
