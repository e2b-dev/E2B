from typing import List

import playground_client

from session.api import API
from session.env import EnvVar, format_env_vars
from session.session import Session


class Deployment(API):
    def __init__(self, session: Session):
        super().__init__()
        self.session = session

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

    def update(self, project_id: str, code: str | None = None, env_vars: List[EnvVar] | None = None):
        self.api.update_deployment(
            project_id,
            session_id=self.session.id,
            update_deployment_request=playground_client.UpdateDeploymentRequest(
                envVars=format_env_vars(env_vars) if env_vars is not None else None,
                code=Deployment.modify_code(code) if code is not None else None,
            ),
        )

    def new(self, project_id: str, code: str, env_vars: List[EnvVar]):
        print("deploying")
        self.api.create_deployment(
            project_id,
            session_id=self.session.id,
            create_deployment_request=playground_client.CreateDeploymentRequest(
                envVars=format_env_vars(env_vars),
                code=Deployment.modify_code(code),
            ),
        )
        print("deployed")
