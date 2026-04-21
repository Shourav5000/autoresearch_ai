import os
from functools import lru_cache

from langchain_core.language_models import BaseChatModel


@lru_cache(maxsize=1)
def get_llm() -> BaseChatModel:
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.getenv("LLM_MODEL", "claude-sonnet-4-20250514"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=4096,
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("LLM_MODEL", "gpt-4o"),
            api_key=os.getenv("OPENAI_API_KEY"),
            max_tokens=4096,
        )

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Use 'anthropic' or 'openai'.")
