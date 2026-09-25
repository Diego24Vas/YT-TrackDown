import json
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from backend.app.services.queue_service import queue_service

sse_router = APIRouter(prefix="/api", tags=["events"])

@sse_router.get("/events")
async def stream_events():
    """Streams real-time queue and download events to client via Server-Sent Events."""
    async def event_generator():
        async for message in queue_service.subscribe():
            yield {
                "event": message.get("event", "message"),
                "data": json.dumps(message.get("data", {})),
            }

    return EventSourceResponse(
        event_generator(),
        ping=15,  # Keep-alive heartbeat every 15 seconds
    )
