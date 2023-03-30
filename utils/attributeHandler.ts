function attributeHandler({
  htmlPrefix,
  nodeAttribute,
}: {
  htmlPrefix?: string,
  nodeAttribute: string,
}) {
  const htmlAttribute = `${htmlPrefix ? htmlPrefix : ''}${nodeAttribute}`

  return {
    [nodeAttribute]: {
      default: undefined,
      parseHTML: (element: HTMLElement) => element.getAttribute(htmlAttribute),
      renderHTML: (attributes: Record<string, any>) => ({
        ...attributes[nodeAttribute] && { [htmlAttribute]: attributes[nodeAttribute] },
      }),
    },
  }
}

export default attributeHandler
