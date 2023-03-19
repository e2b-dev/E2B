from typing import List

import playground_client

from session.api import API
from session.env import EnvVar, format_env_vars
from session.session import Session


class Deployment(API):
    def __init__(self, session: Session, project_id: str):
        super().__init__()
        self.session = session
        self.project_id = project_id

    @staticmethod
    def modify_code(code: str, ecma_script=False):
        # TODO: Make these edits via ChatGPT

        if ecma_script:
            code = 'import serverless from "serverless-http;"\n' + code
            code = code + "\nexport const handler = serverless(app);"
        else:
            code = "const serverless = require('serverless-http');\n" + code
            code = code + "\nexports.handler = serverless(app);"

        return code.replace("app.listen(", "; ({})?.listen?.(")

    def update(self, code: str | None = None, envs: List[EnvVar] | None = None):
        self.api.update_deployment(
            self.project_id,
            session_id=self.session.id,
            update_deployment_request=playground_client.UpdateDeploymentRequest(
                envVars=format_env_vars(envs) if envs is not None else None,
                code=Deployment.modify_code(code) if code is not None else None,
            ),
        )

    def new(self, code: str, envs: List[EnvVar]):
        self.api.create_deployment(
            self.project_id,
            session_id=self.session.id,
            create_deployment_request=playground_client.CreateDeploymentRequest(
                envVars=format_env_vars(envs),
                code=Deployment.modify_code(code),
            ),
        )
