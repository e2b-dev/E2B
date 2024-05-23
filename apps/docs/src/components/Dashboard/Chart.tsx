import { ResponsiveBar } from '@nivo/bar'

// If you wonder how to style this chart, I highly recommend this interactive tool: https://nivo.rocks/bar/
export default function BarChart({ ...props }) {
  return (
    <div {...props}>
      <ResponsiveBar
        data={[
          { name: 'Jan', amount: 111 },
          { name: 'Feb', amount: 157 },
          { name: 'Mar', amount: 129 },
          { name: 'Apr', amount: 150 },
          { name: 'May', amount: 119 },
          { name: 'Jun', amount: 72 },
        ]}
        keys={['amount']}
        indexBy="name"
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        padding={0.2}
        colors={['#FFAF78']}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickValues: 4,
          tickPadding: 16,
        }}
        gridYValues={4}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: '#f3f4f6',
                fontSize: 12,
              },
            },
          },
          grid: {
            line: {
              stroke: '#f3f4f6',
            },
          },
        }}
        isInteractive={false}
        borderRadius={4} // Apply a border radius to the top corners of the bars
        tooltipLabel={({ id }) => `${id}`}
        enableLabel={true}
        role="application"
        ariaLabel="A bar chart showing data"
      />
    </div>
  )
}

