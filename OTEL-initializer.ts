import { trace, context } from '@opentelemetry/api'
import { registerOTel } from '@vercel/otel'

registerOTel('agent-dashboard')

export const tracer = trace.getTracer('agent-dashboard-tracer')
export { context }
