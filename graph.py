import os
from langgraph.graph import StateGraph, END

from state import ResearchState
from planner import planner_node
from researcher import researcher_node
from critic import critic_node
from synthesizer import synthesizer_node


def route_after_critic(state: ResearchState) -> str:
    critique = state.get("critique")
    iteration = state.get("iteration", 0)
    max_iterations = int(os.getenv("MAX_RESEARCH_ITERATIONS", "2"))

    if critique is None:
        return "synthesizer"

    if critique["passed"] or iteration >= max_iterations:
        if iteration >= max_iterations and not critique["passed"]:
            print(f"[graph] Max iterations ({max_iterations}) reached — forcing synthesis")
        return "synthesizer"

    return "researcher"


def route_after_planner(state: ResearchState) -> str:
    if state.get("phase") == "failed" or not state.get("tasks"):
        return END
    return "researcher"


def build_graph() -> StateGraph:
    graph = StateGraph(ResearchState)

    graph.add_node("planner", planner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("critic", critic_node)
    graph.add_node("synthesizer", synthesizer_node)

    graph.set_entry_point("planner")

    graph.add_conditional_edges("planner", route_after_planner)
    graph.add_edge("researcher", "critic")
    graph.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "researcher": "researcher",
            "synthesizer": "synthesizer",
        },
    )
    graph.add_edge("synthesizer", END)

    return graph.compile()


research_graph = build_graph()
