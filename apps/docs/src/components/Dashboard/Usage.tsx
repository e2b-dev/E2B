import { useEffect, useState } from 'react'
import { Card, CardContent } from '../ui/card'
import { LoaderIcon } from 'lucide-react'
import LineChart from './Chart'
import { toast } from '@/components/ui/use-toast'

type Usage = {
  month: number
  year: number
  unpaid_cost: number
}

const usageUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/usage`

export const UsageContent = ({ currentApiKey }: { currentApiKey: string | null }) => {
  const [vcpuData, setVcpuData] = useState<any>(null)
  const [ramData, setRamData] = useState<any>(null)
  const [costUsage, setUsage] = useState<Usage[]>([])

  useEffect(() => {
    const getUsage = async (apiKey: string) => {
      setVcpuData(null)
      setRamData(null)
      setUsage([])

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

      setUsage(data.usages)
      setVcpuData(vcpuSeries)
      setRamData(ramSeries)
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

      {vcpuData && ramData && costUsage ? (
        <div className='flex flex-col 2xl:flex-row w-full space-y-4 2xl:space-y-0 2xl:space-x-4'>

          <div className='flex flex-col w-full md:w-2/3'>
            <h2 className='font-bold pb-4 text-xl'>Costs in USD</h2>
            <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
              <CardContent>
                <LineChart className='aspect-[4/3]' series={transformCostData(costUsage)} type='Cost' />
              </CardContent>
            </Card>
          </div>

          <div className='flex flex-col w-full md:w-2/3'>
            <h2 className='font-bold pb-4 text-xl'>vCPU hours</h2>
            <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
              <CardContent>
                <LineChart className='aspect-[4/3]' series={vcpuData} type='vCPU' />
              </CardContent>
            </Card>
          </div>

          <div className='flex flex-col w-full md:w-2/3'>
            <h2 className='font-bold pb-4 text-xl'>RAM hours</h2>
            <Card className='w-full bg-inherit/10 border border-white/20 mb-10'>
              <CardContent>
                <LineChart className='aspect-[4/3]' series={ramData} type='RAM' />
              </CardContent>
            </Card>
          </div>

        </div>
      ) : (
        <div className='flex items-center justify-center w-2/3'>
          <LoaderIcon className='animate-spin' />
        </div>
      )}
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

