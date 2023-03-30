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
import { Reference } from 'editor/referenceType'

type AutocompleteListRef = Partial<HTMLDivElement> & { onKeyDown: (props: SuggestionKeyDownProps) => boolean }
export interface AutocompleteListProps extends SuggestionProps<Reference> { }

export type AutocompleteList = ForwardRefExoticComponent<AutocompleteListProps & RefAttributes<AutocompleteListRef>>

export interface AutocompleteListWrapperProps extends SuggestionProps<Reference> {
  list: AutocompleteList
}

class AutocompleteListWrapper extends Component<AutocompleteListWrapperProps, {}, {}> {
  childRef: RefObject<AutocompleteListRef>

  constructor(public props: AutocompleteListWrapperProps) {
    super(props)
    this.childRef = createRef<AutocompleteListRef>()
  }

  onKeyDown(props: SuggestionKeyDownProps) {
    return this.childRef.current?.onKeyDown(props)
  }

  render() {
    return createElement(this.props.list, { ...this.props, ref: this.childRef, }, null)
  }
}

export default AutocompleteListWrapper
