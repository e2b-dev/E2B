from agent.basic_agent import BasicAgent
from agent.stripe_agent import StripeAgent
from agent.smol_agent import SmolAgent


def get_agent_factory_from_template(template_id: str):
    match template_id:
        case "smol":
            return SmolAgent.create
        case "stripe":
            return StripeAgent.create
        case _:
            return BasicAgent.create
