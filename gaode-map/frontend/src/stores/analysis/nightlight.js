import { defineStore } from 'pinia'
import { createAnalysisNightlightInitialState } from '../../features/nightlight/panel'

export function createAnalysisNightlightStoreInitialState() {
  return createAnalysisNightlightInitialState()
}

export const ANALYSIS_NIGHTLIGHT_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisNightlightStoreInitialState()),
)

export const useAnalysisNightlightStore = defineStore('analysis_nightlight', {
  state: () => createAnalysisNightlightStoreInitialState(),
})
