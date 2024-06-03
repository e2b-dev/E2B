import { useEffect, useState } from 'react'
import { Card, CardContent } from '../ui/card'
import BarChart from './Chart'
import { LoaderIcon } from 'lucide-react'

const usageUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/usage`

export const UsageContent = () => {
  const [vcpuData, setVcpuData] = useState<any>(null)
  const [ramData, setRamData] = useState<any>(null)

  useEffect(() => {
    const getUsage = async () => {
      const response = await fetch(usageUrl, {
        headers: {
          'X-Team-API-Key': ''
        }
      })
      const data = await response.json()
      console.log(data)
      const { vcpuData, ramData, vcpuKeys, ramKeys } = transformData(data.usages)
      
      setVcpuData({
        data: vcpuData,
        keys: vcpuKeys,
      })
      setRamData({
        data: ramData,
        keys: ramKeys,
      })

    }
    getUsage()
  }, [])

  return (
    <div className="flex flex-col w-full h-full pb-10">
      <div className='pb-10'>
        <h2 className='font-bold pb-4 text-xl'>Usage history</h2>
        <p>
          The graphs shows monthly vCPU-hours and RAM-hours used by the team. <br/>
          If you have several teamplates, the bar is broken down by the teamplate id.
        </p>
      </div>

      {vcpuData && ramData ? (
        <>
          <h2 className='font-bold pb-4 text-xl'>vCPU hours</h2>
          <Card className="w-2/3 bg-inherit/10 border border-white/20 mb-10">
            <CardContent>
              <BarChart className="aspect-[4/3]" usages={vcpuData} type="vCPU" />
            </CardContent>
          </Card>

          <h2 className='font-bold pb-4 text-xl'>RAM hours</h2>
          <Card className="w-2/3 bg-inherit/10 border border-white/20 mb-10">
            <CardContent>
              <BarChart className="aspect-[4/3]" usages={ramData} type="RAM" />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className='flex items-center justify-center w-2/3'>
          <LoaderIcon className="animate-spin" />
        </div>
      )}
    </div>
  )
}


const transformData = (usages: any) => {
  const vcpuData = usages.map((usage: any) => {
    const monthData = {
      name: `${usage.month}/${usage.year}`,
    }
    usage.template_usage.forEach((template: any) => {
      monthData[`vCPU_${template.alias}`] = template.vcpu_hours
    })
    return monthData
  })

  const ramData = usages.map((usage: any) => {
    const monthData = {
      name: `${usage.month}/${usage.year}`,
    }
    usage.template_usage.forEach((template: any) => {
      monthData[`RAM_${template.alias}`] = template.ram_gb_hours
    })
    return monthData
  })

  // Extract keys for the bar charts
  const vcpuKeys = new Set()
  const ramKeys = new Set()
  usages.forEach((usage: any) => {
    usage.template_usage.forEach((template: any) => {
      vcpuKeys.add(`vCPU_${template.alias}`)
      ramKeys.add(`RAM_${template.alias}`)
    })
  })

  console.log(vcpuData)

  return {
    vcpuData,
    ramData,
    vcpuKeys: Array.from(vcpuKeys),
    ramKeys: Array.from(ramKeys),
  }
}

