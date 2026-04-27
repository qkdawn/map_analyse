import { defineStore } from 'pinia'
import { createAnalysisExportInitialState } from '../../features/export/export-bundle'

export function createAnalysisExportStoreInitialState() {
  return createAnalysisExportInitialState()
}

export const ANALYSIS_EXPORT_STATE_KEYS = Object.freeze(
  Object.keys(createAnalysisExportStoreInitialState()),
)

export const useAnalysisExportStore = defineStore('analysis_export', {
  state: () => createAnalysisExportStoreInitialState(),
})
