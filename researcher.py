import asyncio
from datetime import datetime, timezone

from state import ResearchState, SearchResult, AgentLog
from llm import get_llm
from search import search_web


SUMMARIZE_PROMPT = """You are a research analyst. Given a research question and raw search results, \
write a clear, dense summary of the key findings.

Rules:
- Be factual and specific — include numbers, names, dates where available
- Note any conflicting information between sources
- Flag anything that seems uncertain or requires verification
- 150-250 words maximum

Research question: {question}

Search results:
{results}

Write your research summary:"""


async def researcher_node(state: ResearchState) -> dict:
    log = _log("researcher", f"Starting research on {len(state['tasks'])} tasks...")
    all_results: list[SearchResult] = []
    all_notes: list[str] = []
    logs: list[AgentLog] = [log]

    tasks_to_run = state["tasks"]
    critique = state.get("critique")

    extra_questions: list[str] = []
    if critique and not critique["passed"] and critique.get("suggestions"):
        extra_questions = critique["suggestions"]
        logs.append(_log(
            "researcher",
            f"Critic flagged {len(extra_questions)} gap(s) — running follow-up searches"
        ))

    questions = [t["question"] for t in tasks_to_run] + extra_questions

    search_tasks = [search_web(q) for q in questions]
    results_per_question = await asyncio.gather(*search_tasks, return_exceptions=True)

    llm = get_llm()

    for question, results in zip(questions, results_per_question):
        if isinstance(results, Exception):
            logs.append(_log("researcher", f"Search failed for '{question}': {results}"))
            continue

        all_results.extend(results)
        logs.append(_log("researcher", f"Found {len(results)} results for: '{question}'"))

        results_text = "\n\n".join(
            f"[{r['source']}] {r['title']}\n{r['snippet']}" for r in results
        )
        summary_prompt = SUMMARIZE_PROMPT.format(
            question=question, results=results_text
        )

        try:
            response = await llm.ainvoke(summary_prompt)
            note = f"### {question}\n\n{response.content.strip()}"
            all_notes.append(note)
        except Exception as e:
            logs.append(_log("researcher", f"Summary failed for '{question}': {e}"))

    updated_tasks = [{**t, "status": "done"} for t in state["tasks"]]

    logs.append(_log(
        "researcher",
        f"Research complete — {len(all_results)} sources, {len(all_notes)} summaries"
    ))

    return {
        "tasks": updated_tasks,
        "search_results": all_results,
        "research_notes": all_notes,
        "phase": "critiquing",
        "agent_logs": logs,
    }


def _log(agent: str, message: str) -> AgentLog:
    return {
        "agent": agent,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
