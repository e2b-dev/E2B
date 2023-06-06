import asyncio
import uuid
import os
import ast

from typing import Any, List
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.schema import AIMessage, BaseMessage, SystemMessage, HumanMessage
from langchain.prompts.chat import (
    ChatPromptValue,
)

from agent.base import (
    AgentInteraction,
    OnLogs,
    OnInteractionRequest,
)
from models.base import ModelConfig, get_model
from agent.base import AgentBase, AgentInteractionRequest, GetEnvs
from session.playground import Playground
from playground_client.exceptions import NotFoundException


class SmolAgent(AgentBase):
    max_run_time = 60 * 60  # in seconds

    def __init__(
        self,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ):
        super().__init__()
        self._dev_loop: asyncio.Task | None = None
        self.get_envs = get_envs
        self.config = ModelConfig(**config)
        self.on_interaction_request = on_interaction_request
        self.on_logs = on_logs

    @classmethod
    async def create(
        cls,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ):
        return cls(
            config,
            get_envs,
            on_logs,
            on_interaction_request,
        )

    async def _dev(self, instructions: Any):
        user_prompt: str = instructions["Prompt"]
        access_token: str = instructions["AccessToken"]
        repo: str = instructions["Repo"]
        owner: str = instructions["Owner"]
        branch: str = instructions["Branch"]
        git_app_name: str = instructions["GitHubAppName"]
        git_app_email: str = instructions["GitHubAppEmail"]
        commit_message: str = instructions["CommitMessage"]

        repo_address = (
            f"https://{git_app_name}:{access_token}@github.com/{owner}/{repo}.git"
        )

        # TODO: Apply the file rewrite when the agent was invoked via PR code comment
        file: str | None = instructions.get("File", None)

        await self.on_logs(
            {
                "message": f"hi its me, 🐣the smol developer🐣! you said you wanted:\n{user_prompt}",
                "type": "info",
            }
        )
        playground = None
        try:
            callback_manager = AsyncCallbackManager([StreamingStdOutCallbackHandler()])
            model = get_model(self.config, callback_manager)

            playground = Playground(env_id="PPSrlH5TIvFx", get_envs=self.get_envs)
            await playground.open()

            await self.on_logs(
                {
                    "message": f"Created playground",
                    "properties": {
                        "playground": "created",
                        "id": playground.id,
                    },
                    "type": "playground",
                }
            )

            fixClockDrift = asyncio.ensure_future(playground.sync_clock())

            rootdir = "/repo"
            await playground.change_rootdir(rootdir)
            await playground.make_dir(rootdir)

            await playground.clone_repo(
                repo_address=repo_address,
                rootdir=rootdir,
                branch=branch,
            )

            await self.on_logs(
                {
                    "message": f"Cloned repository",
                    "properties": {
                        "tool": "git",
                        "repository": f"{owner}/{repo}",
                    },
                    "type": "tool",
                }
            )

            extensions_to_skip = [
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".bmp",
                ".svg",
                ".ico",
                ".tif",
                ".tiff",
            ]

            async def clean_dir():
                files = await playground.get_filenames(rootdir, [".git"])
                for file in files:
                    _, extension = os.path.splitext(file.name)
                    if extension not in extensions_to_skip:
                        await playground.delete_file(file.name)

            async def generate_response(
                system_prompt: str,
                user_prompt: str,
                *args: Any,
            ):
                messages: List[BaseMessage] = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]

                # loop thru each arg and add it to messages alternating role between "assistant" and "user"
                role = "assistant"
                for value in args:
                    if role == "assistant":
                        messages.append(AIMessage(content=value))
                    else:
                        messages.append(HumanMessage(content=value))
                role = "user" if role == "assistant" else "assistant"

                model_prompt = ChatPromptValue(messages=messages)

                response = await model.agenerate_prompt([model_prompt])
                return response.generations[0][0].text

            async def generate_file(
                filename: str,
                filepaths_string=None,
                shared_dependencies=None,
                prompt=None,
            ):
                # call openai api with this prompt
                filecode = await generate_response(
                    f"""You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

the app is: {prompt}

the files we have decided to generate are: {filepaths_string}

the shared dependencies (like filenames and variable names) we have decided on are: {shared_dependencies}

only write valid code for the given filepath and file type, and return only the code.
do not add any other explanation, only return valid code for that file type.
""",
                    f"""
We have broken up the program into per-file generation.
Now your job is to generate only the code for the file {filename}.
Make sure to have consistent filenames if you reference other files we are also generating.

Remember that you must obey 3 things:
- you are generating code for the file {filename}
- do not stray from the names of the files and the shared dependencies we have decided on
- MOST IMPORTANT OF ALL - the purpose of our app is {prompt} - every line of code you generate must be valid code. Do not include code fences in your response, for example

Bad response:
```javascript
console.log("hello world")
```

Good response:
console.log("hello world")

Begin generating the code now.

""",
                )

                await self.on_logs(
                    {
                        "message": f"Generated file",
                        "properties": {
                            "content": filecode,
                            "filename": filename,
                            "model": "gpt-4",
                        },
                        "type": "model",
                    }
                )

                return filename, filecode

            filepaths_string = await generate_response(
                """You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

When given their intent, create a complete, exhaustive list of filepaths that the user would write to make the program.

only list the filepaths you would write, and return them as a python list of strings.
do not add any other explanation, only return a python list of strings.
""",
                user_prompt,
            )

            await self.on_logs(
                {
                    "message": f"Generating filepaths",
                    "properties": {
                        "prompt": user_prompt,
                        "result": filepaths_string,
                        "model": "gpt-4",
                    },
                    "type": "model",
                }
            )

            # parse the result into a python list
            list_actual = ast.literal_eval(filepaths_string)

            # if shared_dependencies.md is there, read it in, else set it to None
            shared_dependencies: str | None = None
            try:
                shared_dependencies = await playground.read_file(
                    os.path.join(rootdir, "shared_dependencies.md")
                )
            except NotFoundException:
                pass

            if file is not None:
                filename, filecode = await generate_file(
                    file,
                    filepaths_string=filepaths_string,
                    shared_dependencies=shared_dependencies,
                    prompt=user_prompt,
                )

                await self.on_logs(
                    {
                        "message": f"Generated file",
                        "properties": {
                            "filename": filename,
                            "result": filecode,
                            "model": "gpt-4",
                        },
                        "type": "model",
                    }
                )

                await playground.write_file(os.path.join(rootdir, filename), filecode)

                await self.on_logs(
                    {
                        "message": f"Saved file",
                        "properties": {
                            "filename": filename,
                            "content": filecode,
                            "tool": "filesystem",
                        },
                        "type": "tool",
                    }
                )

            else:
                await clean_dir()

                await self.on_logs(
                    {
                        "message": f"Cleaned root directory",
                        "properties": {
                            "tool": "filesystem",
                        },
                        "type": "tool",
                    }
                )

                # understand shared dependencies
                shared_dependencies = await generate_response(
                    """You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

In response to the user's prompt:

---
the app is: {prompt}
---

the files we have decided to generate are: {filepaths_string}

Now that we have a list of files, we need to understand what dependencies they share.
Please name and briefly describe what is shared between the files we are generating, including exported variables, data schemas, id names of every DOM elements that javascript functions will use, message names, and function names.
Exclusively focus on the names of the shared dependencies, and do not add any other explanation.
""",
                    user_prompt,
                )

                await self.on_logs(
                    {
                        "message": f"Generated shared dependencies",
                        "properties": {
                            "result": shared_dependencies,
                            "model": "gpt-4",
                        },
                        "type": "model",
                    }
                )

                print(shared_dependencies)
                # write shared dependencies as a md file inside the generated directory
                await playground.write_file(
                    os.path.join(rootdir, "shared_dependencies.md"),
                    shared_dependencies,
                )

                await self.on_logs(
                    {
                        "message": f"Saved shared dependencies",
                        "properties": {
                            "filename": "shared_dependencies.md",
                            "content": shared_dependencies,
                            "tool": "filesystem",
                        },
                        "type": "tool",
                    }
                )

                # execute the file generation in paralell and wait for all of them to finish. Use list comprehension to generate the tasks
                tasks = [
                    generate_file(
                        name,
                        filepaths_string=filepaths_string,
                        shared_dependencies=shared_dependencies,
                        prompt=user_prompt,
                    )
                    for name in list_actual
                    # Filter out files that end with extensions we don't want to generate
                    if not any(
                        name.endswith(extension) for extension in extensions_to_skip
                    )
                ]

                generated_files = await asyncio.gather(*tasks)

                for name, content in generated_files:
                    filepath = os.path.join(rootdir, name)
                    await playground.write_file(filepath, content)
                    await self.on_logs(
                        {
                            "message": f"Saved file",
                            "properties": {
                                "filename": filepath,
                                "content": content,
                                "tool": "filesystem",
                            },
                            "type": "tool",
                        }
                    )

            await fixClockDrift
            await playground.push_repo(
                rootdir=rootdir,
                repo_address=repo_address,
                commit_message=commit_message,
                git_email=git_app_email,
                git_name=git_app_name,
            )

            await self.on_logs(
                {
                    "message": f"Pushed repository",
                    "properties": {
                        "repository_url": f"https://github.com/{owner}/{repo}",
                        "branch": branch,
                        "commit_message": commit_message,
                        "tool": "git",
                    },
                    "type": "tool",
                }
            )

            await self.on_interaction_request(
                AgentInteractionRequest(
                    interaction_id=str(uuid.uuid4()),
                    type="done",
                    data={
                        "prompt": user_prompt,
                    },
                )
            )
        except:
            raise
        finally:
            if playground is not None:
                playground.close()
                await self.on_logs(
                    {
                        "message": f"Closed playground",
                        "properties": {
                            "playground": "closed",
                        },
                        "type": "playground",
                    }
                )

    async def _dev_in_background(self, instructions: Any):
        print("Start agent run", self._dev_loop)

        if self._dev_loop:
            print("Agent run already in progress - restarting")
            await self.stop()
            await self.on_interaction_request(
                AgentInteractionRequest(
                    interaction_id=str(uuid.uuid4()),
                    type="cancelled",
                    data={
                        # "associated_comment_id": self._dev_comment_id,
                    },
                )
            )

        async def start_with_timeout():
            try:
                self._dev_loop = asyncio.create_task(
                    self._dev(instructions=instructions),
                )

                await asyncio.wait_for(
                    self._dev_loop,
                    timeout=self.max_run_time,
                )
            except asyncio.TimeoutError:
                await self.stop()
                print("Timeout")
            finally:
                self._dev_loop = None

        asyncio.create_task(
            start_with_timeout(),
        )

    async def interaction(self, interaction: AgentInteraction):
        print("Agent interaction")
        match interaction.type:
            case "start":
                await self._dev_in_background(interaction.data["instructions"])
            case _:
                raise Exception(f"Unknown interaction action: {interaction.type}")

    async def stop(self):
        print("Cancel agent run")
        if self._dev_loop:
            self._dev_loop.cancel()
