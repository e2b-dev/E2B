from agent.smol_agent import SmolAgent


def get_agent_factory_from_template(template_id: str):
    match template_id:
        case "SmolDeveloper":
            return SmolAgent.create
        case _:
            raise ValueError(f"Unknown template {template_id}")
