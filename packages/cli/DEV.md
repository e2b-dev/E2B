# DEV

**The core ideology**
https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46

## Setup

How to setup building, package.json, etc.

## Useful packages

- chalk — colorizes the output
- clear — clears the terminal screen
- clui — draws command-line tables, gauges and spinners
- figlet — creates ASCII art from text
- inquirer — creates interactive command-line user interface
- config — easily loads and saves config without you having to think about where and how.
- shelljs - to allow bash like
- boxen - create boxes
- pkg - package executable
- progress - for loaders (alternatives - cli-progress)
- commander - parsign args and handling commands (alternatives - minimist, yargs)
- update-notifier - adds notifications about updates

## QOL improvement to standard CLI development/maintanence/usage

- octa/web auth?
- docs generation
- add to homebrew
- multiplatform support
- spellcheck (find package for this!)
- ci/cd versioning + version control of the whole cli that you can track
- automatic updater
- option to add [y/N] check before executing command and password protected commands
- add fast automatic updating - either via downloading new CLI version or by downloading part of a command from some central DB that the command maintainer can quickly modify to reflect changes to the workflow

## Best Practices for Offering a CLI

Now that we’ve evidenced a growing trend of CLI support across the industry, what best practices are there for maintaining one?

Juniper vs Cisco: Compare the two main CLI style families, and see which works best for you. Ideskog favors the Juniper style for its structure, consistency, and well-defined elements.

Design it to be transactional: As Ideskog notes, “this is VERY important. When you work in a CLI you need to be able to prepare your configuration, validate it, compare it with what you have, and then in the end commit (apply) it in one single step.”

Clearly separate operational and configuration data: Operational data are things like statistics and uptime, and are dissimilar from configuration such as ports and hosts. The differentiation should be obvious in the design. Ideskog warns to never allow configuration to depend on operational state:

“An example is an interface that can only be configured if it’s connected to the Internet. This means that the configuration may have been valid when the admin set it the first time, but when internet connection goes down, what do you do then? The configuration is suddenly invalid. This is a bad property of a system. It makes it very hard to pre-provision a system, since you cannot tell beforehand if the configuration is valid or not.”

Let the model drive the CLI for ultimate consistency: For Amazon, in order to reach a consistent command line experience across thousands of commands, they did the following:

“We decided to auto-generate commands and options from the underlying models that describe AWS APIs. This strategy has enabled us to deliver timely support for new AWS services and API updates with a consistent style of commands.”

Shoot for CLI-API-GUI parity: If you follow a model-driven paradigm, every single CLI command should be accessible as an API call, and vice versa. As API Evangelists notes, the AWS API and CLI are pretty much in sync in terms of functionalities:

“Making sure there is parity and consistency between what is available via a UI, and the API and CLI is important.”

Be careful about evolvability, especially when updating. Command documentation, API docs, and functionality must remain in sync. As Jeff Browning said:

“CLIs are hardwired scripts that work well in the short term but don’t evolve as gracefully as true integration”

Adam DuVander of Zapier lists some great CLI best practices in his article [here](https://zapier.com/engineering/how-to-cli/), some of which are summarized below.

Provide a help screen: Usability and discovery are very important for CLIs. Make accessing a Getting Started guide easy with simple flags like -h or ?
Offer tab completion.
Steal from the champions. Replicate patterns from Linux commands that work, and take advantage of succinct commands.
Offer customization options.
Make security a high priority.
If desktop-based, support different OSs and developer environments so that no teammate is left in the lurch.

slack-cli quotes (https://slack.engineering/the-joy-of-internal-tools-4a1bb5fe905b):

"A good rule of thumb for a development tool is this: if a developer has to stop what she’s doing and open a browser window for the next step in her work, then that task is a good candidate for building tooling around."

Syncing files between developer machines and remote servers every time a file is saved.
Distributing canonical SSH configurations from our ops team to engineers’ laptops.
Automating installation of common git and bash configurations.
Helpers for working with git — creating branches that are cross-referenced with our internal bug tracker, for example, or reverting Pull Requests with a single command.
Tools for generating fake data on development servers or fixtures for writing unit tests.

https://github.com/slackhq/magic-cli

---

https://github.com/OpenAPITools/openapi-generator#openapi-generator

https://github.com/Byron/google-apis-rs

https://github.com/google/python-fire

https://github.com/danielgtaylor/openapi-cli-generator

https://auth0.com/blog/auth0-internal-dev-tools-unleashing-engineering-potential/

https://github.com/vadimdemedes/ink

https://github.com/chjj/blessed

https://github.com/Yomguithereal/react-blessed
