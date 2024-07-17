import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import LineChart from '@/components/Dashboard/Chart'
import Spinner from '@/components/Spinner'
import { toast } from '@/components/ui/use-toast'

type Usage = {
  month: number
  year: number
  unpaid_cost: number
}

const usageUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/usage`

export const UsageContent = ({ currentApiKey }: { currentApiKey: string | null }) => {
  const [vcpuData, setVcpuData] = useState<any>(null)
  const [vcpuHoursThisMonth, setVcpuHoursThisMonth] = useState<number | undefined>()
  const [ramData, setRamData] = useState<any>(null)
  const [ramHoursThisMonth, setRamHoursThisMonth] = useState<number | undefined>()
  const [costUsage, setCostUsage] = useState<{ id: string; data: any }[]>([])
  const [costThisMonth, setCostMonth] = useState<number | undefined>()

  useEffect(() => {
    const getUsage = async (apiKey: string) => {
      setVcpuData(null)
      setRamData(null)
      setCostUsage([])

      const response = await fetch(usageUrl, {
        headers: {
          'X-Team-API-Key': apiKey
        }
      })
      if (!response.ok) {
        // TODO: Add sentry event here
        toast({
          title: 'An error occurred',
          description: 'We were unable to fetch the usage data',
        })
        console.log(response)
        return
      }

      const data = await response.json()
      const { vcpuSeries, ramSeries } = transformData(data.usages)

      const costData = transformCostData(data.usages)
      const latestCost = costData[0].data[costData[0].data.length - 1]
      setCostUsage(costData)
      setCostMonth(latestCost.y)

      setVcpuData(vcpuSeries)
      setVcpuHoursThisMonth(vcpuSeries[0].data[vcpuSeries[0].data.length - 1].y)

      setRamData(ramSeries)
      setRamHoursThisMonth(ramSeries[0].data[ramSeries[0].data.length - 1].y)
    }
    if (currentApiKey) {
      getUsage(currentApiKey)
    }
  }, [currentApiKey])

  return (
    <div className='flex flex-col w-full h-full pb-10'>
      <div className='pb-10'>
        <h2 className='font-bold pb-4 text-xl'>Usage history</h2>
        <p>
          The graphs show the total monthly vCPU-hours and RAM-hours used by the team. <br />
        </p>
      </div>

      <div className='flex flex-col 2xl:flex-row w-full space-y-4 2xl:space-y-0 2xl:space-x-4'>

        <div className='flex flex-col w-full md:w-2/3'>
          <h2 className='font-bold pb-4 text-xl'>Costs in USD</h2>
          {costUsage && costUsage.length > 0 ?
            <div className="flex flex-col space-y-2">
              <span className='text-sm text-white/50'>Total costs this month: <b>${costThisMonth?.toFixed(2)}</b></span>
              <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
                <CardContent>
                  <LineChart className='aspect-[4/3]' series={costUsage} type='Cost' />
                </CardContent>
              </Card>
            </div>
            : (
              <div className="flex items-center justify-center w-full">
                <Spinner />
              </div>
            )
          }
        </div>

        <div className='flex flex-col w-full md:w-2/3'>
          <h2 className='font-bold pb-4 text-xl'>vCPU hours</h2>
          {vcpuData ?
            <div className="flex flex-col space-y-2">
              <span className='text-sm text-white/50'>Total vCPU hours this month: <b>{vcpuHoursThisMonth?.toFixed(2)}</b></span>
              <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
                <CardContent>
                  <LineChart className='aspect-[4/3]' series={vcpuData} type='vCPU' />
                </CardContent>
              </Card>
            </div>
            : (
              <div className="flex items-center justify-center w-full">
                <Spinner />
              </div>
            )}
        </div>

        <div className='flex flex-col w-full md:w-2/3'>
          <h2 className='font-bold pb-4 text-xl'>RAM hours</h2>
          {ramData ?
            <div className="flex flex-col space-y-2">
              <span className='text-sm text-white/50'>Total RAM hours this month: <b>{ramHoursThisMonth?.toFixed(2)}</b></span>
              <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
                <CardContent>
                  <LineChart className='aspect-[4/3]' series={ramData} type='RAM' />
                </CardContent>
              </Card>
            </div>
            : (
              <div className="flex items-center justify-center w-full">
                <Spinner />
              </div>
            )}
        </div>

      </div>
    </div>
  )
}

const transformCostData = (usage: any) => {
  const costData = usage.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y: usage.template_usage.length > 0
        ? usage.template_usage.reduce((acc: number, template: any) => acc + template.total_cost, 0)
        : 0,
    }
  })

  return [
    {
      id: 'Cost',
      data: costData,
    },
  ]
}

const transformData = (usages: any) => {
  const ramData = usages.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y: usage.template_usage.length > 0
        ? usage.template_usage.reduce((acc: number, template: any) => acc + template.ram_gb_hours, 0)
        : 0,
    }
  })

  const vpcData = usages.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y: usage.template_usage.length > 0
        ? usage.template_usage.reduce((acc: number, template: any) => acc + template.sandbox_hours, 0)
        : 0,
    }
  })

  return {
    vcpuSeries: [
      {
        id: 'vCPU Hours',
        data: vpcData,
      },
    ],
    ramSeries: [
      {
        id: 'RAM Usage',
        data: ramData,
      },
    ],
  }
}

