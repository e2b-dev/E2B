import { ReactNode } from 'react'

import NodeJSIcon from 'components/icons/Nodejs'
import NodeJSExpressTemplate from 'components/Editor/Template/NodeJSExpressTemplate'

import { PromptFragment } from './prompt'
import StripeCheckoutTemplate from 'components/Editor/Template/StripeCheckoutTemplate'

export enum TemplateID {
  NodeJSExpress = 'NodeJSExpress',
  StripeCheckout = 'StripeCheckout',
}

export interface Template {
  component: ReactNode
  prompt: PromptFragment[]
  description: string
  stackDescription: string
  icon: ReactNode
}

export const templates: {
  [templateID in keyof typeof TemplateID]: Template
} = {
  [TemplateID.NodeJSExpress]: {
    description: 'REST API Server',
    stackDescription: 'JavaScript + Express',
    component: <NodeJSExpressTemplate />,
    icon: <NodeJSIcon />,
    prompt: [
      {
        role: 'system',
        type: 'prefix',
        content: '<p>You are an AI JavaScript developer assistant:</p><p>You are building an Express server that handles REST API.</p><p>The <code>express</code> package is already installed.</p><p>Follow the user\'s instructions carefully &amp; to the letter.</p><p>Minimize any other prose.</p><p>You have access to the following tools:\n</p>',
      },
      {
        role: 'system',
        type: 'suffix',
        content: '<p>The way you use the tools is by specifying a XML snippet.</p><p>The XML snippet MUST have a <code>&lt;action tool="$TOOL_NAME"&gt;$INPUT&lt;/action&gt;</code> element with the name of the tool in the <code>tool</code> attribute and input for the tool inside the XML tag.</p><p></p><p>Here is an example of a valid XML snippet:</p><p>&lt;action tool="$TOOL_NAME"&gt;</p><p>$INPUT</p><p>&lt;/action&gt;</p><p></p><p>ALWAYS use the following format:</p><p>Thought: you should always think about what to do</p><p>Action:</p><p>&lt;action tool="$TOOL_NAME"&gt;</p><p>$INPUT</p><p>&lt;/action&gt;</p><p>Observation: the result of the action</p><p>... (this Thought/Action/Observation can repeat N times)</p><p>Thought: I now know the final server code and can show it.</p><p>Final Answer: the final answer</p>',
      },
      {
        role: 'user',
        type: 'prefix',
        content: '<p>{{#Routes}}</p><p>The handler you are building should do the following:</p><p>{{Description}}</p><p></p><p>{{#RequestBody}}</p><p>The incoming request body is JSON that looks like this:</p><pre><code>{\n{{RequestBody}}\n}</code></pre><p>{{/RequestBody}}</p><p></p><p>Use this starting template:</p><pre><code>import express from \'express\';\nconst app = express();\nconst port = 3000;\napp.use(express.json())\n\n// TODO: Implement the {{Method}} handler here\n\napp.listen(port, async () =&gt; {\n    console.log(`Server listening on port ${ port }`)\n})</code></pre><p>The HTTP request handler is of type {{Method}}.</p><p>The request handler MUST be on the route <code>{{Path}}</code>.</p><p>Do not forget to use async and await.</p><p>Always test that the generated server works without bugs and errors as required by running the code and making mock <code>curl</code> requests to the server.</p><p>Generate the full required server code.</p><p></p><p>{{#Instructions}}</p><p>Here are the required implementation instructions:</p><p>{{Instructions}}</p><p>{{/Instructions}}</p><p>{{/Routes}}</p><p>Thought: Here is the plan of how I will go about solving this:</p>',
      },
    ],
  },
  [TemplateID.StripeCheckout]: {
    description: 'Stripe',
    stackDescription: 'Next.js + Stripe',
    component: <StripeCheckoutTemplate />,
    icon: <NodeJSIcon />,
    prompt: [
      {
        role: 'system',
        type: 'prefix',
        content: '<p>You are an AI JavaScript developer assistant:</p><p>You are building an Express server that handles REST API.</p><p>The <code>express</code> package is already installed.</p><p>Follow the user\'s instructions carefully &amp; to the letter.</p><p>Minimize any other prose.</p><p>You have access to the following tools:\n</p>',
      },
      {
        role: 'system',
        type: 'suffix',
        content: '<p>The way you use the tools is by specifying a XML snippet.</p><p>The XML snippet MUST have a <code>&lt;action tool="$TOOL_NAME"&gt;$INPUT&lt;/action&gt;</code> element with the name of the tool in the <code>tool</code> attribute and input for the tool inside the XML tag.</p><p></p><p>Here is an example of a valid XML snippet:</p><p>&lt;action tool="$TOOL_NAME"&gt;</p><p>$INPUT</p><p>&lt;/action&gt;</p><p></p><p>ALWAYS use the following format:</p><p>Thought: you should always think about what to do</p><p>Action:</p><p>&lt;action tool="$TOOL_NAME"&gt;</p><p>$INPUT</p><p>&lt;/action&gt;</p><p>Observation: the result of the action</p><p>... (this Thought/Action/Observation can repeat N times)</p><p>Thought: I now know the final server code and can show it.</p><p>Final Answer: the final answer</p>',
      },
      {
        role: 'user',
        type: 'prefix',
        content: '<p>{{#Routes}}</p><p>The handler you are building should do the following:</p><p>{{Description}}</p><p></p><p>{{#RequestBody}}</p><p>The incoming request body is JSON that looks like this:</p><pre><code>{\n{{RequestBody}}\n}</code></pre><p>{{/RequestBody}}</p><p></p><p>Use this starting template:</p><pre><code>import express from \'express\';\nconst app = express();\nconst port = 3000;\napp.use(express.json())\n\n// TODO: Implement the {{Method}} handler here\n\napp.listen(port, async () =&gt; {\n    console.log(`Server listening on port ${ port }`)\n})</code></pre><p>The HTTP request handler is of type {{Method}}.</p><p>The request handler MUST be on the route <code>{{Path}}</code>.</p><p>Do not forget to use async and await.</p><p>Always test that the generated server works without bugs and errors as required by running the code and making mock <code>curl</code> requests to the server.</p><p>Generate the full required server code.</p><p></p><p>{{#Instructions}}</p><p>Here are the required implementation instructions:</p><p>{{Instructions}}</p><p>{{/Instructions}}</p><p>{{/Routes}}</p><p>Thought: Here is the plan of how I will go about solving this:</p>',
      },
    ],
  },
}

export const defaultTemplateID = TemplateID.NodeJSExpress
