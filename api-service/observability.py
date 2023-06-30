from opentelemetry import metrics
from opentelemetry import trace

tracer = trace.get_tracer_provider().get_tracer(__name__)
meter = metrics.get_meter_provider().get_meter(__name__)

total_deployments_counter = meter.create_counter(
    "agents.deployments.total", "1", "Total number of agent deployments"
)

total_deployment_runs_counter = meter.create_counter(
    "agents.deployments.runs.total",
    "1",
    "Total number of agent deployment runs",
)
