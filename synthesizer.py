from datetime import datetime, timezone

from state import ResearchState, SearchResult, AgentLog
from llm import get_llm


SYNTHESIZER_PROMPT = """You are an expert research writer. Synthesize the research notes below into \
a clear, well-structured, authoritative report that fully answers the original query.

Original query: {query}

Research notes:
{notes}

Write a complete research report in Markdown following this structure:

# [Descriptive Report Title]

## Executive Summary
2-3 sentence overview of the key findings.

## Background
Context and foundational information needed to understand the topic.

## Key Findings
The main research findings, organized into logical sub-sections with ## headings.

## Analysis
What the findings mean, patterns, implications, conflicting views.

## Conclusion
What we now know, key takeaways, and what remains uncertain.

## Sources
List the sources referenced (use the source names from the research notes).

Rules:
- Be specific — use numbers, names, and dates from the research
- Cite sources inline as [Source Name] where relevant
- Flag uncertainty explicitly ("evidence suggests...", "it is unclear whether...")
- Aim for 600-900 words
- Use clean Markdown — headers, bold for key terms, bullet points where appropriate"""


async def synthesizer_node(state: ResearchState) -> dict:
    llm = get_llm()
    log = _log("synthesizer", "Writing final research report...")

    notes_text = "\n\n---\n\n".join(state.get("research_notes", []))
    prompt = SYNTHESIZER_PROMPT.format(query=state["query"], notes=notes_text)

    try:
        response = await llm.ainvoke(prompt)
        report = response.content.strip()

        seen_urls: set[str] = set()
        unique_sources: list[SearchResult] = []
        for result in state.get("search_results", []):
            if result["url"] not in seen_urls:
                seen_urls.add(result["url"])
                unique_sources.append(result)

        done_log = _log(
            "synthesizer",
            f"Report complete — {len(report.split())} words, {len(unique_sources)} unique sources"
        )

        return {
            "final_report": report,
            "sources": unique_sources,
            "phase": "complete",
            "agent_logs": [log, done_log],
        }

    except Exception as e:
        error_log = _log("synthesizer", f"Report generation failed: {e}")
        return {
            "final_report": "",
            "sources": [],
            "phase": "failed",
            "error": f"Synthesizer error: {e}",
            "agent_logs": [log, error_log],
        }


def _log(agent: str, message: str) -> AgentLog:
    return {
        "agent": agent,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
