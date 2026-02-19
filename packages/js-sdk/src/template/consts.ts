/**
 * Special step name for the finalization phase of template building.
 * This is the last step that runs after all user-defined instructions.
 * @internal
 */
export const FINALIZE_STEP_NAME = 'finalize'

/**
 * Special step name for the base image phase of template building.
 * This is the first step that sets up the base image.
 * @internal
 */
export const BASE_STEP_NAME = 'base'

/**
 * Stack trace depth for capturing caller information.
 *
 * Depth levels:
 * 1. Template function
 * 2. TemplateBase class
 * 3. Caller method (e.g., copy(), fromImage(), etc.)
 *
 * This depth is used to determine the original caller's location
 * for stack traces.
 * @internal
 */
export const STACK_TRACE_DEPTH = 3

/**
 * Default setting for whether to resolve symbolic links when copying files.
 * When false, symlinks are copied as symlinks rather than following them.
 * @internal
 */
export const RESOLVE_SYMLINKS = false
