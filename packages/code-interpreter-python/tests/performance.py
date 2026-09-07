from e2b_code_interpreter import Sandbox
import time
import os
import statistics
import matplotlib.pyplot as plt

iterations_count = int(os.getenv("E2B_TESTS_BENCHMARK_ITERATIONS_COUNT", 20))
template = os.getenv("E2B_TESTS_TEMPLATE", "code-interpreter-v1")

# Lists to store metrics for each iteration
sandbox_creation_times = []
health_check_times = []
first_code_run_times = []
second_code_run_times = []

for i in range(iterations_count):
    print(f"\n--- Iteration {i + 1}/{iterations_count} ---")

    start_time = time.time()
    sbx = Sandbox.create(template=template)
    end_time = time.time()
    sandbox_creation_time = (end_time - start_time) * 1000
    sandbox_creation_times.append(sandbox_creation_time)
    print(f"Sandbox creation time: {sandbox_creation_time:.2f} milliseconds")

    start_time = time.time()
    sbx.commands.run("curl http://0.0.0.0:49999/health")
    end_time = time.time()
    health_check_time = (end_time - start_time) * 1000
    health_check_times.append(health_check_time)
    print(f"Health check time: {health_check_time:.2f} milliseconds")

    start_time = time.time()
    sbx.run_code("print('Hello, world!')")
    end_time = time.time()
    first_code_run_time = (end_time - start_time) * 1000
    first_code_run_times.append(first_code_run_time)
    print(f"First code run time: {first_code_run_time:.2f} milliseconds")

    start_time = time.time()
    sbx.run_code("print('Hello, world!')")
    end_time = time.time()
    second_code_run_time = (end_time - start_time) * 1000
    second_code_run_times.append(second_code_run_time)
    print(f"Second code run time: {second_code_run_time:.2f} milliseconds")

    sbx.kill()


# Calculate and print summary statistics
def print_metric_summary(metric_name, times):
    if not times:
        return

    low = min(times)
    high = max(times)
    mean = statistics.mean(times)
    median = statistics.median(times)

    print(f"\n{metric_name} Summary:")
    print(f"  Low:    {low:.2f} ms")
    print(f"  High:   {high:.2f} ms")
    print(f"  Mean:   {mean:.2f} ms")
    print(f"  Median: {median:.2f} ms")


print("\n" + "=" * 50)
print("PERFORMANCE SUMMARY")
print("=" * 50)

print_metric_summary("Sandbox Creation Time", sandbox_creation_times)
print_metric_summary("Health Check Time", health_check_times)
print_metric_summary("First Code Run Time", first_code_run_times)
print_metric_summary("Second Code Run Time", second_code_run_times)


def create_performance_plot(
    template,
    iterations_count,
    sandbox_creation_times,
    health_check_times,
    first_code_run_times,
    second_code_run_times,
):
    """Create and save a performance visualization plot."""
    print("\nGenerating performance plot...")
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))

    # Plot 1: All metrics over iterations
    iterations = list(range(1, iterations_count + 1))
    ax1.plot(
        iterations,
        sandbox_creation_times,
        "b-o",
        label="Sandbox Creation",
        linewidth=1.5,
        markersize=6,
        markerfacecolor="blue",
        markeredgecolor="darkblue",
        markeredgewidth=1,
    )
    ax1.plot(
        iterations,
        health_check_times,
        "g-s",
        label="Health Check",
        linewidth=1.5,
        markersize=6,
        markerfacecolor="green",
        markeredgecolor="darkgreen",
        markeredgewidth=1,
    )
    ax1.plot(
        iterations,
        first_code_run_times,
        "r-^",
        label="First Code Run",
        linewidth=1.5,
        markersize=6,
        markerfacecolor="red",
        markeredgecolor="darkred",
        markeredgewidth=1,
    )
    ax1.plot(
        iterations,
        second_code_run_times,
        "m-d",
        label="Second Code Run",
        linewidth=1.5,
        markersize=6,
        markerfacecolor="magenta",
        markeredgecolor="darkmagenta",
        markeredgewidth=1,
    )

    ax1.set_xlabel("Iteration")
    ax1.set_ylabel("Time (ms)")
    ax1.set_title(
        f"Performance Metrics Over {iterations_count} Iterations - {template}"
    )
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Set x-axis to show each iteration step
    ax1.set_xticks(iterations)
    ax1.set_xlim(0.5, iterations_count + 0.5)

    # Plot 2: Box plot for distribution
    all_metrics = [
        sandbox_creation_times,
        health_check_times,
        first_code_run_times,
        second_code_run_times,
    ]
    metric_names = [
        "Sandbox\nCreation",
        "Health\nCheck",
        "First Code\nRun",
        "Second Code\nRun",
    ]

    box_plot = ax2.boxplot(all_metrics, tick_labels=metric_names, patch_artist=True)
    colors = ["lightblue", "lightgreen", "lightcoral", "plum"]
    for patch, color in zip(box_plot["boxes"], colors):
        patch.set_facecolor(color)

    ax2.set_ylabel("Time (ms)")
    ax2.set_title(f"Performance Distribution - {template}")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()

    # Show summary statistics in the plot
    stats_text = f"""Summary Statistics:
Sandbox Creation: {statistics.mean(sandbox_creation_times):.1f}ms avg
Health Check: {statistics.mean(health_check_times):.1f}ms avg
First Code Run: {statistics.mean(first_code_run_times):.1f}ms avg
Second Code Run: {statistics.mean(second_code_run_times):.1f}ms avg"""

    fig.text(
        0.02,
        0.02,
        stats_text,
        fontsize=8,
        verticalalignment="bottom",
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.8),
    )

    # Save the plot
    plot_filename = "performance_plot.png"
    plt.savefig(plot_filename, dpi=300, bbox_inches="tight")
    print(f"Performance plot saved as: {plot_filename}")

    return plot_filename


# Create performance plot
create_performance_plot(
    template,
    iterations_count,
    sandbox_creation_times,
    health_check_times,
    first_code_run_times,
    second_code_run_times,
)
