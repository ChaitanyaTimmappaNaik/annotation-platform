from fastapi import WebSocket
from typing import Dict, List
import json

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
        print(f"Client connected to room: {room}")

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            if websocket in self.active_connections[room]:
                self.active_connections[room].remove(websocket)
        print(f"Client disconnected from room: {room}")

    async def broadcast(self, room: str, message: dict):
        if room in self.active_connections:
            dead = []
            for connection in self.active_connections[room]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    dead.append(connection)
            for d in dead:
                self.active_connections[room].remove(d)

    async def broadcast_to_all(self, message: dict):
        for room in self.active_connections:
            await self.broadcast(room, message)

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

manager = WebSocketManager()