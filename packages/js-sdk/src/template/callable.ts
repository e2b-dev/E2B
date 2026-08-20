import type { TemplateBase } from './index'
import type { TemplateFromImage, TemplateOptions } from './types'

/**
 * A template class that can also be called without `new`.
 *
 * @internal
 * @hidden
 * @hide
 */
export type CallableTemplate<T extends typeof TemplateBase> = T &
  ((options?: TemplateOptions) => TemplateFromImage)

/**
 * Make a template class callable as a factory, so `Template(opts)` keeps
 * returning a builder, and keep the statics usable when they are pulled off the
 * class on their own (`const { build } = Template`). Everything else —
 * construction, `instanceof`, subclassing — goes straight to the class.
 *
 * @internal
 * @hidden
 * @hide
 */
export function callableTemplate<T extends typeof TemplateBase>(
  cls: T
): CallableTemplate<T> {
  const bound = new WeakMap<object, Map<PropertyKey, unknown>>()

  return new Proxy(cls, {
    apply(target, _thisArg, args: [TemplateOptions?]) {
      return new target(...args)
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      if (prop === 'prototype' || typeof value !== 'function') {
        return value
      }

      // Statics resolve their options off the class they are called on, so they
      // are bound to it to keep working detached from it. The class accessed
      // through a subclass is the subclass, so its own options are kept.
      const self = (
        typeof receiver === 'function' ? receiver : target
      ) as object

      let methods = bound.get(self)
      if (!methods) {
        methods = new Map()
        bound.set(self, methods)
      }

      let method = methods.get(prop)
      if (!method) {
        method = value.bind(self)
        methods.set(prop, method)
      }

      return method
    },
  }) as CallableTemplate<T>
}
