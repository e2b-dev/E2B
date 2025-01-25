import { useEffect, useState } from 'react'
import LineChart from '@/components/Dashboard/Chart'
import { toast } from '@/components/ui/use-toast'
import { Team } from '@/utils/useUser'
import { getBillingUrl } from '@/app/(dashboard)/dashboard/utils'
import { cn } from '@/lib/utils'
import { Skeleton } from '../ui/skeleton'
import { BillingAlerts } from './BillingAlerts'

type Usage = {
  month: number
  year: number
  unpaid_cost: number
}

type PlotData = {
  x: string
  y: number
}

type Series = {
  id: string
  data: PlotData[]
}

const ChartSkeleton = ({ className }: { className?: string }) => {
  const numBars = Math.floor(Math.random() * 6) + 5 // Random number between 5-10
  const bars = Array.from({ length: numBars }, () => Math.random() * 80 + 20) // Random heights between 20-100

  return (
    <div className={cn('relative w-full aspect-video p-4', className)}>
      <div className="flex h-full items-end justify-between gap-2">
        {bars.map((height, i) => (
          <Skeleton
            key={i}
            className="w-full"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export const UsageContent = ({
  team,
  domain,
}: {
  team: Team
  domain: string
}) => {
  const [vcpuData, setVcpuData] = useState<Series[]>([])
  const [vcpuHoursThisMonth, setVcpuHoursThisMonth] = useState<
    number | undefined
  >()
  const [ramData, setRamData] = useState<Series[]>([])
  const [ramHoursThisMonth, setRamHoursThisMonth] = useState<
    number | undefined
  >()
  const [costUsage, setCostUsage] = useState<Series[]>([])
  const [costThisMonth, setCostMonth] = useState<number | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const getUsage = async () => {
      setIsLoading(true)
      setVcpuData([])
      setRamData([])
      setCostUsage([])

      try {
        const response = await fetch(
          getBillingUrl(domain, `/teams/${team.id}/usage`),
          {
            headers: {
              'X-Team-API-Key': team.apiKeys[0],
            },
          }
        )
        if (!response.ok) {
          throw new Error('Failed to fetch usage data')
        }

        const data = await response.json()
        const { vcpuSeries, ramSeries } = transformData(data.usages)
        const costData = transformCostData(data.usages)

        const latestCost = costData[0].data[costData[0].data.length - 1]
        setCostUsage(costData)
        setCostMonth(latestCost.y)

        setVcpuData(vcpuSeries)
        setVcpuHoursThisMonth(
          vcpuSeries[0].data[vcpuSeries[0].data.length - 1].y
        )

        setRamData(ramSeries)
        setRamHoursThisMonth(ramSeries[0].data[ramSeries[0].data.length - 1].y)
      } catch (error) {
        toast({
          title: 'An error occurred',
          description: 'We were unable to fetch the usage data',
        })
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    getUsage()
  }, [team, domain])

  return (
    <div className="flex flex-col w-full gap-3">
      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 gap-y-12">
        {/* Budget Controls */}
        <BillingAlerts team={team} domain={domain} email={team.email} />

        <div className="col-span-1 max-xl:hidden" />

        {/* Cost Section */}
        <div className="bg-inherit/10 rounded-lg">
          <div className="pb-2">
            <h2 className="text-2xl font-semibold">Costs in USD</h2>
            {!isLoading && costThisMonth && (
              <p className="text-sm text-white/50">
                Total costs this month: <b>${costThisMonth?.toFixed(2)}</b>
              </p>
            )}
          </div>
          <div>
            {isLoading ? (
              <ChartSkeleton className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]" />
            ) : (
              <LineChart
                series={costUsage}
                type="Cost"
                className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]"
              />
            )}
          </div>
        </div>

        {/* vCPU Section */}
        <div className="bg-inherit/10 rounded-lg">
          <div className="pb-2">
            <h2 className="text-2xl font-semibold">vCPU hours</h2>
            {!isLoading && vcpuHoursThisMonth && (
              <p className="text-sm text-white/50">
                Total vCPU hours this month:{' '}
                <b>{vcpuHoursThisMonth?.toFixed(2)}</b>
              </p>
            )}
          </div>
          <div>
            {isLoading ? (
              <ChartSkeleton className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]" />
            ) : (
              <LineChart
                series={vcpuData}
                type="vCPU"
                className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]"
              />
            )}
          </div>
        </div>

        {/* RAM Section */}
        <div className="bg-inherit/10 rounded-lg">
          <div className="pb-2">
            <h2 className="text-2xl font-semibold">RAM hours</h2>
            {!isLoading && ramHoursThisMonth && (
              <p className="text-sm text-white/50">
                Total RAM hours this month:{' '}
                <b>{ramHoursThisMonth?.toFixed(2)}</b>
              </p>
            )}
          </div>
          <div>
            {isLoading ? (
              <ChartSkeleton className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]" />
            ) : (
              <LineChart
                series={ramData}
                type="RAM"
                className="aspect-[21/9] xs:aspect-[2/1] lg:aspect-[16/9]"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const transformCostData = (usage: Usage[]): Series[] => {
  const costData = usage.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y:
        usage.template_usage.length > 0
          ? usage.template_usage.reduce(
              (acc: number, template: any) => acc + template.total_cost,
              0
            )
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

const transformData = (
  usages: any
): { vcpuSeries: Series[]; ramSeries: Series[] } => {
  const ramData = usages.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y:
        usage.template_usage.length > 0
          ? usage.template_usage.reduce(
              (acc: number, template: any) => acc + template.ram_gb_hours,
              0
            )
          : 0,
    }
  })

  const vpcData = usages.map((usage: any) => {
    return {
      x: `${String(usage.month).padStart(2, '0')}/${usage.year}`,
      y:
        usage.template_usage.length > 0
          ? usage.template_usage.reduce(
              (acc: number, template: any) => acc + template.sandbox_hours,
              0
            )
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
