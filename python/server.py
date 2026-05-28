#!/usr/bin/env python3
"""JSON-RPC stdin/stdout server for Resume Agent Python sidecar."""

import sys
import json
import traceback
import importlib
from typing import Any, Dict

# Ensure tools can be imported
sys.path.insert(0, __import__('os').path.dirname(__file__))

if __name__ == "__main__":
    # Register __main__ as 'server' so tool modules can `from server import register_tool`.
    sys.modules['server'] = sys.modules['__main__']

TOOL_REGISTRY: Dict[str, Any] = {}


def register_tool(name: str):
    """Decorator to register a tool handler."""
    def decorator(func):
        TOOL_REGISTRY[name] = func
        return func
    return decorator


def log(msg: str):
    """Log to stderr (doesn't interfere with stdout JSON)."""
    print(f"[python-sidecar] {msg}", file=sys.stderr, flush=True)


def send_response(response: dict):
    """Send a JSON response on stdout."""
    sys.stdout.write(json.dumps(response, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def handle_request(request: dict) -> dict:
    """Route a request to the appropriate tool handler."""
    req_id = request.get("id", "")
    method = request.get("method", "")
    params = request.get("params", {})

    if method == "ping":
        return {"id": req_id, "result": {"status": "ok"}}

    if method == "shutdown":
        log("Received shutdown signal")
        send_response({"id": req_id, "result": {"status": "shutting_down"}})
        sys.exit(0)

    handler = TOOL_REGISTRY.get(method)
    if not handler:
        return {"id": req_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}

    try:
        result = handler(params)
        return {"id": req_id, "result": result}
    except Exception as e:
        log(f"Error in {method}: {traceback.format_exc()}")
        return {"id": req_id, "error": {"code": -1, "message": str(e)}}


# --- Register tools by importing tool modules ---
def load_tools():
    """Import all tool modules to trigger registration."""
    from tools import web_search, boss_search  # noqa: F401


def main():
    log("Python sidecar starting...")
    load_tools()
    log(f"Registered tools: {list(TOOL_REGISTRY.keys())}")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            send_response({"id": "", "error": {"code": -32700, "message": f"Parse error: {e}"}})
            continue

        response = handle_request(request)
        send_response(response)


if __name__ == "__main__":
    main()
