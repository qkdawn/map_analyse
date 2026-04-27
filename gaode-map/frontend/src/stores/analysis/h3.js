import { defineStore } from 'pinia'
import { createAnalysisH3InitialState } from '../../features/h3/panel'

export function createAnalysisH3StoreInitialState() {
  return createAnalysisH3InitialState()
}

export const ANALYSIS_H3_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisH3StoreInitialState()),
)

export const useAnalysisH3Store = defineStore('analysis_h3', {
  state: () => createAnalysisH3StoreInitialState(),
})
