import clsx from 'clsx'
import {
  PointerEvent,
  FocusEvent,
  useEffect,
  useRef,
  useState,
  CSSProperties,
} from 'react'

type Tab = { label: string; id: string }

type Props = {
  selectedTabIndex: number
  tabs: Tab[]
  setSelectedTab: (input: number) => void
}

function Tab({
  tabs,
  selectedTabIndex,
  setSelectedTab,
}: Props) {
  const [buttonRefs, setButtonRefs] = useState<Array<HTMLButtonElement | null>>(
    []
  )

  useEffect(() => {
    setButtonRefs((prev) => prev.slice(0, tabs.length))
  }, [tabs.length])

  const [hoveredTabIndex, setHoveredTabIndex] = useState<number | null>(null)
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)

  const navRef = useRef<HTMLDivElement>(null)
  const navRect = navRef.current?.getBoundingClientRect()

  const selectedRect = buttonRefs[selectedTabIndex]?.getBoundingClientRect()

  const [isInitialHoveredElement, setIsInitialHoveredElement] = useState(true)
  const isInitialRender = useRef(true)

  const onLeaveTabs = () => {
    setIsInitialHoveredElement(true)
    setHoveredTabIndex(null)
  }

  const onEnterTab = (
    e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    i: number
  ) => {
    if (!e.target || !(e.target instanceof HTMLButtonElement)) return

    setHoveredTabIndex((prev) => {
      if (prev != null && prev !== i) {
        setIsInitialHoveredElement(false)
      }

      return i
    })
    setHoveredRect(e.target.getBoundingClientRect())
  }

  const onSelectTab = (i: number) => {
    setSelectedTab(i)
  }

  let hoverStyles: CSSProperties = { opacity: 0 }
  if (navRect && hoveredRect) {
    hoverStyles.transform = `translate3d(${hoveredRect.left - navRect.left}px,${hoveredRect.top - navRect.top
      }px,0px)`
    hoverStyles.width = hoveredRect.width
    hoverStyles.height = hoveredRect.height
    hoverStyles.opacity = hoveredTabIndex != null ? 1 : 0
    hoverStyles.transition = isInitialHoveredElement
      ? 'opacity 150ms'
      : 'transform 150ms 0ms, opacity 150ms 0ms, width 150ms'
  }

  let selectStyles: CSSProperties = { opacity: 0 }
  if (navRect && selectedRect) {
    selectStyles.width = selectedRect.width * 0.8
    selectStyles.transform = `translateX(calc(${selectedRect.left - navRect.left
      }px + 10%))`
    selectStyles.opacity = 1
    selectStyles.transition = isInitialRender.current
      ? 'opacity 150ms 150ms'
      : 'transform 150ms 0ms, opacity 150ms 150ms, width 150ms'

    isInitialRender.current = false
  }

  return (
    <nav
      ref={navRef}
      className="
        flex
        shrink-0
        justify-center
        items-center
        relative
        z-0
      "
      onPointerLeave={onLeaveTabs}
    >
      {tabs.map((item, i) => {
        return (
          <button
            key={i}
            className={clsx(
              `relative
              rounded-md
              flex
              items-center
              justify-center
              h-8
              z-20
              bg-transparent
              text-xs
              cursor-pointer
              select-none
              transition-colors
              border-green-800
              px-2
              `,
              {
                'text-slate-400': hoveredTabIndex !== i && selectedTabIndex !== i,
              },
              {
                'text-green-800': hoveredTabIndex === i || selectedTabIndex === i,
              }
            )}
            ref={(el) => (buttonRefs[i] = el)}
            onPointerEnter={(e) => onEnterTab(e, i)}
            onFocus={(e) => onEnterTab(e, i)}
            onClick={() => onSelectTab(i)}
          >
            {item.label}
          </button>
        )
      })}
      <div
        className="
          absolute
          z-10
          top-0
          left-0
          rounded-md
          bg-green-400
        "
        style={hoverStyles}
      />
      {/* <div
        className="
          absolute
          z-10
          bottom-0
          left-0
          h-0.5
          bg-green-800
        "
        style={selectStyles}
      /> */}
    </nav>
  )
}

export default Tab
