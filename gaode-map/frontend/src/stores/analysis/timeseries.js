import { defineStore } from 'pinia'
import { createAnalysisTimeseriesInitialState } from '../../features/timeseries/panel'

export function createAnalysisTimeseriesStoreInitialState() {
  return createAnalysisTimeseriesInitialState()
}

export const ANALYSIS_TIMESERIES_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisTimeseriesStoreInitialState()),
)

export const useAnalysisTimeseriesStore = defineStore('analysis_timeseries', {
  state: () => createAnalysisTimeseriesStoreInitialState(),
})
