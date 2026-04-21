import json
from datetime import datetime, timezone

from state import ResearchState, CritiqueResult, AgentLog
from llm import get_llm


CRITIC_PROMPT = """You are a rigorous research editor. Review the research notes below and evaluate \
whether they fully and accurately answer the original query.

Original query: {query}

Research notes:
{notes}

Evaluate the research on these criteria:
1. Completeness — does it cover all key aspects of the query?
2. Accuracy — are claims specific and well-supported by sources?
3. Recency — is recent/current information included where relevant?
4. Balance — are multiple perspectives or conflicting views addressed?

Output ONLY valid JSON — no markdown, no preamble:
{{
  "passed": true | false,
  "gaps": ["missing area 1", "missing area 2"],
  "suggestions": ["specific follow-up question 1", "specific follow-up question 2"]
}}

If the research is sufficient, set passed=true and leave gaps/suggestions as empty lists.
If gaps exist, set passed=false and provide 1-3 specific follow-up questions as suggestions."""


async def critic_node(state: ResearchState) -> dict:
    llm = get_llm()
    log = _log("critic", "Reviewing research quality...")

    notes_text = "\n\n---\n\n".join(state.get("research_notes", []))
    prompt = CRITIC_PROMPT.format(query=state["query"], notes=notes_text)

    try:
        response = await llm.ainvoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)
        critique: CritiqueResult = {
            "passed": data.get("passed", True),
            "gaps": data.get("gaps", []),
            "suggestions": data.get("suggestions", []),
        }

        if critique["passed"]:
            result_log = _log("critic", "Research passed review — proceeding to synthesis")
        else:
            result_log = _log(
                "critic",
                f"Found {len(critique['gaps'])} gap(s): "
                + "; ".join(critique["gaps"][:2])
                + (" ..." if len(critique["gaps"]) > 2 else ""),
            )

        return {
            "critique": critique,
            "iteration": state.get("iteration", 0) + 1,
            "agent_logs": [log, result_log],
        }

    except Exception as e:
        error_log = _log("critic", f"Critique parse error ({e}) — passing through")
        fallback: CritiqueResult = {"passed": True, "gaps": [], "suggestions": []}
        return {
            "critique": fallback,
            "iteration": state.get("iteration", 0) + 1,
            "agent_logs": [log, error_log],
        }


def _log(agent: str, message: str) -> AgentLog:
    return {
        "agent": agent,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
