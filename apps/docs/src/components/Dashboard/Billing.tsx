import { ResponsiveBar } from '@nivo/bar'

export const BillingContent = () => {
  return (
    <div className="flex flex-col w-full h-full">
      <div>
        <h2 className='font-bold pb-10 text-xl'>Billing history</h2>
      </div>
      <BarChart className="aspect-[6/3] w-2/3"/>
    </div>
  )
}

function BarChart(props: any) {
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
        margin={{ top: 0, right: 0, bottom: 40, left: 40 }}
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
          tooltip: {
            chip: {
              borderRadius: '9999px',
            },
            container: {
              fontSize: '12px',
              borderRadius: '6px',
              color: 'black',
            },
          },
          grid: {
            line: {
              stroke: '#f3f4f6',
            },
          },
        }}
        borderRadius={4} // Apply a border radius to the top corners of the bars
        tooltipLabel={({ id }) => `${id}`}
        enableLabel={false}
        role="application"
        ariaLabel="A bar chart showing data"
      />
    </div>
  )
}


