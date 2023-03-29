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
} from 'editor/extensions/autocomplete/suggestion'

type AutocompleteListRef = Partial<HTMLDivElement> & { onKeyDown: (props: SuggestionKeyDownProps) => boolean }
export interface AutocompleteListProps extends SuggestionProps { }

export type AutocompleteList = ForwardRefExoticComponent<AutocompleteListProps & RefAttributes<AutocompleteListRef>>

export interface AutocompleteListWrapperProps extends SuggestionProps {
  list: AutocompleteList
}

class AutocompleteListWrapper extends Component<AutocompleteListWrapperProps, {}, {}> {
  childRef: RefObject<AutocompleteListRef>

  constructor(public props: AutocompleteListWrapperProps) {
    super(props)
    this.childRef = createRef<AutocompleteListRef>()
    props.list.name
  }

  onKeyDown(props: SuggestionKeyDownProps) {
    return this.childRef.current?.onKeyDown(props)
  }

  render() {
    return createElement(this.props.list, { ...this.props, ref: this.childRef, }, null)
  }
}

export default AutocompleteListWrapper