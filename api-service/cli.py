import sys
import importlib
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Callable, Dict, Any
from uvicorn import run

# Replace the following with the actual implementation of AgentBase class
from agent.base import (
    AgentBase,
    AgentConfig,
    AgentInteraction,
    AgentInteractionResponse,
    DataType,
)

app = FastAPI()

agent_instance = None


@app.post("/agent", status_code=201)
def create_agent(config: AgentConfig):
    global agent_instance
    agent_instance = config.create()
    return {"status": "Agent created successfully"}


@app.post("/agent/start")
def start_agent(data: DataType):
    if not agent_instance:
        return {"error": "Agent not created"}
    agent_instance.start(data)
    return {"status": "Agent started successfully"}


@app.post("/agent/stop")
def stop_agent():
    if not agent_instance:
        return {"error": "Agent not created"}
    agent_instance.stop()
    return {"status": "Agent stopped successfully"}


@app.get("/agent/interactions")
def get_interactions():
    if not agent_instance:
        return {"error": "Agent not created"}
    return agent_instance.get_interactions()


@app.post("/agent/interaction")
def interaction(interaction: AgentInteraction) -> AgentInteractionResponse:
    if not agent_instance:
        return {"error": "Agent not created"}
    return agent_instance.interaction(interaction)


def main():
    if len(sys.argv) != 3:
        print("Usage: python agent_cli.py <module_name> <class_name>")
        sys.exit(1)

    module_name = sys.argv[1]
    class_name = sys.argv[2]

    try:
        module = importlib.import_module(module_name)
        agent_class = getattr(module, class_name)
        if not issubclass(agent_class, AgentBase):
            raise ValueError(f"{class_name} is not a subclass of AgentBase")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Start the FastAPI server
    run(app, host="localhost", port=8080)


if __name__ == "__main__":
    main()
