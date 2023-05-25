from agent.basic_agent import BasicAgent
from agent.smol_agent import SmolAgent


def get_agent_factory_from_template(template_id: str):
    match template_id:
        case "SmolDeveloper":
            return BasicAgent.create
        case _:
            return SmolAgent.create
