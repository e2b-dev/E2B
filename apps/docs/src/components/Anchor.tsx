import { css } from '@stitches/core'
import { generateClassNames } from '@supabase/auth-ui-shared'
import { Appearance } from '../../types'

const anchorHTMLAttributes = css({
  fontFamily: '$bodyFontFamily',
  fontSize: '$baseBodySize',
  marginBottom: '$anchorBottomMargin',
  color: '$anchorTextColor',
  display: 'block',
  textAlign: 'center',
  textDecoration: 'underline',
  '&:hover': {
    color: '$anchorTextHoverColor',
  },
})

interface LabelProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode
  appearance?: Appearance
}

const Anchor: React.FC<LabelProps> = ({ children, appearance, ...props }) => {
  const classNames = generateClassNames(
    'anchor',
    anchorHTMLAttributes(),
    appearance
  )

  return (
    <a
      {...props}
      style={appearance?.style?.anchor}
      className={classNames.join(' ')}
    >
      {children}
    </a>
  )
}

export { Anchor }
