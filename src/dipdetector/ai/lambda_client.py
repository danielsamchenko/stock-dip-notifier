"""AWS Lambda client for AI overview generation."""

from __future__ import annotations

import json
from typing import Any

import boto3

from dipdetector import config


def invoke_overview(payload: dict[str, Any]) -> dict[str, Any]:
    """Invoke the AI overview Lambda and return the decoded response."""
    client = boto3.client("lambda", region_name=config.get_aws_region())
    response = client.invoke(
        FunctionName=config.get_ai_overview_lambda_name(),
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )

    if response.get("FunctionError"):
        raise RuntimeError("Lambda execution failed")

    raw_payload = response.get("Payload")
    if raw_payload is None:
        raise RuntimeError("Lambda returned empty payload")

    decoded = json.loads(raw_payload.read().decode("utf-8"))

    if isinstance(decoded, dict) and "statusCode" in decoded:
        status_code = decoded.get("statusCode")
        if status_code != 200:
            raise RuntimeError(f"Lambda returned status {status_code}")
        body = decoded.get("body")
        if body is None:
            return {}
        if isinstance(body, str):
            return json.loads(body)
        if isinstance(body, dict):
            return body
        return {}

    if isinstance(decoded, dict):
        return decoded

    raise RuntimeError("Lambda response was not JSON")
