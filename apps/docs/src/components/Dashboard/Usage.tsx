import { Card, CardContent } from '../ui/card'
import BarChart from './Chart'


export const UsageContent = () => {

  return (
    <div className="flex flex-col w-full h-full">
      <div>
        <h2 className='font-bold pb-10 text-xl'>Usage history</h2>
      </div>
      
      <Card className="w-2/3 bg-inherit/10 border border-white/20">
        <CardContent>
          <BarChart className="aspect-[4/3]"/>
        </CardContent>
      </Card>
    </div>
  )
}