import { defineStore } from 'pinia'
import { createAnalysisPopulationInitialState } from '../../features/population/panel'

export function createAnalysisPopulationStoreInitialState() {
  return createAnalysisPopulationInitialState()
}

export const ANALYSIS_POPULATION_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisPopulationStoreInitialState()),
)

export const useAnalysisPopulationStore = defineStore('analysis_population', {
  state: () => createAnalysisPopulationStoreInitialState(),
})
