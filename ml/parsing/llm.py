import json
import logging
import os
import re
from typing import Optional
from dotenv import load_dotenv, find_dotenv
from groq import Groq

load_dotenv(find_dotenv())
logger = logging.getLogger(__name__)

_CLIENT: Optional[Groq] = None


def get_groq_client() -> Groq:
    """Return a cached Groq client instance, or initialize one if not present."""
    global _CLIENT
    if _CLIENT is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set or empty.")
        _CLIENT = Groq(api_key=api_key, timeout=25.0)
    return _CLIENT


def call_llm(prompt: str) -> str:
    client = get_groq_client()
    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return response.choices[0].message.content or ""


def parse_json_response(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse JSON. Returns None on failure."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None

