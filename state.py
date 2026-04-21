from typing import Annotated, TypedDict, Literal
from operator import add


AgentStatus = Literal["idle", "running", "done", "failed"]

ResearchPhase = Literal[
    "planning",
    "researching",
    "critiquing",
    "synthesizing",
    "complete",
    "failed",
]


class ResearchTask(TypedDict):
    id: str
    question: str
    status: Literal["pending", "done"]


class SearchResult(TypedDict):
    url: str
    title: str
    snippet: str
    source: str


class CritiqueResult(TypedDict):
    passed: bool
    gaps: list[str]
    suggestions: list[str]


class AgentLog(TypedDict):
    agent: str
    message: str
    timestamp: str


class ResearchState(TypedDict):
    query: str
    tasks: list[ResearchTask]
    search_results: Annotated[list[SearchResult], add]
    research_notes: Annotated[list[str], add]
    critique: CritiqueResult | None
    iteration: int
    final_report: str
    sources: list[SearchResult]
    phase: ResearchPhase
    agent_logs: Annotated[list[AgentLog], add]
    error: str | None
