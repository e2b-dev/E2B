import { createDocument, getSchema } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import CodeBlock from '@tiptap/extension-code-block'
import Fuse from 'fuse.js'

import ReferenceExtension, {
  REFERENCE_TYPE_ATTRIBUTE_NAME,
  REFERENCE_VALUE_ATTRIBUTE_NAME,
} from 'editor/extensions/reference'
import AutocompleteExtension from 'editor/extensions/autocomplete'

export enum ReferenceType {
  NPMPackage = 'NPM_PACKAGE',
  DEPLOYMENT = 'DEPLOYMENT_SERVICE',
}

export interface Reference {
  type: ReferenceType
  value: string
}

export const referenceItems: Reference[] = [
  {
    type: ReferenceType.NPMPackage,
    value: '@slack/web-api',
  },
  {
    type: ReferenceType.DEPLOYMENT,
    value: 'AWS Lambda',
  },
]

const searchEngine = new Fuse(referenceItems, { keys: ['value'] })

export const extensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    // code: false,
    dropcursor: false,
    hardBreak: false,
    // heading: false,
    horizontalRule: false,
    italic: false,
    strike: false,

    // We use the Ordered List, Code block, Bullet List and List item from explicit packages
    // so we can use their names in the markdown serializer.
    codeBlock: false,
    bulletList: false,
    listItem: false,
    orderedList: false,
  }),
  CodeBlock,
  OrderedList,
  ListItem,
  BulletList,
  AutocompleteExtension.configure({
    suggestion: {
      items: (query) => searchEngine.search(query).map(q => q.item),
    },
  }),
  ReferenceExtension,
]

const schema = getSchema(extensions)

const serializer = new MarkdownSerializer({
  ...defaultMarkdownSerializer.nodes,
  [OrderedList.name]: defaultMarkdownSerializer.nodes.ordered_list,
  [ListItem.name]: defaultMarkdownSerializer.nodes.list_item,
  [BulletList.name]: defaultMarkdownSerializer.nodes.bullet_list,
  [CodeBlock.name]: defaultMarkdownSerializer.nodes.code_block,
  [ReferenceExtension.name]: (state, node) => {
    state.text(node.attrs[REFERENCE_VALUE_ATTRIBUTE_NAME])
  },
}, {
  ...defaultMarkdownSerializer.marks,
})

export function html2markdown(html: string): [string, Reference[]] {
  const node = createDocument(html, schema)
  const markdown = serializer.serialize(node)

  const references: Reference[] = []

  node.descendants(n => {
    if (n.type.name === ReferenceExtension.name) {
      references.push({
        type: n.attrs[REFERENCE_TYPE_ATTRIBUTE_NAME],
        value: n.attrs[REFERENCE_VALUE_ATTRIBUTE_NAME],
      })
    }
  })

  const uniqueReferences = references.filter((reference, index, self) =>
    index === self.findIndex((r) => (
      r.type === reference.type && r.value === reference.value
    ))
  )

  return [markdown, uniqueReferences]
}
