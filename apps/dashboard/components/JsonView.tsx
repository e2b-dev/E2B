import dynamic from 'next/dynamic'

const JsonView = dynamic(import('react-json-view'), { ssr: false })

export default JsonView
