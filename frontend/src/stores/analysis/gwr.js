import { defineStore } from 'pinia'
import { createAnalysisGwrInitialState } from '../../features/gwr/panel'

export function createAnalysisGwrStoreInitialState() {
  return createAnalysisGwrInitialState()
}

export const ANALYSIS_GWR_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisGwrStoreInitialState()),
)

export const useAnalysisGwrStore = defineStore('analysis_gwr', {
  state: () => createAnalysisGwrStoreInitialState(),
})
