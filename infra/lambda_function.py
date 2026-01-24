import json
import os
from typing import Any, Dict, List, Optional

import boto3

# ---- Env ----
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "").strip()
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "400"))
TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.0"))

SYSTEM_PROMPT = """You generate a short, neutral stock dip overview for a stock-tracking app.

Hard rules:
- You MUST respond by calling the tool emit_overview. Do NOT output text.
- Do NOT give financial advice. Do NOT say buy/sell/hold.
- Use ONLY the provided input (dip context + news items).
- Keep overview to 2–3 sentences maximum.
- Drivers must sum to 1.0.
- key_factors: 1–3 short bullets.
- sources: pick up to 3 from the provided news_items; do not invent sources.
"""

TOOLS = [
    {
        "name": "emit_overview",
        "description": "Return the structured overview fields for the stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "asof": {"type": "string"},
                "overview": {"type": "string"},
                "drivers": {
                    "type": "object",
                    "properties": {
                        "market": {"type": "number"},
                        "industry": {"type": "number"},
                        "company": {"type": "number"},
                    },
                    "required": ["market", "industry", "company"],
                    "additionalProperties": False,
                },
                "key_factors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 3,
                },
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "publisher": {"type": "string"},
                            "published_utc": {"type": "string"},
                        },
                        "required": ["title", "publisher", "published_utc"],
                        "additionalProperties": False,
                    },
                    "minItems": 0,
                    "maxItems": 3,
                },
            },
            "required": ["symbol", "asof", "overview", "drivers", "key_factors", "sources"],
            "additionalProperties": False,
        },
    }
]


def _truncate(s: Optional[str], n: int) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def _compact_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Keep inputs small to reduce cost and avoid truncation.
    Only keep what we need.
    """
    symbol = payload.get("symbol")
    asof = payload.get("asof")
    dip_context = payload.get("dip_context") or {}

    news_items_in = payload.get("news_items") or []
    compact_items: List[Dict[str, Any]] = []
    for item in news_items_in[:5]:  # keep a few, we will choose sources later
        if not isinstance(item, dict):
            continue
        compact_items.append(
            {
                "title": _truncate(item.get("title"), 140),
                "publisher": _truncate(item.get("publisher"), 80),
                "published_utc": _truncate(item.get("published_utc"), 40),
                "summary": _truncate(item.get("summary"), 260),
            }
        )

    return {
        "symbol": symbol,
        "asof": asof,
        "dip_context": {
            "dip_pct": dip_context.get("dip_pct"),
            "window_days": dip_context.get("window_days"),
        },
        "news_items": compact_items,
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    if not BEDROCK_MODEL_ID:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": "Missing env var BEDROCK_MODEL_ID"}),
        }

    # Accept raw dict event or API Gateway-style body
    if isinstance(event, dict) and "body" in event and isinstance(event["body"], str):
        try:
            payload = json.loads(event["body"])
        except json.JSONDecodeError:
            payload = {"raw_body": event["body"]}
    else:
        payload = event if isinstance(event, dict) else {"raw_event": str(event)}

    compact = _compact_payload(payload)

    client = boto3.client("bedrock-runtime")

    # Force tool call; do not allow free-form text output.
    user_text = (
        "You MUST respond by calling the tool emit_overview. "
        "Do NOT output any text, JSON, markdown, or code fences. "
        "Only a tool call.\n\n"
        f"INPUT_JSON:\n{json.dumps(compact, ensure_ascii=False)}"
    )

    native_request = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": [{"type": "text", "text": user_text}]}
        ],
        "tools": TOOLS,
        "tool_choice": {"type": "tool", "name": "emit_overview"},
    }

    try:
        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(native_request).encode("utf-8"),
        )

        model_body = response["body"].read().decode("utf-8")
        model_json = json.loads(model_body)

        # Find tool_use block
        content = model_json.get("content", [])
        tool_input = None
        if isinstance(content, list):
            for part in content:
                if (
                    isinstance(part, dict)
                    and part.get("type") == "tool_use"
                    and part.get("name") == "emit_overview"
                ):
                    tool_input = part.get("input")
                    break

        if not isinstance(tool_input, dict):
            # Helpful debugging info
            return {
                "statusCode": 500,
                "headers": {"content-type": "application/json"},
                "body": json.dumps(
                    {
                        "error": "Expected tool_use output but got something else.",
                        "model_response": model_json,
                    },
                    ensure_ascii=False,
                ),
            }

        return {
            "statusCode": 200,
            "headers": {"content-type": "application/json"},
            "body": json.dumps(tool_input, ensure_ascii=False),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }
