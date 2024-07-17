import { ResponsiveLine } from '@nivo/line'

const generateTicks = (minValue: number, maxValue: number, numTicks: number): number[] => {
  const range = maxValue - minValue
  const step = range / (numTicks - 1)

  // Determine magnitude of the step to round it to a sensible value
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)))
  const roundedStep = Math.ceil(step / magnitude) * magnitude

  // Round minValue down to the nearest roundedStep
  const start = Math.floor(minValue / roundedStep) * roundedStep

  const ticks: number[] = []
  for (let i = 0; i < numTicks; i++) {
    ticks.push(start + i * roundedStep)
  }

  if (ticks[ticks.length - 1] < maxValue) {
    ticks.push(Math.ceil(maxValue / roundedStep) * roundedStep)
  }

  return ticks.map((tick) => parseFloat(tick.toFixed(2)))
}

// If you wonder how to style this chart, I highly recommend this interactive tool: https://nivo.rocks/line/
export default function LineChart({ series, ...props }) {
  
  const allValues = series.flatMap((s: any) => s.data.map((d: any) => d.y))
  const maxValue = Math.max(...allValues) // Add a 10% buffer to the maximum value

  const ticks = generateTicks(0, maxValue, 6)

  return (
    <div {...props}>
      <ResponsiveLine
        data={series}
        margin={{ top: 60, right: 30, bottom: 40, left: 50 }}
        colors={['#FF9F33']}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 16,
          tickValues: ticks,
        }}
        gridXValues={[]}
        gridYValues={ticks}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: '#f3f4f6',
                fontSize: 12,
                fontFamily: 'monospace',
              },
            },
          },
          grid: {
            line: {
              stroke: '#525252',
            },
          },
        }}
        isInteractive={true}
        tooltip={CustomTooltip}
        useMesh={true} 
        enableArea={true}
        enableCrosshair={false}
        defs={[
          {
            id: 'gradientA',
            type: 'linearGradient',
            colors: [
              { offset: 0, color: '#FF9F33' },
              { offset: 100, color: '#FF9F33', opacity: 0 },
            ],
          },
        ]}
        fill={[{ match: '*', id: 'gradientA' }]}
      />
    </div>
  )
}

const CustomTooltip = ({ point }) => (
  <div className='bg-[#F5F5F5] text-black text-xs py-1 px-2 rounded-lg border'>
    {point.data.y.toFixed(2)}
  </div>
)
