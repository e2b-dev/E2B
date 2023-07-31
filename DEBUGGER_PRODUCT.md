# Product

## How does the debugging experience look like when using our debugger?
### What do you need to do to start debugging?
- Install our CLI
- Go to the directory with your agent
- Run `e2b run`
- You will enter the terminal - now you should install dependencies of your agent and start it
- After your agent starts you can call it's API from localhost or you can interact with it any way you would interact with a your running code

### How do you interact with the debugger? How does the (time-traveling) debugging look like?
- Via CLI
  - Start the file watcher run command that syncs local files with the remote environment
  - Go to the env via terminal and start the agent code
- Via API/dashboard
  - Inspect the logs/monitoring data from the environment and code for debugging
  - Time travel debug
- From inside of the agent code
  - Install additional monitoring SDKs
- Localhost
  - Call the agent API from localhost

### What kinds of information do you get during debugging?
- Logs from your code
- Info from eBPF that describes what is actually happening in network, fs, etc.
- Access to the environment so you can see artifacts, files, processes running, etc.
- Traces/metrics/logs from the auto-instrumentation of your code (if installed some SDK)
- Logs from the agent itself

### Possible problems
#### What is the level of abstraction of the debugger? Isn't it too low-level? Will the level we are operating on be useful for users?
We need to aggregate the low level logs and expose them to user as a higher level abstraction where he can see what it is actually happening. How good DX this will be? How effectively can the logs be agregated? Apart from network and filesystem, can we also agregate the logs/calls from the code itself?

#### How do we handle the time-traveling debugging?
How would debugging with the FC snapshots work? We have the memory snapshot and we can restore it, but what can user change in the state to debug? If the agent exposes a server with internal state we can snapshot between the requests and let them make different request, but what if they want to modify the code itself? If the core is already running in the snapshot we won't be able to do that. So the question is if changing the queries is the thing we want to support with the debugging. One other thing could be that we can dive you snapshots of the environemnt with all the artifacts and files too. But still maybe the debugging on a "code" level will require a different approach - maybe also partially on the code level (modal, inngest steps)?

#### The apps people want to debug are too big or require complex interaction that cannot be generalized (for example a whole nextjs app with a backend)
One potential obstacle with the debugging/development is that even though we don’t require any installation out of the box we do provide the environment. Therefore the app actually has to work in our environment :D. Right now agents are mostly smaller self contained programs that we can easily execute, but what if I have a setup like the smol developer e2b? Complicated nextjs project with python backend with env vars, etc., that I you need to interact with — that has both performance and interaction implications!
This here I think could be one on the reason why agent protocol is so useful for us - if agents are this smaller self contained programs/services that are not including the whole app we can more easily provide a debugging/development (you would just start the agent with e2b and call it separately or from the rest of the app you have started locally) AND deployment tailored for them, instead of having to become more or less Codespaces/Gitpod to handle the whole developer flow.

Theoretically because you never want to expose your LLM access publicly (because it is paid and people would abuse it) it will alaways be on some server so we can run is separatelly. One competing use case there is still the nextjs, because their backedn is built-in.
