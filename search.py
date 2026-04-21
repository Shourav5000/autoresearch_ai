import os
from state import SearchResult


async def search_web(query: str) -> list[SearchResult]:
    api_key = os.getenv("TAVILY_API_KEY", "")

    if not api_key or api_key == "your_tavily_key_here":
        return _mock_results(query)

    try:
        from tavily import AsyncTavilyClient
        client = AsyncTavilyClient(api_key=api_key)
        max_results = int(os.getenv("MAX_SEARCH_RESULTS", "5"))

        response = await client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_answer=False,
        )

        results: list[SearchResult] = []
        for r in response.get("results", []):
            results.append({
                "url": r.get("url", ""),
                "title": r.get("title", "Untitled"),
                "snippet": r.get("content", ""),
                "source": _extract_domain(r.get("url", "")),
            })
        return results

    except Exception as e:
        print(f"[search] Tavily error for '{query}': {e}")
        return _mock_results(query)


def _extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url


def _mock_results(query: str) -> list[SearchResult]:
    return [
        {
            "url": f"https://example.com/article-1?q={query.replace(' ', '+')}",
            "title": f"Overview of {query}",
            "snippet": (
                f"This article provides a comprehensive overview of {query}. "
                "Recent developments have shown significant progress in this area, "
                "with multiple research teams publishing findings in 2024-2025."
            ),
            "source": "example.com",
        },
        {
            "url": f"https://research.org/papers?topic={query.replace(' ', '+')}",
            "title": f"Latest research findings: {query}",
            "snippet": (
                f"A systematic review of {query} reveals that current approaches "
                "demonstrate a 40% improvement over baseline methods. Key challenges "
                "remain around scalability and generalization."
            ),
            "source": "research.org",
        },
        {
            "url": f"https://techblog.io/posts/{query.replace(' ', '-').lower()}",
            "title": f"Practical applications of {query}",
            "snippet": (
                f"Engineers working with {query} report that the most effective "
                "implementations combine multiple techniques. Real-world deployments "
                "at scale have validated these theoretical findings."
            ),
            "source": "techblog.io",
        },
    ]
