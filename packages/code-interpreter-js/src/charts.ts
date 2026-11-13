/**
 * Chart types
 */
export enum ChartType {
  LINE = 'line',
  SCATTER = 'scatter',
  BAR = 'bar',
  PIE = 'pie',
  BOX_AND_WHISKER = 'box_and_whisker',
  SUPERCHART = 'superchart',
  UNKNOWN = 'unknown',
}

/**
 * Ax scale types
 */
export enum ScaleType {
  LINEAR = 'linear',
  DATETIME = 'datetime',
  CATEGORICAL = 'categorical',
  LOG = 'log',
  SYMLOG = 'symlog',
  LOGIT = 'logit',
  FUNCTION = 'function',
  FUNCTIONLOG = 'functionlog',
  ASINH = 'asinh',
}

/**
 * Represents a chart.
 */
export type Chart = {
  type: ChartType
  title: string
  elements: any[]
}

type Chart2D = Chart & {
  x_label?: string
  y_label?: string
  x_unit?: string
  y_unit?: string
}

export type PointData = {
  label: string
  points: [number | string, number | string][]
}

type PointChart = Chart2D & {
  x_ticks: (number | string)[]
  x_scale: ScaleType
  x_tick_labels: string[]
  y_ticks: (number | string)[]
  y_scale: ScaleType
  y_tick_labels: string[]
  elements: PointData[]
}

export type LineChart = PointChart & {
  type: ChartType.LINE
}

export type ScatterChart = PointChart & {
  type: ChartType.SCATTER
}

export type BarData = {
  label: string
  value: string
  group: string
}

export type BarChart = Chart2D & {
  type: ChartType.BAR
  elements: BarData[]
}

export type PieData = {
  label: string
  angle: number
  radius: number
}

export type PieChart = Chart & {
  type: ChartType.PIE
  elements: PieData[]
}

export type BoxAndWhiskerData = {
  label: string
  min: number
  first_quartile: number
  median: number
  third_quartile: number
  max: number
  outliers: number[]
}

export type BoxAndWhiskerChart = Chart2D & {
  type: ChartType.BOX_AND_WHISKER
  elements: BoxAndWhiskerData[]
}

export type SuperChart = Chart & {
  type: ChartType.SUPERCHART
  elements: Chart[]
}

export type ChartTypes =
  | LineChart
  | ScatterChart
  | BarChart
  | PieChart
  | BoxAndWhiskerChart
  | SuperChart
export function deserializeChart(data: any): Chart {
  switch (data.type) {
    case ChartType.LINE:
      return { ...data } as LineChart
    case ChartType.SCATTER:
      return { ...data } as ScatterChart
    case ChartType.BAR:
      return { ...data } as BarChart
    case ChartType.PIE:
      return { ...data } as PieChart
    case ChartType.BOX_AND_WHISKER:
      return { ...data } as BoxAndWhiskerChart
    case ChartType.SUPERCHART: {
      const charts: Chart[] = data.data.map((g: any) => deserializeChart(g))
      delete data.data
      return {
        ...data,
        data: charts,
      } as SuperChart
    }
    default:
      return { ...data, type: ChartType.UNKNOWN } as Chart
  }
}
