import { ResponsiveBar } from '@nivo/bar'

const generateTicks = (minValue: number, maxValue: number, numTicks: number) => {
  const range = maxValue - minValue
  const step = range / (numTicks - 1)
  return Array.from({ length: numTicks }, (_, i) => (minValue + i * step).toFixed(2))
}

// If you wonder how to style this chart, I highly recommend this interactive tool: https://nivo.rocks/bar/
export default function BarChart({ usages, ...props }) {

  const allValues = usages.data.flatMap((item: any) =>
    Object.values(item).filter((value) => typeof value === 'number')
  )
  let maxValue = Math.max(...allValues)
  maxValue += maxValue * 0.1 // add a 10% buffer

  const ticks = generateTicks(0, maxValue, 5)

  return (
    <div {...props}>
      <ResponsiveBar
        data={usages.data}
        keys={usages.keys}
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
          tickPadding: 16,
        }}
        gridYValues={ticks}
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
        borderRadius={4}
        tooltipLabel={({ id }) => `${id}`}
        label={(d) => `${d.value!.toFixed(4)}`}
        enableLabel={true}
        labelSkipWidth={12}
        labelSkipHeight={12}
        maxValue={maxValue}
        role="application"
        ariaLabel={`A bar chart showing ${props.type}-hours per month broken down by template`}
      />
    </div>
  )
}
