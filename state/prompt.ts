import { html2markdown } from 'editor/schema'
import Mustache from 'mustache'

import { Block, PromptPart } from 'state/store'

export const defaultPromptTemplate: PromptPart[] = [
  {
    role: 'system',
    type: 'prefix',
    content: `You are an AI JavaScript developer assistant.
- You are building an Express server that handles REST API.
- The \`express\` package is already installed.
- Follow the user's instructions carefully & to the letter.
- Minimize any other prose.
- You have access to the following tools:
`,
  },
  {
    role: 'system',
    type: 'instructionsFormat',
    content: `The way you use the tools is by specifying a XML snippet.
The XML snippet MUST have a \`<action tool="$TOOL_NAME">$INPUT</action>\` element with the name of the tool in the \`tool\` attribute and input for the tool inside the XML tag.

Here is an example of a valid XML snippet:
<action tool="$TOOL_NAME">
$INPUT
</action>

ALWAYS use the following format:

Thought: you should always think about what to do
Action:
<action tool="$TOOL_NAME">
$INPUT
</action>
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final server code and can show it.
Final Answer: the final answer
`,
  },
  {
    role: 'system',
    type: 'suffix',
    content: '',
  },
  {
    role: 'user',
    type: 'prefix',
    content: '<p>The handler you are building should do the following:</p><p>{{Description}}</p><p>Do not try to come up with solutions and code if you do not know. Instead, use the tool <code>AskHuman</code> to ask for help.</p><p>If you think there might be multiple paths forward, use the tool <code>LetHumanChoose</code> to choose from them.</p><p>{{#RequestBody}}</p><p>The incoming request body is JSON that looks like this:</p><pre><code>{\n{{RequestBody}}\n}</code></pre><p>{{/RequestBody}}</p><p>Use this starting template:</p><pre><code>import express from \'express\';\nconst app = express();\nconst port = 3000;\napp.use(express.json())\n\n// TODO: Implement the {{Method}} handler here\n\napp.listen(port, async () =&gt; {\n    console.log(`Server listening on port ${ port }`)\n})</code></pre><p>The HTTP request handler is of type {{Method}}</p><p>The request handler MUST be on the route <code>{{Route}}</code></p><p>Do not forget to use async and await</p><p>Always test that the generated server works without bugs and errors as required by running the code and making mock <code>curl</code> requests to the server</p><p>Generate the full required server code</p><p>{{#Instructions}}</p><p>Here are the required implementation instructions:</p><p>{{Instructions}}</p><p>{{/Instructions}}</p><p>Thought: Here is the plan of how I will go about solving this:</p><p></p>',
  },
]

interface BlockMap {
  [blockType: string]: string
}

export function evaluatePrompt(
  blocks: Block[],
  promptTemplate: PromptPart[],
  additionalArgs: {
    Method: string,
    Route: string,
  },
) {
  const blockMap = blocks
    // Transform XML from ProseMirror to text
    .map(b => {
      switch (b.type) {
        case 'Description':
        case 'Instructions':
          // TODO: Use the references to build context
          const [markdown, references] = html2markdown(b.content)
          const block: Block = {
            ...b,
            content: markdown,
          }
          return block
        default:
          return b
      }
    })
    .reduce<BlockMap>((prev, curr) => {
      prev[curr.type] = curr.content
      return prev
    }, {})

  const evalutedPrompt = promptTemplate.map(t => {
    // TODO: Use the references to build context
    const [markdown, references] = html2markdown(t.content)
    return {
      ...t,
      content: Mustache.render(markdown, {
        ...additionalArgs,
        ...blockMap,
      }),
    }
  })

  return evalutedPrompt
}
