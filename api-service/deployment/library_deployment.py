from typing import Dict

from deployment.adapter import DeploymentAdapter
from agent.base import Agent

deployments: Dict[str, Agent] = {}


class LibraryDeployment(DeploymentAdapter):
    def __init__(self, deployment):
        self.deployment = deployment

    async def create_deployed_agent(self, config:):

        pass

    async def remove_deployed_agent(self, deployment_id: str):
        pass

    async def get_deployed_agent(self, deployment_id: str):
        pass

    async def get_deployed_agents(self):
        pass
