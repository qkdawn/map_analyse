import { defineStore } from 'pinia'
import { createRoadSyntaxInitialState } from '../../features/road/state'

export function createAnalysisRoadInitialState() {
  return {
    roadSyntaxModulesReady: false,
    roadSyntaxModuleMissing: [],
    ...createRoadSyntaxInitialState(),
  }
}

export const ANALYSIS_ROAD_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisRoadInitialState()),
)

export const useAnalysisRoadStore = defineStore('analysis_road', {
  state: () => createAnalysisRoadInitialState(),
})
