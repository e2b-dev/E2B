import {
  createRef,
  ForwardRefExoticComponent,
  Component,
  createElement,
  RefAttributes,
  RefObject,
} from 'react'

import {
  SuggestionProps,
  SuggestionKeyDownProps,
} from 'editor/extensions/command/suggestion'

type CommandListRef = Partial<HTMLDivElement> & { onKeyDown: (props: SuggestionKeyDownProps) => boolean }
export interface CommandListProps extends SuggestionProps { }

export type CommandList = ForwardRefExoticComponent<CommandListProps & RefAttributes<CommandListRef>>

export interface CommmandListWrapperProps extends SuggestionProps {
  list: CommandList
}

class CommandListWrapper extends Component<CommmandListWrapperProps, {}, {}> {
  childRef: RefObject<CommandListRef>

  constructor(public props: CommmandListWrapperProps) {
    super(props)
    this.childRef = createRef<CommandListRef>()
    props.list.name
  }

  onKeyDown(props: SuggestionKeyDownProps) {
    return this.childRef.current?.onKeyDown(props)
  }

  render() {
    return createElement(this.props.list, { ...this.props, ref: this.childRef, }, null)
  }
}

export default CommandListWrapper