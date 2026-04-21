import json
import uuid
from datetime import datetime, timezone

from state import ResearchState, ResearchTask, AgentLog
from llm import get_llm


PLANNER_PROMPT = """You are a research planning expert. Your job is to break a complex research \
question into 3-5 focused, non-overlapping sub-questions that together fully answer the original query.

Rules:
- Each sub-question must be specific and independently researchable
- Cover different angles: background, current state, key findings, implications
- Order them logically (foundational → specific → forward-looking)
- Output ONLY valid JSON — no markdown fences, no preamble

Output format:
{{
  "tasks": [
    {{"question": "..."}},
    {{"question": "..."}},
    ...
  ]
}}

User query: {query}"""


async def planner_node(state: ResearchState) -> dict:
    llm = get_llm()
    log = _log("planner", f"Breaking down query: '{state['query']}'")

    prompt = PLANNER_PROMPT.format(query=state["query"])

    try:
        response = await llm.ainvoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)
        tasks: list[ResearchTask] = [
            {
                "id": str(uuid.uuid4())[:8],
                "question": t["question"],
                "status": "pending",
            }
            for t in data["tasks"]
        ]

        task_log = _log(
            "planner",
            f"Created {len(tasks)} research tasks: "
            + " | ".join(f'"{t["question"]}"' for t in tasks),
        )

        return {
            "tasks": tasks,
            "phase": "researching",
            "agent_logs": [log, task_log],
        }

    except Exception as e:
        error_log = _log("planner", f"Failed to parse tasks: {e}")
        return {
            "tasks": [],
            "phase": "failed",
            "error": f"Planner error: {e}",
            "agent_logs": [log, error_log],
        }


def _log(agent: str, message: str) -> AgentLog:
    return {
        "agent": agent,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
