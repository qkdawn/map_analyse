import {
  asText,
  clampText,
  cloneArray,
  cloneAgentSessionRecord,
  cloneObject,
  consumeSseStream,
  createAgentSessionRecord,
  normalizeAgentPanelPreloadNotes,
  normalizeAgentToolSummary,
  sortAgentSessions,
} from './normalizers.js'
import {
  buildAgentPlanChecklist,
  buildAgentToolCallItems,
  hasAgentExecutionTraceContent,
  hasAgentPlanContent,
} from './derived.js'
import {
  buildAnalysisTaskConfirmation,
  cloneAnalysisTaskConfirmation,
  focusAnalysisTaskPanel,
  getAnalysisTaskDefinition,
  getAnalysisTaskDefinitions,
  runAnalysisTask,
} from './analysis-task-registry.js'

function createAgentUiMethods() {
  return {
    getAgentSessionTitle(session = null) {
      if (!session || typeof session !== 'object') return '新对话'
      return clampText(session.title, 60) || '新对话'
    },
    getAgentSessionPreview(session = null) {
      if (!session || typeof session !== 'object') return '开始一段新的分析对话'
      return clampText(session.preview, 120) || '开始一段新的分析对话'
    },
    agentHasConversationContent() {
      const activeTab = this.getAgentActiveTopTab()
      if (!asText(activeTab.id)) return false
      if (asText(activeTab.kind) === 'summary') {
        return this.hasAgentSummaryPack()
      }
      return Boolean(
        (Array.isArray(this.agentMessages) && this.agentMessages.length)
        || (Array.isArray(this.agentCards) && this.agentCards.length)
        || this.agentError
        || this.agentClarificationQuestion
        || this.agentRiskPrompt,
      )
    },
    createDefaultAgentSummaryTab() {
      return {
        id: 'summary',
        kind: 'summary',
        frozen: true,
        source: 'current',
        sessionId: '',
        title: '区域总结',
        createdAt: new Date().toISOString(),
        content: {},
        evidenceRefs: [],
        panelPayloads: {},
      }
    },
    createDefaultAgentTabs() {
      return {
        summaryTab: this.createDefaultAgentSummaryTab(),
        summaryTabs: [],
        siteSelectionTabs: [],
        followupTabs: [],
        activeTabId: '',
        followupLimit: 6,
        nextFollowupNumber: 1,
      }
    },
    normalizeAgentFollowupTitle(title = '') {
      const raw = asText(title)
      if (!raw) return '追问解释'
      return /^追问(?:解释)?\d*$/u.test(raw) ? '追问解释' : raw
    },
    getAgentTabKindLabel(kind = '') {
      const normalized = asText(kind)
      if (normalized === 'summary') return '区域总结'
      if (normalized === 'site_selection') return '区域内选址'
      return '追问解释'
    },
    extractAgentTabShortTitle(kind = '', seed = '') {
      const label = this.getAgentTabKindLabel(kind)
      const raw = clampText(asText(seed).replace(/^(?:区域总结|区域内选址|追问解释|总结|追问)\s*[·:：-]\s*/u, '').trim(), 24)
      if (raw) return raw
      return label
    },
    formatAgentTabTitle(kind = '', seed = '') {
      const nextKind = this.getAgentTabKindLabel(kind)
      const shortTitle = this.extractAgentTabShortTitle(kind, seed)
      if (!shortTitle || shortTitle === nextKind) return nextKind
      return `${nextKind}·${shortTitle}`
    },
    getAgentSummaryWindowTitle(panelPayloads = null, fallbackTitle = '') {
      const pack = this.getAgentSummaryPack(panelPayloads)
      const headline = asText(((pack.headline_judgment || {}).summary) || fallbackTitle)
      return this.formatAgentTabTitle('summary', headline)
    },
    getAgentFollowupWindowTitle(seed = null, fallbackTitle = '') {
      const source = seed && typeof seed === 'object' ? seed : {}
      const firstUserMessage = cloneArray(source.messages)
        .find((item) => asText(item && item.role) === 'user' && asText(item && item.content))
      const titleSeed = asText(source.title || fallbackTitle || (firstUserMessage && firstUserMessage.content))
      return this.formatAgentTabTitle('followup', titleSeed)
    },
    createAgentFollowupThreadState(seed = {}) {
      const normalized = cloneObject(seed)
      return {
        input: String(normalized.input || ''),
        status: String(normalized.status || 'idle'),
        stage: String(normalized.stage || 'gating'),
        messages: cloneArray(normalized.messages),
        cards: cloneArray(normalized.cards),
        decision: cloneObject(normalized.decision || { summary: '', mode: 'judgment', strength: 'weak', canAct: false }),
        support: cloneArray(normalized.support),
        counterpoints: cloneArray(normalized.counterpoints),
        actions: cloneArray(normalized.actions),
        boundary: cloneArray(normalized.boundary),
        executionTrace: cloneArray(normalized.executionTrace),
        usedTools: cloneArray(normalized.usedTools),
        citations: cloneArray(normalized.citations),
        researchNotes: cloneArray(normalized.researchNotes),
        auditIssues: cloneArray(normalized.auditIssues),
        nextSuggestions: cloneArray(normalized.nextSuggestions),
        clarificationQuestion: String(normalized.clarificationQuestion || ''),
        clarificationOptions: cloneArray(normalized.clarificationOptions),
        riskPrompt: String(normalized.riskPrompt || ''),
        error: String(normalized.error || ''),
        contextSummary: cloneObject(normalized.contextSummary),
        plan: cloneObject(normalized.plan || { steps: [], followupSteps: [], followupApplied: false, summary: '' }),
        panelPayloads: cloneObject(normalized.panelPayloads),
        panelPreloadNotes: cloneArray(normalized.panelPreloadNotes),
        preloadedPanelKeys: cloneArray(normalized.preloadedPanelKeys),
        thinkingTimeline: cloneArray(normalized.thinkingTimeline),
        pendingTaskConfirmation: cloneObject(normalized.pendingTaskConfirmation),
        riskConfirmations: cloneArray(normalized.riskConfirmations),
      }
    },
    buildAgentFollowupThreadFromCurrentState() {
      return this.createAgentFollowupThreadState({
        input: this.agentInput,
        status: this.agentStatus,
        stage: this.agentStage,
        messages: this.agentMessages,
        cards: this.agentCards,
        decision: this.agentDecision,
        support: this.agentSupport,
        counterpoints: this.agentCounterpoints,
        actions: this.agentActions,
        boundary: this.agentBoundary,
        executionTrace: this.agentExecutionTrace,
        usedTools: this.agentUsedTools,
        citations: this.agentCitations,
        researchNotes: this.agentResearchNotes,
        auditIssues: this.agentAuditIssues,
        nextSuggestions: this.agentNextSuggestions,
        clarificationQuestion: this.agentClarificationQuestion,
        clarificationOptions: this.agentClarificationOptions,
        riskPrompt: this.agentRiskPrompt,
        error: this.agentError,
        contextSummary: this.agentContextSummary,
        plan: this.agentPlan,
        panelPayloads: this.agentPanelPayloads,
        panelPreloadNotes: this.agentPanelPreloadNotes,
        preloadedPanelKeys: this.agentPreloadedPanelKeys,
        thinkingTimeline: this.agentThinkingTimeline,
        pendingTaskConfirmation: this.agentPendingTaskConfirmation,
        riskConfirmations: this.agentRiskConfirmations,
      })
    },
    applyAgentFollowupThreadToCurrentState(thread = null) {
      const state = this.createAgentFollowupThreadState(thread || {})
      this.agentInput = String(state.input || '')
      this.agentStatus = String(state.status || 'idle')
      this.agentStage = String(state.stage || 'gating')
      this.agentMessages = cloneArray(state.messages)
      this.agentCards = cloneArray(state.cards)
      this.agentDecision = cloneObject(state.decision)
      this.agentSupport = cloneArray(state.support)
      this.agentCounterpoints = cloneArray(state.counterpoints)
      this.agentActions = cloneArray(state.actions)
      this.agentBoundary = cloneArray(state.boundary)
      this.agentExecutionTrace = cloneArray(state.executionTrace)
      this.agentUsedTools = cloneArray(state.usedTools)
      this.agentCitations = cloneArray(state.citations)
      this.agentResearchNotes = cloneArray(state.researchNotes)
      this.agentAuditIssues = cloneArray(state.auditIssues)
      this.agentNextSuggestions = cloneArray(state.nextSuggestions)
      this.agentClarificationQuestion = String(state.clarificationQuestion || '')
      this.agentClarificationOptions = cloneArray(state.clarificationOptions)
      this.agentRiskPrompt = String(state.riskPrompt || '')
      this.agentError = String(state.error || '')
      this.agentContextSummary = cloneObject(state.contextSummary)
      this.agentPlan = cloneObject(state.plan)
      this.agentPanelPayloads = cloneObject(state.panelPayloads)
      this.agentPanelPreloadNotes = normalizeAgentPanelPreloadNotes(state.panelPreloadNotes)
      this.agentPreloadedPanelKeys = cloneArray(state.preloadedPanelKeys)
      this.agentThinkingTimeline = cloneArray(state.thinkingTimeline)
      this.agentPendingTaskConfirmation = cloneAnalysisTaskConfirmation(state.pendingTaskConfirmation)
      this.agentRiskConfirmations = cloneArray(state.riskConfirmations)
    },
    getAgentActiveTopTab() {
      const tabs = this.ensureAgentTabs(false)
      const activeId = asText(tabs.activeTabId)
      const summaryTab = cloneArray(tabs.summaryTabs).find((item) => asText(item && item.id) === activeId)
      if (summaryTab) return { ...cloneObject(summaryTab), kind: 'summary', fixed: false }
      const siteSelectionTab = cloneArray(tabs.siteSelectionTabs).find((item) => asText(item && item.id) === activeId)
      if (siteSelectionTab) return { ...cloneObject(siteSelectionTab), kind: 'site_selection', fixed: false }
      const followupTab = cloneArray(tabs.followupTabs).find((item) => asText(item && item.id) === activeId)
      if (followupTab) return { ...cloneObject(followupTab), kind: 'followup', fixed: false }
      return { id: '', kind: '', fixed: false, source: '', sessionId: '', title: '' }
    },
    isCurrentAgentSummaryTabActive() {
      const activeTab = this.getAgentActiveTopTab()
      return asText(activeTab.kind) === 'summary' && asText(activeTab.source) === 'current'
    },
    createAgentSummaryWindowId() {
      return `summary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    },
    createAgentSiteSelectionWindowId() {
      return `site-selection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    },
    isAgentActiveTabReadonly() {
      const activeTab = this.getAgentActiveTopTab()
      return !!activeTab.readonly
    },
    isAgentHistorySessionTabActive(sessionId = '') {
      const nextSessionId = asText(sessionId)
      if (!nextSessionId) return false
      return asText(this.getAgentActiveTopTab().sessionId) === nextSessionId
    },
    isAgentHistorySessionInCurrentRange(session = null) {
      if (!session || typeof session !== 'object') return false
      const currentHistoryId = asText(this.getCurrentAgentHistoryId && this.getCurrentAgentHistoryId())
      const historyId = asText(session.historyId)
      return Boolean(historyId && currentHistoryId && historyId === currentHistoryId)
    },
    getAgentActiveSummaryPanelPayloads() {
      const tabs = this.ensureAgentTabs(false)
      const activeTab = this.getAgentActiveTopTab()
      if (asText(activeTab.kind) === 'summary' && activeTab.panelPayloads && typeof activeTab.panelPayloads === 'object') {
        return cloneObject(activeTab.panelPayloads)
      }
      const payloads = cloneObject(this.agentPanelPayloads)
      if (payloads.summary_pack && typeof payloads.summary_pack === 'object') {
        return payloads
      }
      const fallbackPack = cloneObject(((tabs.summaryTab || {}).content) || {})
      if (!Object.keys(fallbackPack).length) {
        return payloads
      }
      return {
        ...payloads,
        summary_pack: fallbackPack,
        summary_status: {
          status: this.hasAgentSummaryPack(fallbackPack) ? 'ready' : 'idle',
          generated: this.hasAgentSummaryPack(fallbackPack),
          ...cloneObject((payloads.summary_status && typeof payloads.summary_status === 'object') ? payloads.summary_status : {}),
        },
      }
    },
    getAgentSummaryPack(panelPayloads = null) {
      const payloads = panelPayloads && typeof panelPayloads === 'object'
        ? cloneObject(panelPayloads)
        : this.getAgentActiveSummaryPanelPayloads()
      const pack = payloads.summary_pack && typeof payloads.summary_pack === 'object'
        ? payloads.summary_pack
        : {}
      return cloneObject(pack)
    },
    getAgentSummaryAreaJudgments(panelPayloads = null) {
      const pack = this.getAgentSummaryPack(panelPayloads)
      const rows = Array.isArray(pack.secondary_conclusions) ? pack.secondary_conclusions : []
      const sectionOrder = [
        ['spatial_structure', '空间结构'],
        ['poi_structure', 'POI结构'],
        ['consumption_vitality', '消费活力'],
        ['business_support', '业态承接'],
      ]
      const mapped = sectionOrder.map(([sectionKey, fallbackTitle]) => {
        const direct = pack[sectionKey] && typeof pack[sectionKey] === 'object'
          ? pack[sectionKey]
          : null
        const matched = direct || rows.find((item) => {
          const key = asText(item && (item.section_key || item.sectionKey))
          const title = asText(item && item.title)
          return key === sectionKey || title === fallbackTitle
        })
        if (!matched || typeof matched !== 'object') return null
        const dimensions = Array.isArray(matched.dimensions) ? matched.dimensions : []
        return {
          sectionKey,
          title: asText(matched.title || fallbackTitle) || fallbackTitle,
          reasoning: asText(matched.reasoning),
          dimensions: dimensions
            .map((item) => ({
              key: asText(item && item.key),
              label: asText(item && item.label),
              conclusion: asText(item && item.conclusion),
            }))
            .filter((item) => item.conclusion),
        }
      }).filter((item) => item && item.reasoning)
      if (mapped.length === sectionOrder.length) return mapped
      return rows.map((item, index) => ({
        sectionKey: asText(item && (item.section_key || item.sectionKey)) || `legacy-${index}`,
        title: asText(item && item.title) || '-',
        reasoning: asText(item && item.reasoning) || '-',
        dimensions: Array.isArray(item && item.dimensions)
          ? item.dimensions.map((dim) => ({
            key: asText(dim && dim.key),
            label: asText(dim && dim.label),
            conclusion: asText(dim && dim.conclusion),
          })).filter((dim) => dim.conclusion)
          : [],
      }))
    },
    getAgentSummarySecondaryConclusions(panelPayloads = null) {
      return this.getAgentSummaryAreaJudgments(panelPayloads)
    },
    getAgentSummaryStatus(panelPayloads = null) {
      const payloads = panelPayloads && typeof panelPayloads === 'object'
        ? cloneObject(panelPayloads)
        : this.getAgentActiveSummaryPanelPayloads()
      const status = payloads.summary_status && typeof payloads.summary_status === 'object'
        ? payloads.summary_status
        : {}
      const summaryPack = this.getAgentSummaryPack(payloads)
      return {
        status: asText(status.status || (this.hasAgentSummaryPack(summaryPack) ? 'ready' : 'idle')) || 'idle',
        generated: !!status.generated || this.hasAgentSummaryPack(summaryPack),
        llmAvailable: Object.prototype.hasOwnProperty.call(status, 'llm_available') ? !!status.llm_available : true,
        title: asText(status.title || ''),
        description: asText(status.description || ''),
        message: asText(status.message || ''),
        errorCode: asText(status.error_code || ''),
        errorStage: asText(status.error_stage || ''),
        retryable: Object.prototype.hasOwnProperty.call(status, 'retryable') ? !!status.retryable : true,
      }
    },
    syncAgentSummaryStateFromPanelPayload(panelPayloads = null) {
      const payloads = cloneObject(panelPayloads || this.getAgentActiveSummaryPanelPayloads())
      this.syncAgentSummaryReadinessFromPanelPayload(payloads)
      this.syncSummaryTaskBoardFromPanelPayload(payloads)
      return payloads
    },
    hasAgentSummaryPack(summaryPackSeed = null) {
      const summaryPack = summaryPackSeed && typeof summaryPackSeed === 'object'
        ? cloneObject(summaryPackSeed)
        : this.getAgentSummaryPack()
      const areaJudgments = this.getAgentSummaryAreaJudgments({ summary_pack: summaryPack })
      return !!(
        ((summaryPack.headline_judgment || {}).summary)
        && areaJudgments.length === 4
        && (((summaryPack.user_profile || {}).headline) || Array.isArray((summaryPack.user_profile || {}).traits))
        && (((summaryPack.behavior_inference || {}).headline) || Array.isArray((summaryPack.behavior_inference || {}).traits))
      )
    },
    shouldShowAgentSummaryGeneratedState() {
      const status = this.getAgentSummaryStatus()
      const ready = this.isCurrentAgentSummaryTabActive() ? this.agentSummaryReadiness.ready : true
      return ready && status.generated && this.hasAgentSummaryPack()
    },
    shouldShowAgentSummaryGeneratingState() {
      return this.isCurrentAgentSummaryTabActive() && !!this.agentSummaryGenerating
    },
    getAgentSummaryGateTitle() {
      const status = this.getAgentSummaryStatus()
      if (!this.agentSummaryReadiness.ready) {
        return '区域总结'
      }
      return status.title || '区域总结'
    },
    getAgentSummaryGateDescription() {
      const status = this.getAgentSummaryStatus()
      if (!this.agentSummaryReadiness.ready) {
        return ''
      }
      return status.description || '基础分析结果已就绪，但当前还没有可展示的区域总结。'
    },
    normalizeAgentSummaryReadiness(seed = null) {
      const value = seed && typeof seed === 'object' ? seed : {}
      return {
        checked: !!value.checked,
        ready: !!value.ready,
        missingTasks: cloneArray(value.missingTasks || value.missing_tasks).map((item) => asText(item)).filter(Boolean),
        reused: cloneArray(value.reused).map((item) => asText(item)).filter(Boolean),
        fetched: cloneArray(value.fetched).map((item) => asText(item)).filter(Boolean),
      }
    },
    syncAgentSummaryReadinessFromPanelPayload(panelPayloads = null) {
      const payloads = cloneObject(panelPayloads || this.agentPanelPayloads)
      const readiness = this.normalizeAgentSummaryReadiness(payloads.data_readiness || payloads.dataReadiness || {})
      this.agentSummaryReadiness = readiness
      if (!readiness.ready) return readiness
      this.agentSummaryError = ''
      return readiness
    },
    getAgentSummaryTaskLabel(taskKey = '') {
      const key = asText(taskKey)
      const mapping = {
        poi_fetch: 'POI 抓取',
        poi_grid: 'POI / 网格分析',
        population: '人口结构分析',
        nightlight: '夜光分析',
        road_syntax: '路网与可达性分析',
        poi_structure: 'POI结构分析',
        spatial_structure: '空间结构分析',
        area_labels: '区域标签推断',
      }
      return mapping[key] || key || '-'
    },
    getAgentSummaryMissingTaskLabels() {
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      return cloneArray(readiness.missingTasks).map((taskKey) => this.getAgentSummaryTaskLabel(taskKey))
    },
    getSummaryTaskKeys() {
      return ['poi_fetch', 'population', 'nightlight', 'poi_grid', 'road_syntax']
    },
    mapReadinessTaskToBoardTaskKeys(taskKey = '') {
      const key = asText(taskKey)
      if (!key) return []
      const mapping = {
        poi_fetch: ['poi_fetch'],
        poi_grid: ['poi_grid'],
        population: ['population'],
        nightlight: ['nightlight'],
        road_syntax: ['road_syntax'],
        poi_structure: ['poi_grid'],
        spatial_structure: ['poi_grid', 'population', 'nightlight', 'road_syntax'],
        area_labels: ['poi_grid', 'population', 'nightlight', 'road_syntax'],
      }
      return cloneArray(mapping[key] || [])
    },
    getSummaryTaskKeysFromReadiness() {
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      const mapped = cloneArray(readiness.missingTasks)
        .flatMap((item) => this.mapReadinessTaskToBoardTaskKeys(item))
        .filter(Boolean)
      const deduped = Array.from(new Set(mapped))
      return deduped.filter((item) => this.getSummaryTaskKeys().includes(item))
    },
    getSummaryReusableTaskKeysFromReadiness() {
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      const mapped = cloneArray(readiness.reused)
        .flatMap((item) => this.mapReadinessTaskToBoardTaskKeys(item))
        .filter(Boolean)
      const deduped = Array.from(new Set(mapped))
      return deduped.filter((item) => this.getSummaryTaskKeys().includes(item))
    },
    getSummaryTaskKeysToFill() {
      const reusableKeys = new Set(this.getSummaryReusableTaskKeysFromReadiness())
      const missing = this.getSummaryTaskKeysFromReadiness()
      if (missing.length) {
        return missing.filter((key) => !reusableKeys.has(key) && !this.summaryTaskHasReusableResult(key))
      }
      return this.getSummaryTaskKeys().filter((key) => {
        if (reusableKeys.has(key)) return false
        if (this.summaryTaskHasReusableResult(key)) return false
        return !this.isSummaryTaskTerminalStatus(this.getSummaryTaskByKey(key)?.status)
      })
    },
    filterSummaryTaskKeysForReuse(taskKeys = [], options = {}) {
      const forcePoiFetch = !!options.forcePoiFetch
      const forceKeys = new Set(cloneArray(options.forceKeys).map((item) => asText(item)).filter(Boolean))
      return cloneArray(taskKeys).filter((key) => {
        const normalized = asText(key)
        if (!normalized) return false
        if (forceKeys.has(normalized)) return true
        if (normalized === 'poi_fetch' && forcePoiFetch) return true
        if (this.hasSummaryTaskParamChanged(normalized)) return true
        const def = getAnalysisTaskDefinition(normalized)
        return !(def && typeof def.hasResult === 'function' && def.hasResult(this))
      })
    },
    getSummaryTaskCatalog() {
      const keys = new Set(this.getSummaryTaskKeys())
      return getAnalysisTaskDefinitions().filter((item) => keys.has(asText(item && item.key)))
    },
    createSummaryTaskBoardTask(taskDef = {}, seed = {}) {
      const key = asText(seed.key || taskDef.key)
      return {
        key,
        label: asText(seed.label || taskDef.label || key),
        status: asText(seed.status || 'pending') || 'pending',
        paramsSnapshot: cloneObject(seed.paramsSnapshot || seed.params_snapshot || {}),
        startedAt: asText(seed.startedAt || seed.started_at || ''),
        endedAt: asText(seed.endedAt || seed.ended_at || ''),
        durationMs: Number(seed.durationMs || seed.duration_ms || 0) || 0,
        logs: cloneArray(seed.logs).map((item) => cloneObject(item)),
        error: asText(seed.error || ''),
      }
    },
    createDefaultSummaryTaskBoard() {
      const tasks = this.getSummaryTaskCatalog().map((task) => this.createSummaryTaskBoardTask(task))
      return {
        runState: 'idle',
        tasks,
        lastRunAt: '',
      }
    },
    normalizeSummaryTaskBoard(seed = null) {
      const input = seed && typeof seed === 'object' ? seed : {}
      const base = this.createDefaultSummaryTaskBoard()
      const map = new Map(cloneArray(input.tasks).map((item) => [asText(item && item.key), item]))
      return {
        runState: asText(input.runState || input.run_state || base.runState) || 'idle',
        tasks: base.tasks.map((task) => this.createSummaryTaskBoardTask(task, map.get(task.key) || task)),
        lastRunAt: asText(input.lastRunAt || input.last_run_at || ''),
      }
    },
    ensureSummaryTaskBoard(commit = false) {
      const board = this.normalizeSummaryTaskBoard(this.summaryTaskBoard)
      if (commit) this.summaryTaskBoard = board
      return board
    },
    syncSummaryTaskBoardFromPanelPayload(panelPayloads = null) {
      const payloads = cloneObject(panelPayloads || this.agentPanelPayloads)
      const board = this.normalizeSummaryTaskBoard(payloads.summary_task_board || payloads.summaryTaskBoard || this.summaryTaskBoard)
      this.summaryTaskBoard = board
      return board
    },
    syncSummaryTaskBoardFromLocalResults(options = {}) {
      const board = this.ensureSummaryTaskBoard(false)
      const now = new Date().toISOString()
      const tasks = cloneArray(board.tasks).map((task) => {
        const key = asText(task && task.key)
        const def = getAnalysisTaskDefinition(key)
        const isRunning = !!(def && def.runningFlag && this[def.runningFlag])
        const hasResult = !!(def && typeof def.hasResult === 'function' && def.hasResult(this))
        const status = isRunning ? 'running' : (hasResult ? 'reused' : 'pending')
        return {
          ...task,
          status,
          startedAt: status === 'running' ? asText(task.startedAt || now) : asText(task.startedAt),
          endedAt: status === 'running' ? '' : asText(task.endedAt),
          durationMs: status === 'pending' ? 0 : Number(task.durationMs || 0) || 0,
          error: status === 'pending' || status === 'running' || status === 'reused' ? '' : asText(task.error),
        }
      })
      const hasRunning = tasks.some((item) => asText(item.status) === 'running')
      const pendingKeys = tasks
        .filter((item) => !this.isSummaryTaskTerminalStatus(item.status))
        .map((item) => asText(item.key))
        .filter(Boolean)
      const runState = hasRunning ? 'running' : (pendingKeys.length ? 'idle' : 'completed')
      const nextBoard = this.updateSummaryTaskBoard({ ...board, tasks, runState }, { sync: false })
      const readiness = this.normalizeAgentSummaryReadiness({
        checked: true,
        ready: !pendingKeys.length,
        missingTasks: pendingKeys,
        reused: tasks.filter((item) => this.isSummaryTaskTerminalStatus(item.status)).map((item) => asText(item.key)),
        fetched: [],
      })
      this.agentSummaryReadiness = readiness
      this.agentPanelPayloads = {
        ...cloneObject(this.agentPanelPayloads),
        data_readiness: {
          checked: readiness.checked,
          ready: readiness.ready,
          missing_tasks: cloneArray(readiness.missingTasks),
          reused: cloneArray(readiness.reused),
          fetched: cloneArray(readiness.fetched),
        },
        summary_task_board: this.buildSummaryTaskBoardUiState(),
      }
      if (options.sync !== false) this.syncCurrentAgentSession()
      return nextBoard
    },
    buildSummaryTaskBoardUiState() {
      const board = this.ensureSummaryTaskBoard(true)
      return {
        run_state: asText(board.runState || 'idle'),
        last_run_at: asText(board.lastRunAt || ''),
        tasks: cloneArray(board.tasks).map((task) => ({
          key: task.key,
          label: task.label,
          status: task.status,
          params_snapshot: cloneObject(task.paramsSnapshot),
          started_at: task.startedAt,
          ended_at: task.endedAt,
          duration_ms: task.durationMs,
          logs: cloneArray(task.logs).map((item) => cloneObject(item)),
          error: task.error,
        })),
      }
    },
    updateSummaryTaskBoard(nextBoard = null, options = {}) {
      const board = this.normalizeSummaryTaskBoard(nextBoard || this.summaryTaskBoard)
      this.summaryTaskBoard = board
      if (options.sync !== false) {
        this.agentPanelPayloads = {
          ...cloneObject(this.agentPanelPayloads),
          summary_task_board: this.buildSummaryTaskBoardUiState(),
        }
        this.syncCurrentAgentSession()
      }
      return board
    },
    getSummaryTaskBoardTasks() {
      return cloneArray(this.ensureSummaryTaskBoard(false).tasks)
    },
    getSummaryTaskByKey(taskKey = '') {
      const key = asText(taskKey)
      return this.getSummaryTaskBoardTasks().find((item) => asText(item && item.key) === key) || null
    },
    summaryTaskHasReusableResult(taskKey = '') {
      const key = asText(taskKey)
      const def = getAnalysisTaskDefinition(key)
      return !!(def && typeof def.hasResult === 'function' && def.hasResult(this))
    },
    getSummaryTaskStatusLabel(taskOrStatus = '') {
      const task = taskOrStatus && typeof taskOrStatus === 'object' ? taskOrStatus : null
      const status = asText(task ? task.status : taskOrStatus)
      if (task && status === 'pending' && this.summaryTaskHasReusableResult(task.key)) {
        return '已有结果'
      }
      const mapping = {
        pending: '待执行',
        running: '运行中',
        reused: '已复用',
        completed: '已完成',
        failed: '失败',
      }
      return mapping[status] || '待执行'
    },
    getSummaryTaskEmptyLogText(task = null) {
      const current = task && typeof task === 'object' ? task : {}
      const status = asText(current.status)
      if (status === 'pending' && this.summaryTaskHasReusableResult(current.key)) {
        return '已有结果，可直接复用'
      }
      if (status === 'reused') {
        return '已复用现有结果'
      }
      return '暂无日志'
    },
    isSummaryTaskTerminalStatus(status = '') {
      const key = asText(status)
      return key === 'completed' || key === 'reused'
    },
    finalizeSummaryTaskAsReused(taskKey = '', options = {}) {
      const key = asText(taskKey)
      const def = getAnalysisTaskDefinition(key)
      if (!key || !def) return null
      const now = new Date().toISOString()
      const board = this.ensureSummaryTaskBoard(false)
      const tasks = cloneArray(board.tasks).map((task) => {
        if (asText(task.key) !== key) return task
        const startedAt = asText(task.startedAt || now)
        const started = Date.parse(startedAt)
        const ended = Date.parse(now)
        return {
          ...task,
          status: 'reused',
          startedAt,
          endedAt: now,
          durationMs: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0,
          error: '',
          paramsSnapshot: this.captureSummaryTaskParams(key),
          logs: [],
        }
      })
      const nextRunState = tasks.every((item) => this.isSummaryTaskTerminalStatus(item.status))
        ? 'completed'
        : (tasks.some((item) => item.status === 'running') ? 'running' : 'idle')
      this.updateSummaryTaskBoard({ ...board, tasks, runState: nextRunState })
      const message = asText(options.message || `检测到已有结果，本次复用：${def.label}`)
      this.appendSummaryTaskLog(key, message)
      return this.getSummaryTaskByKey(key)
    },
    appendSummaryTaskLog(taskKey = '', message = '', level = 'info') {
      const key = asText(taskKey)
      if (!key || !message) return
      const board = this.ensureSummaryTaskBoard(false)
      const tasks = cloneArray(board.tasks).map((task) => {
        if (asText(task.key) !== key) return task
        const logs = cloneArray(task.logs)
        logs.push({
          at: new Date().toISOString(),
          level: asText(level) || 'info',
          message: asText(message),
        })
        return { ...task, logs: logs.slice(-40) }
      })
      this.updateSummaryTaskBoard({ ...board, tasks })
    },
    _ensureSummaryTaskLogTrackers() {
      if (!this.summaryTaskLogTrackers || typeof this.summaryTaskLogTrackers !== 'object') {
        this.summaryTaskLogTrackers = {}
      }
      return this.summaryTaskLogTrackers
    },
    normalizeSummaryTaskLogMessage(message = '') {
      return asText(message).replace(/\s+/g, ' ').trim()
    },
    getSummaryTaskProgressMessage(taskKey = '') {
      const key = asText(taskKey)
      if (!key) return ''
      if (key === 'road_syntax') {
        const progressMsg = asText(this.roadSyntaxProgressMessage || '')
        const step = Number(this.roadSyntaxProgressStep || 0)
        const total = Number(this.roadSyntaxProgressTotal || 0)
        if (progressMsg) {
          if (step > 0 && total > 0) return `进度 ${Math.floor(step)}/${Math.floor(total)}：${progressMsg}`
          return progressMsg
        }
        return asText(this.roadSyntaxStatus || '')
      }
      if (key === 'poi_fetch') {
        const status = asText(this.poiStatus || '')
        const progress = Number(this.fetchProgress || 0)
        if (!status) return ''
        if (Number.isFinite(progress) && progress > 0 && progress < 100 && status.indexOf('%') < 0) {
          return `${status}（${Math.round(progress)}%）`
        }
        return status
      }
      if (key === 'poi_grid') return asText(this.h3GridStatus || '')
      if (key === 'population') return asText(this.populationStatus || '')
      if (key === 'nightlight') return asText(this.nightlightStatus || '')
      return ''
    },
    isSummaryTaskIntermediateStatus(taskKey = '', statusText = '') {
      const key = asText(taskKey)
      const message = this.normalizeSummaryTaskLogMessage(statusText || this.getSummaryTaskProgressMessage(key))
      if (!key || !message) return false
      if (key === 'road_syntax') {
        return /(局部任务已启动|正在准备路网|图层预处理中|图层预加载中|仍在预处理)/i.test(message)
      }
      return false
    },
    isSummaryTaskFailureStatus(taskKey = '', statusText = '') {
      const key = asText(taskKey)
      const message = this.normalizeSummaryTaskLogMessage(statusText || this.getSummaryTaskProgressMessage(key))
      if (!key || !message) return false
      if (this.isSummaryTaskIntermediateStatus(key, message)) return false
      return /(失败|异常|错误|failed|error)/i.test(message)
    },
    isSummaryTaskBackgroundRunning(taskKey = '', def = null, statusText = '') {
      const key = asText(taskKey)
      const message = this.normalizeSummaryTaskLogMessage(statusText || this.getSummaryTaskProgressMessage(key))
      if (!key) return false
      if (this.isSummaryTaskIntermediateStatus(key, message)) return true
      const hasBackendProgress = /(请求已发送|后端计算中|计算中|执行中|处理中|排队|进度|已发送)/i.test(message)
      if (hasBackendProgress) return true
      if (this.isSummaryTaskFailureStatus(key, message)) return false
      if (def && def.runningFlag && this[def.runningFlag]) return true
      return false
    },
    async waitForSummaryTaskBackgroundResult(taskKey = '', def = null, options = {}) {
      const key = asText(taskKey)
      if (!key || !def) return false
      const intervalMs = Math.max(1, Number(options.backgroundPollIntervalMs || 2000) || 2000)
      const timeoutMs = Math.max(intervalMs, Number(options.backgroundTimeoutMs || 5 * 60 * 1000) || 5 * 60 * 1000)
      const startedAtMs = Date.now()
      if (options.suppressPlaceholder) {
        const trackers = this._ensureSummaryTaskLogTrackers()
        const tracker = trackers[key] && typeof trackers[key] === 'object' ? trackers[key] : {}
        trackers[key] = { ...tracker, suppressPlaceholder: true }
        this.summaryTaskLogTrackers = trackers
      }
      while (Date.now() - startedAtMs <= timeoutMs) {
        this.pollSummaryTaskProgressLog(key)
        if (typeof def.hasResult === 'function' ? !!def.hasResult(this) : true) return true
        const statusText = this.getSummaryTaskProgressMessage(key)
        if (!this.isSummaryTaskBackgroundRunning(key, def, statusText)) return false
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
      throw new Error('后台计算等待超时，请切换到对应面板查看或重试')
    },
    _appendSummaryTaskProgressLogIfChanged(taskKey = '', message = '', level = 'info') {
      const key = asText(taskKey)
      const normalized = this.normalizeSummaryTaskLogMessage(message)
      if (!key || !normalized) return false
      const trackers = this._ensureSummaryTaskLogTrackers()
      const tracker = trackers[key] && typeof trackers[key] === 'object' ? trackers[key] : {}
      if (this.normalizeSummaryTaskLogMessage(tracker.lastMessage) === normalized) return false
      this.appendSummaryTaskLog(key, normalized, level)
      trackers[key] = {
        ...tracker,
        lastMessage: normalized,
        lastRealLogAtMs: Date.now(),
      }
      this.summaryTaskLogTrackers = trackers
      return true
    },
    pollSummaryTaskProgressLog(taskKey = '') {
      const key = asText(taskKey)
      if (!key) return
      const trackers = this._ensureSummaryTaskLogTrackers()
      const tracker = trackers[key] && typeof trackers[key] === 'object' ? trackers[key] : {}
      const message = this.getSummaryTaskProgressMessage(key)
      if (this._appendSummaryTaskProgressLogIfChanged(key, message, 'info')) return
      const now = Date.now()
      const startedAtMs = Number(tracker.startedAtMs || 0)
      const lastRealLogAtMs = Number(tracker.lastRealLogAtMs || 0)
      const lastPlaceholderAtMs = Number(tracker.lastPlaceholderAtMs || 0)
      const placeholderIntervalMs = 9000
      const inactiveSince = Math.max(startedAtMs, lastRealLogAtMs)
      if (tracker.suppressPlaceholder) return
      if (!inactiveSince || (now - inactiveSince) < placeholderIntervalMs) return
      if (lastPlaceholderAtMs && (now - lastPlaceholderAtMs) < placeholderIntervalMs) return
      const def = getAnalysisTaskDefinition(key)
      const elapsedSec = Math.max(0, Math.floor((now - startedAtMs) / 1000))
      const fallback = `${asText((def && def.label) || key)}执行中（${elapsedSec}s）...`
      this.appendSummaryTaskLog(key, fallback, 'info')
      trackers[key] = {
        ...tracker,
        lastMessage: this.normalizeSummaryTaskLogMessage(fallback),
        lastPlaceholderAtMs: now,
      }
      this.summaryTaskLogTrackers = trackers
    },
    startSummaryTaskLogTracking(taskKey = '', options = {}) {
      const key = asText(taskKey)
      if (!key) return
      this.stopSummaryTaskLogTracking(key)
      const trackers = this._ensureSummaryTaskLogTrackers()
      const now = Date.now()
      const intervalMs = Math.max(600, Math.min(1000, Number(options.intervalMs || 700) || 700))
      const startedAtMs = Number(options.startedAtMs || now) || now
      trackers[key] = {
        timerId: setInterval(() => this.pollSummaryTaskProgressLog(key), intervalMs),
        lastMessage: '',
        startedAtMs,
        lastRealLogAtMs: startedAtMs,
        lastPlaceholderAtMs: 0,
        suppressPlaceholder: !!options.suppressPlaceholder,
      }
      this.summaryTaskLogTrackers = trackers
    },
    stopSummaryTaskLogTracking(taskKey = '') {
      const key = asText(taskKey)
      if (!key || !this.summaryTaskLogTrackers || typeof this.summaryTaskLogTrackers !== 'object') return
      const trackers = this.summaryTaskLogTrackers
      const tracker = trackers[key]
      if (!tracker || typeof tracker !== 'object') return
      if (tracker.timerId) clearInterval(tracker.timerId)
      delete trackers[key]
      this.summaryTaskLogTrackers = { ...trackers }
    },
    stopAllSummaryTaskLogTracking() {
      if (!this.summaryTaskLogTrackers || typeof this.summaryTaskLogTrackers !== 'object') return
      Object.keys(this.summaryTaskLogTrackers).forEach((key) => this.stopSummaryTaskLogTracking(key))
    },
    captureSummaryTaskParams(taskKey = '') {
      const key = asText(taskKey)
      if (key === 'poi_fetch') {
        return {
          source: asText(this.poiDataSource || this.resultDataSource || ''),
        }
      }
      if (key === 'poi_grid') {
        return {
          resolution: Number(this.h3GridResolution || 0) || 10,
          neighbor_ring: Number(this.h3NeighborRing || 0) || 1,
          include_mode: asText(this.h3GridIncludeMode || ''),
        }
      }
      if (key === 'population') {
        return {
          year: asText(this.populationSelectedYear || ''),
        }
      }
      if (key === 'nightlight') {
        return {
          year: asText(this.nightlightSelectedYear || ''),
        }
      }
      if (key === 'road_syntax') {
        return {
          graph_model: asText(this.roadSyntaxGraphModel || ''),
          metric: asText(this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || ''),
          blue: Number(this.roadSyntaxDisplayBlue || 0),
          red: Number(this.roadSyntaxDisplayRed || 0),
        }
      }
      return {}
    },
    stringifySummaryTaskParams(params = {}) {
      const normalize = (value) => {
        if (Array.isArray(value)) return value.map((item) => normalize(item))
        if (!value || typeof value !== 'object') return value
        return Object.keys(value)
          .sort()
          .reduce((acc, key) => {
            acc[key] = normalize(value[key])
            return acc
          }, {})
      }
      return JSON.stringify(normalize(params || {}))
    },
    hasSummaryTaskParamChanged(taskKey = '', task = null) {
      const key = asText(taskKey)
      if (!key) return false
      const currentTask = task && typeof task === 'object' ? task : this.getSummaryTaskByKey(key)
      const snapshot = currentTask && typeof currentTask === 'object' ? currentTask.paramsSnapshot : {}
      if (!Object.keys(snapshot || {}).length) return asText(currentTask && currentTask.status) === 'pending'
      return this.stringifySummaryTaskParams(this.captureSummaryTaskParams(key)) !== this.stringifySummaryTaskParams(snapshot || {})
    },
    getSummaryTaskParameterDependents(taskKey = '') {
      const key = asText(taskKey)
      if (key === 'poi_fetch') return ['poi_fetch', 'poi_grid']
      if (key === 'poi_grid') return ['poi_grid']
      if (key === 'population') return ['population']
      if (key === 'nightlight') return ['nightlight']
      return key ? [key] : []
    },
    onSummaryTaskParameterChange(taskKey = '') {
      const affected = this.getSummaryTaskParameterDependents(taskKey)
      if (!affected.length) return
      const affectedSet = new Set(affected)
      const board = this.ensureSummaryTaskBoard(false)
      const tasks = cloneArray(board.tasks).map((task) => {
        const key = asText(task && task.key)
        if (!affectedSet.has(key) || asText(task && task.status) === 'running') return task
        return {
          ...task,
          status: 'pending',
          paramsSnapshot: {},
          endedAt: '',
          durationMs: 0,
          error: '',
        }
      })
      this.updateSummaryTaskBoard({ ...board, tasks, runState: 'idle' })
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      const missing = Array.from(new Set([...cloneArray(readiness.missingTasks), ...affected]))
      this.agentSummaryReadiness = this.normalizeAgentSummaryReadiness({
        ...readiness,
        checked: true,
        ready: false,
        missingTasks: missing,
      })
      this.agentPanelPayloads = {
        ...cloneObject(this.agentPanelPayloads),
        data_readiness: {
          checked: this.agentSummaryReadiness.checked,
          ready: this.agentSummaryReadiness.ready,
          missing_tasks: cloneArray(this.agentSummaryReadiness.missingTasks),
          reused: cloneArray(this.agentSummaryReadiness.reused).filter((key) => !affectedSet.has(asText(key))),
          fetched: cloneArray(this.agentSummaryReadiness.fetched),
        },
      }
      this.syncCurrentAgentSession()
    },
    isSummaryTaskRunning(taskKey = '') {
      const task = this.getSummaryTaskByKey(taskKey)
      return !!(task && task.status === 'running')
    },
    canRunSummaryParallelFill() {
      return !this.isAgentSummaryTaskBoardRunning()
    },
    canRerunSummaryTask(task = null) {
      const current = task && typeof task === 'object' ? task : {}
      const key = asText(current.key)
      if (!key || this.isAgentSummaryBusy()) return false
      return asText(current.status) !== 'running'
    },
    canGenerateSummaryAfterTasks() {
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      if (readiness.ready) return true
      const tasks = this.getSummaryTaskBoardTasks()
      return !!tasks.length && tasks.every((item) => this.isSummaryTaskTerminalStatus(item.status))
    },
    getSummaryTaskPendingLabels() {
      return this.getSummaryTaskBoardTasks()
        .filter((item) => item.status !== 'completed')
        .map((item) => asText(item.label || item.key))
    },
    async runSummaryTask(taskKey = '', options = {}) {
      const key = asText(taskKey)
      const def = getAnalysisTaskDefinition(key)
      if (!key || !def) throw new Error('未知任务')
      this.stopSummaryTaskLogTracking(key)
      const currentTask = this.getSummaryTaskByKey(key)
      const paramsChanged = this.hasSummaryTaskParamChanged(key, currentTask)
      if (!options.force && !paramsChanged && typeof def.hasResult === 'function' && def.hasResult(this)) {
        this.finalizeSummaryTaskAsReused(key)
        return
      }
      const board = this.ensureSummaryTaskBoard(false)
      const now = new Date().toISOString()
      const tasks = cloneArray(board.tasks).map((task) => {
        if (asText(task.key) !== key) return task
        return {
          ...task,
          status: 'running',
          startedAt: now,
          endedAt: '',
          error: '',
          paramsSnapshot: this.captureSummaryTaskParams(key),
          logs: [],
        }
      })
      this.updateSummaryTaskBoard({ ...board, tasks, runState: 'running' })
      this.appendSummaryTaskLog(key, `开始执行：${def.label}`)
      this.startSummaryTaskLogTracking(key, { startedAtMs: Date.now(), suppressPlaceholder: !!options.suppressPlaceholder })
      try {
        await runAnalysisTask(this, key, { focus: false })
        this.pollSummaryTaskProgressLog(key)
        let hasResult = typeof def.hasResult === 'function' ? !!def.hasResult(this) : true
        if (!hasResult) {
          const statusText = this.getSummaryTaskProgressMessage(key)
          if (this.isSummaryTaskBackgroundRunning(key, def, statusText)) {
            hasResult = await this.waitForSummaryTaskBackgroundResult(key, def, {
              ...options,
              suppressPlaceholder: true,
            })
          }
        }
        if (!hasResult) {
          const statusText = this.getSummaryTaskProgressMessage(key)
          throw new Error(statusText || `${def.label}未产出可用结果，请检查对应面板状态后重试`)
        }
        const endedAt = new Date().toISOString()
        const merged = this.ensureSummaryTaskBoard(false)
        const nextTasks = cloneArray(merged.tasks).map((task) => {
          if (asText(task.key) !== key) return task
          const started = Date.parse(asText(task.startedAt || endedAt))
          const ended = Date.parse(endedAt)
          return {
            ...task,
            status: 'completed',
            endedAt,
            durationMs: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0,
            error: '',
          }
        })
        const nextRunState = nextTasks.every((item) => this.isSummaryTaskTerminalStatus(item.status))
          ? 'completed'
          : (nextTasks.some((item) => item.status === 'running') ? 'running' : 'idle')
        this.updateSummaryTaskBoard({ ...merged, tasks: nextTasks, runState: nextRunState })
        this.appendSummaryTaskLog(key, '执行完成', 'success')
      } catch (err) {
        this.pollSummaryTaskProgressLog(key)
        const endedAt = new Date().toISOString()
        const statusText = this.getSummaryTaskProgressMessage(key)
        const rawMessage = err && err.message ? err.message : String(err)
        const message = this.isSummaryTaskIntermediateStatus(key, statusText)
          ? (rawMessage || `${def.label}仍在处理中，请稍后查看`)
          : rawMessage
        const merged = this.ensureSummaryTaskBoard(false)
        const nextTasks = cloneArray(merged.tasks).map((task) => {
          if (asText(task.key) !== key) return task
          const started = Date.parse(asText(task.startedAt || endedAt))
          const ended = Date.parse(endedAt)
          return {
            ...task,
            status: 'failed',
            endedAt,
            durationMs: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0,
            error: this.isSummaryTaskIntermediateStatus(key, statusText) ? '' : message,
          }
        })
        this.updateSummaryTaskBoard({ ...merged, tasks: nextTasks, runState: 'failed' })
        this.appendSummaryTaskLog(key, `执行失败：${message}`, 'error')
        throw err
      } finally {
        this.stopSummaryTaskLogTracking(key)
      }
    },
    async rerunSummaryTask(taskKey = '') {
      const key = asText(taskKey)
      const task = this.getSummaryTaskByKey(key)
      if (!this.canRerunSummaryTask(task)) return
      this.agentSummaryError = ''
      await this.runSummaryTask(key, { force: true, source: 'manual-rerun' })
      await this.refreshAgentSummaryReadiness(true)
    },
    async startSummaryParallelFill() {
      if (!this.canRunSummaryParallelFill()) return
      this.syncSummaryTaskBoardFromLocalResults()
      if (!this.canRunSummaryParallelFill()) return
      const requestedKeys = this.getSummaryTaskKeysToFill()
      const keysToRun = this.filterSummaryTaskKeysForReuse(requestedKeys, { forcePoiFetch: false })
      const reusedKeys = requestedKeys.filter((key) => !keysToRun.includes(key))
      reusedKeys.forEach((key) => this.finalizeSummaryTaskAsReused(key))
      if (!keysToRun.length) {
        this.updateSummaryTaskBoard({
          ...this.ensureSummaryTaskBoard(false),
          runState: 'completed',
          lastRunAt: new Date().toISOString(),
        })
        this.agentSummaryError = ''
        await this.refreshAgentSummaryReadiness(true)
        return
      }
      const board = this.ensureSummaryTaskBoard(false)
      const next = {
        ...board,
        runState: 'running',
        lastRunAt: new Date().toISOString(),
      }
      this.updateSummaryTaskBoard(next)
      const promises = keysToRun.map((key) => this.runSummaryTask(key, { source: 'parallel' }))
      const settled = await Promise.allSettled(promises)
      const hasFailed = settled.some((item) => item.status === 'rejected')
      if (hasFailed) {
        const messages = settled
          .filter((item) => item.status === 'rejected')
          .map((item) => {
            const reason = item.reason
            return reason && reason.message ? reason.message : String(reason || '')
          })
          .filter(Boolean)
        this.agentSummaryError = messages.length ? `补齐失败：${messages[0]}` : '补齐失败，请查看任务日志'
      } else {
        this.agentSummaryError = ''
      }
      const current = this.ensureSummaryTaskBoard(false)
      this.updateSummaryTaskBoard({
        ...current,
        runState: hasFailed ? 'failed' : 'completed',
      })
      if (!hasFailed) {
        await this.refreshAgentSummaryReadiness(true)
      }
    },
    resetAgentSummaryRecompute() {
      if (typeof this.stopAllSummaryTaskLogTracking === 'function') {
        this.stopAllSummaryTaskLogTracking()
      }
      const board = this.createDefaultSummaryTaskBoard()
      const readiness = {
        checked: true,
        ready: false,
        missingTasks: this.getSummaryTaskKeys(),
        reused: [],
        fetched: [],
      }
      const payloads = {
        ...cloneObject(this.agentPanelPayloads),
        data_readiness: {
          checked: readiness.checked,
          ready: readiness.ready,
          missing_tasks: cloneArray(readiness.missingTasks),
          reused: [],
          fetched: [],
        },
        summary_status: {
          status: 'idle',
          generated: false,
          title: '区域总结',
          description: '',
          message: '',
        },
        summary_pack: {},
        summary_task_board: {
          run_state: board.runState,
          last_run_at: board.lastRunAt,
          tasks: cloneArray(board.tasks).map((task) => ({
            key: task.key,
            label: task.label,
            status: task.status,
            params_snapshot: cloneObject(task.paramsSnapshot),
            started_at: task.startedAt,
            ended_at: task.endedAt,
            duration_ms: task.durationMs,
            logs: cloneArray(task.logs),
            error: task.error,
          })),
        },
      }
      const draft = createAgentSessionRecord({
        title: '区域总结补齐',
        preview: '复用已有结果并补齐缺失分析',
        historyId: this.getCurrentAgentHistoryId(),
        panelKind: 'commercial_summary',
        status: 'idle',
        stage: 'gating',
        output: {
          cards: [],
          panelPayloads: payloads,
          decision: { summary: '', mode: 'judgment', strength: 'weak', canAct: false },
          support: [],
          counterpoints: [],
          actions: [],
          boundary: [],
        },
        diagnostics: { executionTrace: [], usedTools: [], citations: [], researchNotes: [], auditIssues: [], thinkingTimeline: [], error: '' },
        contextSummary: {},
        plan: { steps: [], followupSteps: [], followupApplied: false, summary: '' },
        persisted: false,
        snapshotLoaded: true,
        titleSource: 'fallback',
      })
      this.updateAgentSessions([draft, ...this.agentSessions], { loaded: this.agentSessionsLoaded })
      this.agentConversationId = draft.id
      this.activeAgentSessionId = draft.id
      this.agentWorkspaceView = 'chat'
      this.agentInput = ''
      this.agentStatus = 'idle'
      this.agentStage = 'gating'
      this.agentCards = []
      this.agentDecision = { summary: '', mode: 'judgment', strength: 'weak', canAct: false }
      this.agentSupport = []
      this.agentCounterpoints = []
      this.agentActions = []
      this.agentBoundary = []
      this.agentExecutionTrace = []
      this.agentUsedTools = []
      this.agentCitations = []
      this.agentResearchNotes = []
      this.agentAuditIssues = []
      this.agentNextSuggestions = []
      this.agentMessages = []
      this.agentPanelPayloads = payloads
      this.agentSummaryReadiness = readiness
      this.agentSummaryError = ''
      this.agentSummaryWarnings = []
      this.agentSummaryLoading = false
      this.agentSummaryGenerating = false
      this.agentSummaryProgressPhase = ''
      this.resetAgentSummaryStreamSections()
      this.summaryTaskBoard = board
      this.agentTabs = this.createDefaultAgentTabs()
      this.createAgentSummaryTab({ title: '区域总结', reuseExisting: true })
      this.syncCurrentAgentSession({ persisted: false, snapshotLoaded: true, panelKind: 'commercial_summary' })
    },
    isAgentSummaryBusy() {
      return Boolean(this.agentSummaryGenerating || this.agentSummaryLoading)
    },
    isAgentSummaryTaskBoardRunning() {
      const board = this.ensureSummaryTaskBoard(false)
      return asText(board.runState) === 'running'
        || cloneArray(board.tasks).some((item) => asText(item && item.status) === 'running')
    },
    isAgentSummaryPrimaryActionDisabled() {
      return Boolean(this.agentSummaryGenerating || this.isAgentSummaryTaskBoardRunning())
    },
    getAgentSummaryPrimaryActionLabel() {
      if (this.agentSummaryGenerating) return '生成中...'
      if (this.canGenerateSummaryAfterTasks()) return '生成区域总结'
      return this.getSummaryTaskKeysToFill().length ? '补齐缺失' : '复用已有结果'
    },
    runAgentSummaryPrimaryAction() {
      if (this.canGenerateSummaryAfterTasks()) {
        return this.generateAgentSummaryPanel()
      }
      return this.startSummaryParallelFill()
    },
    createSummaryHistorySessionId() {
      return `summary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    },
    getAgentSummaryPhaseLabel() {
      const phase = asText(this.agentSummaryProgressPhase)
      const mapping = {
        precheck: '正在检查数据就绪度',
        fetch_missing: '正在补齐缺失分析',
        derive_analysis: '正在补齐结构化分析',
        analysis_started: '正在生成结构化区域总结',
        completed: '区域总结生成完成',
      }
      return mapping[phase] || ''
    },
    createEmptyAgentSummaryStreamSections() {
      return {
        headline: { key: 'headline', content: '', status: 'pending', error: '', payload: {} },
        tags: { key: 'tags', content: '', status: 'pending', error: '', payload: {} },
        spatial_structure: { key: 'spatial_structure', content: '', status: 'pending', error: '', payload: {} },
        poi_structure: { key: 'poi_structure', content: '', status: 'pending', error: '', payload: {} },
        consumption_vitality: { key: 'consumption_vitality', content: '', status: 'pending', error: '', payload: {} },
        business_support: { key: 'business_support', content: '', status: 'pending', error: '', payload: {} },
        user_profile: { key: 'user_profile', content: '', status: 'pending', error: '', payload: {} },
        behavior: { key: 'behavior', content: '', status: 'pending', error: '', payload: {} },
        followups: { key: 'followups', content: '', status: 'pending', error: '', payload: {} },
      }
    },
    resetAgentSummaryStreamSections() {
      this.agentSummaryStreamSections = this.createEmptyAgentSummaryStreamSections()
      return this.agentSummaryStreamSections
    },
    ensureAgentSummaryStreamSections() {
      const current = cloneObject(this.agentSummaryStreamSections)
      if (Object.keys(current).length) return current
      return this.resetAgentSummaryStreamSections()
    },
    patchAgentSummaryStreamSection(sectionKey = '', patch = {}) {
      const key = asText(sectionKey)
      if (!key) return null
      const current = this.ensureAgentSummaryStreamSections()
      this.agentSummaryStreamSections = {
        ...current,
        [key]: {
          ...(current[key] || { key, content: '', status: 'pending', error: '', payload: {} }),
          ...cloneObject(patch),
        },
      }
      return this.agentSummaryStreamSections[key]
    },
    getAgentSummaryFollowupQuestions(panelPayloads = null) {
      const payloads = panelPayloads && typeof panelPayloads === 'object'
        ? cloneObject(panelPayloads)
        : this.getAgentActiveSummaryPanelPayloads()
      const summaryPack = this.getAgentSummaryPack(payloads)
      const items = cloneArray(
        summaryPack.followup_questions
        || payloads.summary_followup_questions
        || (((this.agentSummaryStreamSections || {}).followups || {}).payload || {}).followup_questions,
      ).map((item) => asText(item)).filter(Boolean)
      if (items.length) return items
      return [
        '请解释这份区域总结背后的证据链与判断依据',
        '请展开这一范围的业态建议与主要风险',
        '请把这份区域总结转成可执行清单',
      ]
    },
    getAgentSummaryGeneratingSections() {
      const phase = asText(this.agentSummaryProgressPhase)
      const phaseStarted = phase === 'analysis_started'
      const liveSections = this.ensureAgentSummaryStreamSections()
      const buildTaskState = (taskKeys = []) => {
        const keys = cloneArray(taskKeys).map((item) => asText(item)).filter(Boolean)
        const tasks = keys.map((key) => this.getSummaryTaskByKey(key)).filter(Boolean)
        const pendingLabels = keys
          .filter((key) => {
            const task = this.getSummaryTaskByKey(key)
            return !(task && this.isSummaryTaskTerminalStatus(task.status))
          })
          .map((key) => this.getAgentSummaryTaskLabel(key))
        const hasRunning = tasks.some((task) => asText(task && task.status) === 'running')
        const allTerminal = keys.length > 0 && keys.every((key) => {
          const task = this.getSummaryTaskByKey(key)
          return !!(task && this.isSummaryTaskTerminalStatus(task.status))
        })
        return { hasRunning, allTerminal, pendingLabels }
      }
      const buildStatusLabel = (status = '') => {
        if (status === 'failed') return '失败'
        if (status === 'ready') return '已就绪'
        if (status === 'active') return '生成中'
        return '等待中'
      }
      const buildDetail = (state, fallback = '等待生成结构化内容') => {
        if (phaseStarted && state.allTerminal) return '结构化证据已齐，正在组织成文'
        if (state.hasRunning) return '相关分析正在生成'
        if (state.allTerminal) return '结构化证据已齐备'
        if (state.pendingLabels.length) return `等待${state.pendingLabels.slice(0, 2).join('、')}`
        return fallback
      }
      const sections = [
        { key: 'headline', title: '一句话结论', layout: 'text', taskKeys: ['poi_grid', 'population', 'nightlight', 'road_syntax'] },
        { key: 'tags', title: '商业类型标签（ICSC）', layout: 'tags', taskKeys: ['poi_grid'] },
        { key: 'spatial_structure', title: '空间结构', layout: 'panel', taskKeys: ['poi_grid', 'population', 'nightlight', 'road_syntax'] },
        { key: 'poi_structure', title: 'POI结构', layout: 'panel', taskKeys: ['poi_grid'] },
        { key: 'consumption_vitality', title: '消费活力', layout: 'panel', taskKeys: ['nightlight'] },
        { key: 'business_support', title: '业态承接', layout: 'panel', taskKeys: ['poi_grid', 'road_syntax'] },
        { key: 'user_profile', title: '用户画像', layout: 'list', taskKeys: ['population'] },
        { key: 'behavior', title: '商业行为推断', layout: 'list', taskKeys: ['nightlight', 'road_syntax'] },
        { key: 'followups', title: '快捷追问', layout: 'actions', taskKeys: ['poi_grid', 'population', 'nightlight', 'road_syntax'] },
      ]
      return sections.map((section) => {
        const live = liveSections[section.key] || {}
        const state = buildTaskState(section.taskKeys)
        let status = 'pending'
        if (['ready', 'failed', 'active'].includes(asText(live.status))) {
          status = asText(live.status)
        } else if (phaseStarted && (section.key === 'headline' || section.key === 'followups')) {
          status = 'active'
        } else if (state.hasRunning) {
          status = 'active'
        } else if (state.allTerminal) {
          status = 'ready'
        } else if (phase === 'derive_analysis' && ['headline', 'spatial_structure', 'poi_structure', 'consumption_vitality', 'business_support'].includes(section.key)) {
          status = 'active'
        }
        return {
          ...section,
          status,
          statusLabel: buildStatusLabel(status),
          detail: asText(live.error) || (!asText(live.content) ? buildDetail(state) : ''),
          content: asText(live.content),
          payload: cloneObject(live.payload),
        }
      })
    },
    getAgentSummaryGateProgressText() {
      const phaseLabel = this.getAgentSummaryPhaseLabel()
      if (phaseLabel) return `${phaseLabel}…`
      if (this.agentSummaryLoading) return '正在检查数据就绪度…'
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      if (readiness.checked) {
        if (readiness.ready || this.canGenerateSummaryAfterTasks()) return '数据已就绪，可直接生成区域总结'
        const pendingCount = this.getAgentSummaryMissingTaskLabels().length
        return pendingCount > 0 ? `已完成数据检查，还缺 ${pendingCount} 项` : '已完成数据检查'
      }
      return '等待开始'
    },
    async refreshAgentSummaryReadiness(force = false) {
      if (!this.isCurrentAgentSummaryTabActive()) return this.agentSummaryReadiness
      if (this.agentSummaryLoading) return this.agentSummaryReadiness
      if (!force && this.hasAgentSummaryPack() && this.agentSummaryReadiness.ready) return this.agentSummaryReadiness
      this.agentSummaryLoading = true
      this.agentSummaryError = ''
      this.agentSummaryWarnings = []
      try {
        await Promise.allSettled([
          typeof this.loadPopulationMeta === 'function' ? this.loadPopulationMeta(false) : null,
          typeof this.loadNightlightMeta === 'function' ? this.loadNightlightMeta(false) : null,
        ].filter(Boolean))
        const res = await fetch('/api/v1/analysis/agent/summary/readiness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: asText(this.activeAgentSessionId || this.agentConversationId),
            history_id: asText(this.getCurrentAgentHistoryId()),
            analysis_snapshot: this.buildAgentAnalysisSnapshot(),
          }),
        })
        if (!res.ok) {
          let detail = ''
          try {
            detail = await res.text()
          } catch (_) {}
          throw new Error(detail || `/api/v1/analysis/agent/summary/readiness 请求失败(${res.status})`)
        }
        const data = await res.json()
        this.agentSummaryReadiness = this.normalizeAgentSummaryReadiness(data && data.data_readiness)
        this.agentSummaryWarnings = cloneArray(data && data.warnings)
        this.agentSummaryError = asText(data && data.error)
        this.agentPanelPayloads = {
          ...cloneObject(this.agentPanelPayloads),
          data_readiness: {
            checked: this.agentSummaryReadiness.checked,
            ready: this.agentSummaryReadiness.ready,
            missing_tasks: cloneArray(this.agentSummaryReadiness.missingTasks),
            reused: cloneArray(this.agentSummaryReadiness.reused),
            fetched: cloneArray(this.agentSummaryReadiness.fetched),
          },
        }
        this.syncCurrentAgentSession()
        return this.agentSummaryReadiness
      } catch (err) {
        this.agentSummaryError = err && err.message ? err.message : String(err)
        return this.agentSummaryReadiness
      } finally {
        this.agentSummaryLoading = false
      }
    },
    async generateAgentSummaryPanel() {
      if (this.agentSummaryGenerating) return
      if (!this.isAgentSummaryTabActive()) {
        this.createAgentSummaryTab({ title: '区域总结' })
      } else {
        this.createAgentSummaryTab({ title: '区域总结', reuseExisting: true })
      }
      this.agentSummaryGenerating = true
      this.resetAgentSummaryStreamSections()
      this.agentSummaryProgressPhase = 'precheck'
      this.agentSummaryError = ''
      this.agentSummaryWarnings = []
      this.agentPanelPayloads = {
        ...cloneObject(this.agentPanelPayloads),
        summary_status: {
          status: 'generating',
          generated: false,
          title: '区域总结生成中',
          description: '正在基于结构化证据生成区域总结。',
          message: '',
        },
      }
      this.syncCurrentAgentSession()
      const readinessSnapshot = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      const canUseCurrentReadiness = readinessSnapshot.checked
        && readinessSnapshot.ready
        && !cloneArray(readinessSnapshot.missingTasks).length
      if (canUseCurrentReadiness) {
        this.refreshAgentSummaryReadiness(true).catch((err) => {
          console.warn('Agent summary readiness refresh failed while generating', err)
        })
      } else {
        await this.refreshAgentSummaryReadiness(true)
      }
      if (!this.canGenerateSummaryAfterTasks()) {
        const pending = this.getSummaryTaskKeysFromReadiness().map((taskKey) => this.getAgentSummaryTaskLabel(taskKey))
        this.agentSummaryError = pending.length ? `请先补齐缺失项：${pending.join('、')}` : '请先完成补齐任务后再生成区域总结'
        this.agentSummaryGenerating = false
        return
      }
      try {
        const res = await fetch('/api/v1/analysis/agent/summary/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: asText(this.activeAgentSessionId || this.agentConversationId),
            history_id: asText(this.getCurrentAgentHistoryId()),
            analysis_snapshot: this.buildAgentAnalysisSnapshot(),
          }),
        })
        if (!res.ok) {
          let detail = ''
          try {
            detail = await res.text()
          } catch (_) {}
          throw new Error(detail || `/api/v1/analysis/agent/summary/generate 请求失败(${res.status})`)
        }
        let finalPayload = null
        await consumeSseStream(res, (event) => {
          const type = asText(event && event.type)
          const payload = cloneObject(event && event.payload)
          const normalizeStreamKey = (key, extra = {}) => {
            const rawKey = asText(key)
            if (rawKey === 'secondary') {
              return asText(extra.section_key || extra.sectionKey)
            }
            return rawKey
          }
          if (type === 'status') {
            this.agentSummaryProgressPhase = asText(payload.phase) || this.agentSummaryProgressPhase
            return
          }
          if (type === 'section_start') {
            const streamKey = normalizeStreamKey(payload.key, payload)
            if (!streamKey) return
            this.patchAgentSummaryStreamSection(streamKey, {
              status: 'active',
              error: '',
              content: '',
              payload: cloneObject(payload.payload),
            })
            return
          }
          if (type === 'section_delta') {
            const streamKey = normalizeStreamKey(payload.key, payload)
            if (!streamKey) return
            const current = cloneObject((this.ensureAgentSummaryStreamSections() || {})[streamKey] || {})
            this.patchAgentSummaryStreamSection(streamKey, {
              status: 'active',
              content: `${asText(current.content)}${asText(payload.delta)}`,
            })
            return
          }
          if (type === 'section_complete') {
            const nextStatus = asText(payload.status || 'ready') || 'ready'
            const sectionPayload = cloneObject(payload.payload)
            let nextContent = ''
            const streamKey = normalizeStreamKey(payload.key, payload)
            if (payload.key === 'headline') {
              nextContent = [asText(sectionPayload.summary), asText(sectionPayload.supporting_clause)].filter(Boolean).join('\n')
            } else if (payload.key === 'user_profile' || payload.key === 'behavior') {
              nextContent = [asText(sectionPayload.headline), ...cloneArray(sectionPayload.traits).map((item) => asText(item)).filter(Boolean)].join('\n')
            } else if (payload.key === 'secondary') {
              cloneArray(sectionPayload.secondary_conclusions).forEach((item) => {
                const itemKey = asText(item && item.section_key)
                if (!itemKey) return
                this.patchAgentSummaryStreamSection(itemKey, {
                  status: nextStatus === 'failed' ? 'failed' : 'ready',
                  payload: cloneObject(item),
                  content: asText(item && item.reasoning),
                  error: nextStatus === 'failed' ? (asText(payload.message) || '当前面板生成失败') : '',
                })
              })
              return
            } else if (['spatial_structure', 'poi_structure', 'consumption_vitality', 'business_support'].includes(payload.key)) {
              nextContent = asText(sectionPayload.reasoning)
            } else if (payload.key === 'followups') {
              nextContent = cloneArray(sectionPayload.followup_questions).map((item) => asText(item)).filter(Boolean).join('\n')
            } else if (payload.key === 'tags') {
              nextContent = cloneArray(sectionPayload.icsc_tags).map((item) => asText(item)).filter(Boolean).join('、')
            }
            if (!streamKey) return
            this.patchAgentSummaryStreamSection(streamKey, {
              status: nextStatus === 'failed' ? 'failed' : 'ready',
              payload: sectionPayload,
              content: nextContent || asText(((this.ensureAgentSummaryStreamSections() || {})[streamKey] || {}).content),
              error: nextStatus === 'failed' ? (asText(payload.message) || '当前面板生成失败') : '',
            })
            return
          }
          if (type === 'panel_payload') {
            const nextPayloads = {
              ...cloneObject(this.agentPanelPayloads),
              ...cloneObject(payload.payload),
            }
            this.agentPanelPayloads = nextPayloads
            return
          }
          if (type === 'error') {
            const targetKey = normalizeStreamKey(payload.key, payload)
            if (targetKey && targetKey !== 'global') {
              const current = cloneObject((this.ensureAgentSummaryStreamSections() || {})[targetKey] || {})
              this.patchAgentSummaryStreamSection(targetKey, {
                status: 'failed',
                error: asText(payload.message) || '当前面板生成失败',
                content: asText(current.content),
              })
            } else {
              this.agentSummaryError = asText(payload.message) || this.agentSummaryError
            }
            return
          }
          if (type === 'final') {
            finalPayload = payload
          }
        })
        if (!finalPayload) {
          throw new Error('区域总结流式生成未返回最终结果')
        }
        const data = cloneObject(finalPayload)
        const phases = cloneArray(data.phases).map((item) => asText(item)).filter(Boolean)
        this.agentSummaryProgressPhase = phases.length ? phases[phases.length - 1] : 'completed'
        this.agentSummaryReadiness = this.normalizeAgentSummaryReadiness(data && data.data_readiness)
        this.agentSummaryWarnings = cloneArray(data && data.warnings)
        this.agentSummaryError = asText(data && data.error)
        this.agentPanelPayloads = {
          ...cloneObject(this.agentPanelPayloads),
          data_readiness: {
            checked: this.agentSummaryReadiness.checked,
            ready: this.agentSummaryReadiness.ready,
            missing_tasks: cloneArray(this.agentSummaryReadiness.missingTasks),
            reused: cloneArray(this.agentSummaryReadiness.reused),
            fetched: cloneArray(this.agentSummaryReadiness.fetched),
          },
        }
        const payloads = cloneObject(data && data.panel_payloads)
        if (payloads && typeof payloads === 'object') {
          this.agentPanelPayloads = {
            ...cloneObject(this.agentPanelPayloads),
            ...payloads,
          }
        }
        if (data && data.summary_pack && typeof data.summary_pack === 'object') {
          this.agentPanelPayloads = {
            ...cloneObject(this.agentPanelPayloads),
            summary_pack: cloneObject(data.summary_pack),
          }
        }
        const summaryPack = cloneObject(this.getAgentSummaryPack())
        const summaryStatus = this.getAgentSummaryStatus(this.agentPanelPayloads)
        if (!summaryStatus.generated || !this.hasAgentSummaryPack(summaryPack)) {
          return
        }
        const headline = asText((summaryPack.headline_judgment || {}).summary)
        const supporting = asText((summaryPack.headline_judgment || {}).supporting_clause)
        const summarySession = createAgentSessionRecord({
          id: this.createSummaryHistorySessionId(),
          title: clampText(headline || '区域总结', 60) || '区域总结',
          preview: clampText(supporting || headline || '区域总结', 120) || '区域总结',
          historyId: this.getCurrentAgentHistoryId(),
          panelKind: 'commercial_summary',
          status: 'answered',
          stage: 'answered',
          input: '',
          messages: [],
          cards: [],
          decision: this.agentDecision,
          support: this.agentSupport,
          counterpoints: this.agentCounterpoints,
          actions: this.agentActions,
          boundary: this.agentBoundary,
          executionTrace: this.agentExecutionTrace,
          usedTools: this.agentUsedTools,
          citations: this.agentCitations,
          researchNotes: this.agentResearchNotes,
          auditIssues: this.agentAuditIssues,
          nextSuggestions: [],
          clarificationQuestion: '',
          clarificationOptions: [],
          riskPrompt: '',
          error: '',
          contextSummary: this.agentContextSummary,
          plan: this.agentPlan,
          panelPayloads: this.agentPanelPayloads,
          persisted: true,
          snapshotLoaded: true,
          titleSource: 'ai',
        })
        this.updateAgentSessions(
          [summarySession, ...this.agentSessions.filter((item) => asText(item && item.id) !== asText(summarySession.id))],
          { loaded: this.agentSessionsLoaded },
        )
        this.applyAgentSessionSnapshot(summarySession)
        const synced = this.syncCurrentAgentSession({
          persisted: true,
          status: 'answered',
          historyId: this.getCurrentAgentHistoryId(),
          panelKind: 'commercial_summary',
        })
        const sessionId = asText((synced && synced.id) || summarySession.id)
        if (sessionId) {
          await this.putAgentSession(sessionId, {
            status: 'answered',
            persisted: true,
            historyId: this.getCurrentAgentHistoryId(),
            panelKind: 'commercial_summary',
          })
        }
        await this.loadAgentSessionSummaries(true)
      } catch (err) {
        const message = err && err.message ? err.message : String(err)
        this.agentSummaryError = message
        this.agentPanelPayloads = {
          ...cloneObject(this.agentPanelPayloads),
          summary_status: {
            status: 'failed',
            generated: false,
            title: '区域总结生成失败',
            description: '生成区域总结时发生错误，请检查后重试。',
            message,
          },
        }
        this.agentSummaryProgressPhase = ''
      } finally {
        if (!this.agentSummaryReadiness.ready) {
          this.agentSummaryProgressPhase = ''
        }
        this.agentSummaryGenerating = false
      }
    },
    ensureAgentTabs(commit = false) {
      const base = this.agentTabs && typeof this.agentTabs === 'object'
        ? this.agentTabs
        : this.createDefaultAgentTabs()
      const currentSummaryPack = this.getAgentSummaryPack(this.agentPanelPayloads)
      const preservedSummaryPack = cloneObject((((base.summaryTab || {}).content) || {}))
      const defaultSummaryPack = this.hasAgentSummaryPack(currentSummaryPack) || Object.keys(currentSummaryPack).length
        ? currentSummaryPack
        : preservedSummaryPack
      const currentSummaryStatus = this.getAgentSummaryStatus(this.agentPanelPayloads)
      const nextTabs = {
        summaryTab: {
          ...this.createDefaultAgentSummaryTab(),
          ...cloneObject(base.summaryTab && typeof base.summaryTab === 'object' ? base.summaryTab : {}),
          id: 'summary',
          kind: 'summary',
          frozen: true,
          source: 'current',
        },
        summaryTabs: cloneArray(base.summaryTabs).map((item) => ({
          id: asText(item && item.id),
          kind: 'summary',
          title: asText(item && item.title) || '区域总结',
          source: asText(item && item.source) || 'history',
          sessionId: asText(item && item.sessionId),
          createdAt: asText(item && item.createdAt) || new Date().toISOString(),
          readonly: Object.prototype.hasOwnProperty.call(item || {}, 'readonly') ? !!item.readonly : false,
          panelPayloads: cloneObject(item && item.panelPayloads),
          content: cloneObject(item && item.content),
          evidenceRefs: cloneArray(item && item.evidenceRefs),
        })).filter((item) => item.id),
        siteSelectionTabs: cloneArray(base.siteSelectionTabs).map((item) => ({
          id: asText(item && item.id),
          kind: 'site_selection',
          title: asText(item && item.title) || '区域内选址',
          source: asText(item && item.source) || 'draft',
          sessionId: asText(item && item.sessionId),
          readonly: !!(item && item.readonly),
          createdAt: asText(item && item.createdAt) || new Date().toISOString(),
        })).filter((item) => item.id),
        followupTabs: cloneArray(base.followupTabs).map((item) => ({
          id: asText(item && item.id),
          kind: 'followup',
          title: this.getAgentFollowupWindowTitle(item, item && item.title),
          linkedSummaryId: asText(item && item.linkedSummaryId) || 'summary',
          source: asText(item && item.source) || 'draft',
          sessionId: asText(item && item.sessionId),
          readonly: !!(item && item.readonly && asText(item && item.source) !== 'history'),
          createdAt: asText(item && item.createdAt) || new Date().toISOString(),
          thread: this.createAgentFollowupThreadState(item && item.thread),
        })).filter((item) => item.id),
        activeTabId: asText(base.activeTabId),
        followupLimit: Number(base.followupLimit || 6) || 6,
        nextFollowupNumber: Number(base.nextFollowupNumber || 1) || 1,
      }
      if (!nextTabs.summaryTab.id) nextTabs.summaryTab.id = 'summary'
      const currentSummaryTabs = cloneArray(nextTabs.summaryTabs).filter((item) => asText(item.source) === 'current')
      const historySummaryTabs = cloneArray(nextTabs.summaryTabs).filter((item) => asText(item.source) !== 'current')
      const shouldAutoCreateCurrentSummary = true
      let syncedCurrentSummaryTabs = currentSummaryTabs.map((item) => {
        const preservedPayloads = cloneObject(item.panelPayloads)
        const payloadPack = this.getAgentSummaryPack(preservedPayloads)
        const content = Object.keys(payloadPack).length
          ? cloneObject(payloadPack)
          : (Object.keys(cloneObject(item.content)).length ? cloneObject(item.content) : cloneObject(defaultSummaryPack))
        const panelPayloads = {
          ...preservedPayloads,
          ...(Object.keys(content).length ? { summary_pack: cloneObject(content) } : {}),
        }
        if (!panelPayloads.summary_task_board && !panelPayloads.summaryTaskBoard) {
          panelPayloads.summary_task_board = this.normalizeSummaryTaskBoard(this.summaryTaskBoard)
        }
        return {
          ...item,
          title: this.getAgentSummaryWindowTitle(panelPayloads, item.title || currentSummaryStatus.title),
          panelPayloads,
          content: cloneObject(content),
          evidenceRefs: cloneArray(content.evidence_refs || item.evidenceRefs || []),
        }
      })
      if (!syncedCurrentSummaryTabs.length && shouldAutoCreateCurrentSummary) {
        syncedCurrentSummaryTabs = [{
          id: 'summary-current',
          kind: 'summary',
          title: this.getAgentSummaryWindowTitle(this.agentPanelPayloads, currentSummaryStatus.title),
          source: 'current',
          sessionId: '',
          readonly: false,
          createdAt: new Date().toISOString(),
          panelPayloads: cloneObject(this.agentPanelPayloads),
          content: cloneObject(defaultSummaryPack),
          evidenceRefs: cloneArray(defaultSummaryPack.evidence_refs || []),
        }]
      }
      nextTabs.summaryTabs = [...syncedCurrentSummaryTabs, ...historySummaryTabs]
      const validIds = new Set([...nextTabs.summaryTabs.map((item) => item.id), ...nextTabs.siteSelectionTabs.map((item) => item.id), ...nextTabs.followupTabs.map((item) => item.id)])
      if (!validIds.has(nextTabs.activeTabId)) {
        nextTabs.activeTabId = nextTabs.summaryTabs[0] ? nextTabs.summaryTabs[0].id : (nextTabs.siteSelectionTabs[0] ? nextTabs.siteSelectionTabs[0].id : (nextTabs.followupTabs[0] ? nextTabs.followupTabs[0].id : ''))
      }
      nextTabs.summaryTab.content = defaultSummaryPack
      nextTabs.summaryTab.evidenceRefs = cloneArray((defaultSummaryPack.evidence_refs || []))
      if (commit) {
        this.agentTabs = nextTabs
      }
      return nextTabs
    },
    getAgentTopTabs() {
      const tabs = this.ensureAgentTabs(false)
      return [
        ...tabs.summaryTabs.map((item) => ({
          id: item.id,
          title: item.title || '区域总结',
          kind: 'summary',
          closable: true,
          source: item.source || 'history',
          sessionId: item.sessionId || '',
        })),
        ...tabs.siteSelectionTabs.map((item) => ({
          id: item.id,
          title: item.title || '区域内选址',
          kind: 'site_selection',
          closable: true,
          source: item.source || 'draft',
          sessionId: item.sessionId || '',
        })),
        ...tabs.followupTabs.map((item) => ({
          id: item.id,
          title: item.title || '追问解释',
          kind: 'followup',
          closable: true,
          source: item.source || 'draft',
          sessionId: item.sessionId || '',
        })),
      ]
    },
    isAgentSummaryTabActive() {
      return asText(this.getAgentActiveTopTab().kind) === 'summary'
    },
    isAgentSiteSelectionTabActive() {
      return asText(this.getAgentActiveTopTab().kind) === 'site_selection'
    },
    getAgentActiveFollowupTab() {
      const tabs = this.ensureAgentTabs(false)
      const activeId = asText(tabs.activeTabId)
      return tabs.followupTabs.find((item) => item.id === activeId) || null
    },
    captureAgentActiveFollowupTabState() {
      const tabs = this.ensureAgentTabs(true)
      if (asText(this.getAgentActiveTopTab().kind) !== 'followup') return
      const target = this.getAgentActiveFollowupTab()
      if (!target) return
      if (target.readonly) return
      target.thread = this.buildAgentFollowupThreadFromCurrentState()
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
    },
    captureAgentActiveSummaryTabState() {
      const tabs = this.ensureAgentTabs(true)
      const activeTab = this.getAgentActiveTopTab()
      if (asText(activeTab.kind) !== 'summary' || asText(activeTab.source) !== 'current') return
      const target = cloneArray(tabs.summaryTabs).find((item) => item.id === activeTab.id)
      if (!target || target.readonly) return
      const panelPayloads = {
        ...cloneObject(this.agentPanelPayloads),
        summary_task_board: this.buildSummaryTaskBoardUiState(),
      }
      const summaryPack = this.getAgentSummaryPack(panelPayloads)
      target.title = this.getAgentSummaryWindowTitle(panelPayloads, target.title || '区域总结')
      target.panelPayloads = panelPayloads
      target.content = cloneObject(summaryPack)
      target.evidenceRefs = cloneArray(summaryPack.evidence_refs || [])
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
    },
    switchAgentTopTab(tabId = '') {
      const nextId = asText(tabId)
      if (!nextId) return
      this.closeAgentCreateTabMenu()
      this.captureAgentActiveSummaryTabState()
      this.captureAgentActiveFollowupTabState()
      const tabs = this.ensureAgentTabs(true)
      if (tabs.activeTabId === nextId) return
      tabs.activeTabId = nextId
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
      const targetSummary = cloneArray(tabs.summaryTabs).find((item) => item.id === nextId)
      if (targetSummary) {
        this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
        if (asText(targetSummary.source) === 'current') {
          this.agentPanelPayloads = cloneObject(targetSummary.panelPayloads)
        }
        this.syncAgentSummaryStateFromPanelPayload(targetSummary.panelPayloads)
      } else if (tabs.siteSelectionTabs.some((item) => item.id === nextId)) {
        this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      } else {
        const target = tabs.followupTabs.find((item) => item.id === nextId)
        if (target) {
          this.applyAgentFollowupThreadToCurrentState(target.thread)
          this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
        }
      }
      this.syncCurrentAgentSession()
      if (targetSummary && asText(targetSummary.source) === 'current') {
        this.syncSummaryTaskBoardFromLocalResults()
        this.refreshAgentSummaryReadiness(false)
      }
    },
    canCreateAgentFollowupTab() {
      const tabs = this.ensureAgentTabs(false)
      return tabs.followupTabs.length < Number(tabs.followupLimit || 6)
    },
    openAgentCreateTabMenu() {
      this.agentCreateTabMenuOpen = true
    },
    closeAgentCreateTabMenu() {
      this.agentCreateTabMenuOpen = false
    },
    toggleAgentCreateTabMenu(event = null) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      this.agentCreateTabMenuOpen = !this.agentCreateTabMenuOpen
    },
    createAgentSummaryTab(options = {}) {
      const tabs = this.ensureAgentTabs(true)
      const panelPayloads = {
        ...cloneObject(this.agentPanelPayloads),
        summary_task_board: this.buildSummaryTaskBoardUiState(),
      }
      const summaryPack = this.getAgentSummaryPack(panelPayloads)
      const reuseExisting = !!options.reuseExisting
      const existing = reuseExisting
        ? cloneArray(tabs.summaryTabs).find((item) => asText(item.source) === 'current')
        : null
      const summaryTab = existing || {
        id: reuseExisting ? 'summary-current' : this.createAgentSummaryWindowId(),
        kind: 'summary',
        source: 'current',
        sessionId: '',
        readonly: false,
        createdAt: new Date().toISOString(),
        panelPayloads,
        content: cloneObject(summaryPack),
        evidenceRefs: cloneArray(summaryPack.evidence_refs || []),
      }
      summaryTab.title = this.getAgentSummaryWindowTitle(panelPayloads, options.title)
      summaryTab.panelPayloads = panelPayloads
      summaryTab.content = cloneObject(summaryPack)
      summaryTab.evidenceRefs = cloneArray(summaryPack.evidence_refs || [])
      if (!existing) {
        tabs.summaryTabs = [...cloneArray(tabs.summaryTabs), summaryTab]
      } else {
        tabs.summaryTabs = cloneArray(tabs.summaryTabs).map((item) => (item.id === existing.id ? summaryTab : item))
      }
      tabs.activeTabId = summaryTab.id
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
      this.closeAgentCreateTabMenu()
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncSummaryTaskBoardFromLocalResults()
      this.syncCurrentAgentSession()
      this.refreshAgentSummaryReadiness(false)
      return summaryTab.id
    },
    createAgentSiteSelectionTab(options = {}) {
      const tabs = this.ensureAgentTabs(true)
      this.captureAgentActiveSummaryTabState()
      this.captureAgentActiveFollowupTabState()
      const tabId = this.createAgentSiteSelectionWindowId()
      const tab = {
        id: tabId,
        kind: 'site_selection',
        title: this.formatAgentTabTitle('site_selection', options.title),
        source: asText(options.source) || 'draft',
        sessionId: '',
        readonly: false,
        createdAt: new Date().toISOString(),
      }
      tabs.siteSelectionTabs = [...cloneArray(tabs.siteSelectionTabs), tab]
      tabs.activeTabId = tabId
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
      this.closeAgentCreateTabMenu()
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
      return tabId
    },
    createAgentFollowupTab(options = {}) {
      const tabs = this.ensureAgentTabs(true)
      if (!this.canCreateAgentFollowupTab()) {
        window.alert(`最多可创建 ${tabs.followupLimit} 个追问解释标签，请先关闭旧标签。`)
        return null
      }
      this.captureAgentActiveFollowupTabState()
      const number = Number(tabs.nextFollowupNumber || (tabs.followupTabs.length + 1))
      const tabId = `followup-${number}`
      const seedPrompt = asText(options.seedPrompt)
      const thread = this.createAgentFollowupThreadState({
        input: seedPrompt,
      })
      const title = this.getAgentFollowupWindowTitle({
        title: options.title,
        messages: seedPrompt ? [{ role: 'user', content: seedPrompt }] : [],
      }, options.title)
      tabs.followupTabs = [
        ...cloneArray(tabs.followupTabs),
        {
          id: tabId,
          kind: 'followup',
          title,
          linkedSummaryId: 'summary',
          source: asText(options.source) || 'draft',
          sessionId: asText(options.sessionId),
          readonly: !!options.readonly,
          createdAt: new Date().toISOString(),
          thread,
        },
      ]
      tabs.nextFollowupNumber = number + 1
      tabs.activeTabId = tabId
      this.agentTabs = tabs
      this.closeAgentCreateTabMenu()
      this.applyAgentFollowupThreadToCurrentState(thread)
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
      return tabId
    },
    buildAgentHistorySummaryTab(session = null) {
      const sessionId = asText(session && session.id)
      const panelPayloads = cloneObject(session && session.panelPayloads)
      const pack = this.getAgentSummaryPack(panelPayloads)
      return {
        id: `summary-history-${sessionId}`,
        kind: 'summary',
        title: this.getAgentSummaryWindowTitle(panelPayloads, session && session.title),
        source: 'history',
        sessionId,
        readonly: false,
        createdAt: new Date().toISOString(),
        panelPayloads,
        content: pack,
        evidenceRefs: cloneArray(pack.evidence_refs || []),
      }
    },
    buildAgentHistoryFollowupTab(session = null) {
      const sessionId = asText(session && session.id)
      return {
        id: `followup-history-${sessionId}`,
        kind: 'followup',
        title: this.getAgentFollowupWindowTitle(session, session && session.title),
        linkedSummaryId: 'summary',
        source: 'history',
        sessionId,
        readonly: false,
        createdAt: new Date().toISOString(),
        thread: this.createAgentFollowupThreadState(session || {}),
      }
    },
    openAgentSummaryHistoryTab(session = null) {
      if (!session || !asText(session.id)) return null
      const tabs = this.ensureAgentTabs(true)
      const tab = this.buildAgentHistorySummaryTab(session)
      const existing = cloneArray(tabs.summaryTabs).find((item) => item.sessionId === tab.sessionId || item.id === tab.id)
      if (existing) {
        tabs.activeTabId = existing.id
      } else {
        tabs.summaryTabs = [...cloneArray(tabs.summaryTabs), tab]
        tabs.activeTabId = tab.id
      }
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
      return tabs.activeTabId
    },
    openAgentFollowupHistoryTab(session = null) {
      if (!session || !asText(session.id)) return null
      const tabs = this.ensureAgentTabs(true)
      const tab = this.buildAgentHistoryFollowupTab(session)
      const existing = cloneArray(tabs.followupTabs).find((item) => item.sessionId === tab.sessionId || item.id === tab.id)
      if (existing) {
        tabs.activeTabId = existing.id
        this.applyAgentFollowupThreadToCurrentState(existing.thread)
      } else {
        tabs.followupTabs = [...cloneArray(tabs.followupTabs), tab]
        tabs.activeTabId = tab.id
        this.applyAgentFollowupThreadToCurrentState(tab.thread)
      }
      this.agentTabs = { ...tabs, summaryTabs: cloneArray(tabs.summaryTabs), siteSelectionTabs: cloneArray(tabs.siteSelectionTabs), followupTabs: cloneArray(tabs.followupTabs) }
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
      return tabs.activeTabId
    },
    async openAgentHistorySessionTab(sessionId = '') {
      const nextId = asText(sessionId)
      if (!nextId) return null
      let session = this.findAgentSession(nextId)
      if (!session) return null
      if (session.persisted && !session.snapshotLoaded) {
        this.agentSessionDetailLoadingId = nextId
        try {
          session = await this.loadAgentSessionDetail(nextId)
        } finally {
          if (this.agentSessionDetailLoadingId === nextId) {
            this.agentSessionDetailLoadingId = ''
          }
        }
      }
      if (!session) return null
      if (!this.isAgentHistorySessionInCurrentRange(session)) return null
      this.agentWorkspaceView = 'chat'
      if (this.isAgentSummaryHistorySession(session)) {
        return this.openAgentSummaryHistoryTab(session)
      }
      return this.openAgentFollowupHistoryTab(session)
    },
    closeAgentTopTab(tabId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      const targetId = asText(tabId)
      if (!targetId) return
      const tabs = this.ensureAgentTabs(true)
      const currentActiveId = asText(tabs.activeTabId)
      const orderedIds = [...cloneArray(tabs.summaryTabs).map((item) => item.id), ...cloneArray(tabs.siteSelectionTabs).map((item) => item.id), ...cloneArray(tabs.followupTabs).map((item) => item.id)]
      const targetIndex = Math.max(0, orderedIds.indexOf(targetId))
      tabs.summaryTabs = cloneArray(tabs.summaryTabs).filter((item) => item.id !== targetId)
      tabs.siteSelectionTabs = cloneArray(tabs.siteSelectionTabs).filter((item) => item.id !== targetId)
      tabs.followupTabs = cloneArray(tabs.followupTabs).filter((item) => item.id !== targetId)
      if (currentActiveId === targetId) {
        const nextIds = [...cloneArray(tabs.summaryTabs).map((item) => item.id), ...cloneArray(tabs.siteSelectionTabs).map((item) => item.id), ...cloneArray(tabs.followupTabs).map((item) => item.id)]
        const fallbackIndex = Math.max(0, Math.min(targetIndex - 1, nextIds.length - 1))
        tabs.activeTabId = nextIds[fallbackIndex] || ''
        const activeFollowup = tabs.followupTabs.find((item) => item.id === tabs.activeTabId)
        if (activeFollowup) this.applyAgentFollowupThreadToCurrentState(activeFollowup.thread)
      }
      this.agentTabs = tabs
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
    },
    closeAgentFollowupTab(tabId = '', event = null) {
      this.closeAgentTopTab(tabId, event)
    },
    openAgentFollowupFromSummary(prompt = '', title = '追问解释') {
      const nextPrompt = asText(prompt)
      const tabId = this.createAgentFollowupTab({
        title,
        seedPrompt: nextPrompt,
      })
      if (!tabId) return
      if (nextPrompt) this.agentInput = nextPrompt
    },
    ensureAgentFollowupTabForPrompt(prompt = '') {
      if (asText(this.getAgentActiveTopTab().kind) === 'followup') return
      this.openAgentFollowupFromSummary(prompt || this.agentInput || '', '追问解释')
    },
    shouldShowAgentComposer() {
      const activeTab = this.getAgentActiveTopTab()
      return asText(activeTab.kind) === 'followup'
    },
    buildAgentTabsUiState() {
      this.captureAgentActiveSummaryTabState()
      this.captureAgentActiveFollowupTabState()
      const tabs = this.ensureAgentTabs(true)
      const currentSummaryTab = cloneArray(tabs.summaryTabs).find((item) => asText(item.source) === 'current') || null
      return {
        summary_tab: {
          id: asText((currentSummaryTab || {}).id || (tabs.summaryTab || {}).id) || 'summary',
          frozen: true,
          created_at: asText((currentSummaryTab || {}).createdAt || (tabs.summaryTab || {}).createdAt) || new Date().toISOString(),
          content: cloneObject((currentSummaryTab || {}).content || (tabs.summaryTab || {}).content),
          evidence_refs: cloneArray((currentSummaryTab || {}).evidenceRefs || (tabs.summaryTab || {}).evidenceRefs),
        },
        summary_tabs: cloneArray(tabs.summaryTabs).map((item) => ({
          id: item.id,
          title: item.title || '区域总结',
          kind: 'summary',
          source: item.source || 'history',
          session_id: item.sessionId || '',
          readonly: Object.prototype.hasOwnProperty.call(item || {}, 'readonly') ? !!item.readonly : false,
          created_at: item.createdAt,
          panel_payloads: cloneObject(item.panelPayloads),
          content: cloneObject(item.content),
          evidence_refs: cloneArray(item.evidenceRefs),
        })),
        followup_tabs: cloneArray(tabs.followupTabs).map((item) => ({
          id: item.id,
          title: item.title,
          kind: 'followup',
          source: item.source || 'draft',
          session_id: item.sessionId || '',
          readonly: !!item.readonly,
          linked_summary_id: item.linkedSummaryId || 'summary',
          created_at: item.createdAt,
          thread: this.createAgentFollowupThreadState(item.thread),
        })),
        active_tab_id: asText(tabs.activeTabId),
        followup_limit: Number(tabs.followupLimit || 6) || 6,
        next_followup_number: Number(tabs.nextFollowupNumber || 1) || 1,
      }
    },
    restoreAgentTabsFromSession(session = null) {
      const panelPayloads = cloneObject((session && session.panelPayloads) || this.agentPanelPayloads)
      const uiState = panelPayloads.agent_tabs && typeof panelPayloads.agent_tabs === 'object'
        ? panelPayloads.agent_tabs
        : {}
      const defaultTabs = this.createDefaultAgentTabs()
      const summaryTab = {
        id: asText((uiState.summary_tab || {}).id) || 'summary',
        kind: 'summary',
        frozen: true,
        source: 'current',
        sessionId: '',
        title: '区域总结',
        createdAt: asText((uiState.summary_tab || {}).created_at) || new Date().toISOString(),
        content: cloneObject((uiState.summary_tab || {}).content),
        evidenceRefs: cloneArray((uiState.summary_tab || {}).evidence_refs),
      }
      const summaryTabs = cloneArray(uiState.summary_tabs).map((item) => ({
        id: asText(item && item.id),
        kind: 'summary',
        title: asText(item && item.title) || '区域总结',
        source: asText(item && item.source) || 'history',
        sessionId: asText((item && (item.session_id || item.sessionId)) || ''),
        readonly: Object.prototype.hasOwnProperty.call(item || {}, 'readonly') ? !!item.readonly : false,
        createdAt: asText(item && item.created_at) || new Date().toISOString(),
        panelPayloads: cloneObject(item && (item.panel_payloads || item.panelPayloads)),
        content: cloneObject(item && item.content),
        evidenceRefs: cloneArray(item && item.evidence_refs),
      })).filter((item) => item.id)
      if (summaryTab.id && !summaryTabs.some((item) => asText(item.source) === 'current')) {
        const legacyPack = cloneObject(summaryTab.content)
        if (this.hasAgentSummaryPack(legacyPack) || Object.keys(legacyPack).length || asText(uiState.active_tab_id) === 'summary') {
          summaryTabs.unshift({
            id: 'summary-current',
            kind: 'summary',
            title: this.getAgentSummaryWindowTitle({ summary_pack: legacyPack }, '区域总结'),
            source: 'current',
            sessionId: '',
            readonly: false,
            createdAt: summaryTab.createdAt,
            panelPayloads: cloneObject(panelPayloads),
            content: legacyPack,
            evidenceRefs: cloneArray(summaryTab.evidenceRefs),
          })
        }
      }
      const followupTabs = cloneArray(uiState.followup_tabs).map((item) => ({
        id: asText(item && item.id),
        kind: 'followup',
        title: this.getAgentFollowupWindowTitle(item, item && item.title),
        linkedSummaryId: asText(item && item.linked_summary_id) || 'summary',
        source: asText(item && item.source) || 'draft',
        sessionId: asText((item && (item.session_id || item.sessionId)) || ''),
        readonly: !!(item && item.readonly && asText(item && item.source) !== 'history'),
        createdAt: asText(item && item.created_at) || new Date().toISOString(),
        thread: this.createAgentFollowupThreadState(item && item.thread),
      })).filter((item) => item.id)
      const activeId = asText(uiState.active_tab_id)
      this.agentTabs = {
        summaryTab: summaryTab.id ? summaryTab : defaultTabs.summaryTab,
        summaryTabs,
        siteSelectionTabs: [],
        followupTabs,
        activeTabId: activeId || (summaryTabs[0] ? summaryTabs[0].id : (followupTabs[0] ? followupTabs[0].id : '')),
        followupLimit: Number(uiState.followup_limit || 6) || 6,
        nextFollowupNumber: Number(uiState.next_followup_number || (followupTabs.length + 1) || 1) || 1,
      }
      this.ensureAgentTabs(true)
      if (!this.isAgentSummaryTabActive()) {
        const activeTab = this.getAgentActiveFollowupTab()
        if (activeTab) {
          this.applyAgentFollowupThreadToCurrentState(activeTab.thread)
        }
      } else if (this.isCurrentAgentSummaryTabActive()) {
        const activeSummaryTab = cloneArray(this.agentTabs.summaryTabs).find((item) => item.id === this.agentTabs.activeTabId)
        if (activeSummaryTab && activeSummaryTab.panelPayloads && typeof activeSummaryTab.panelPayloads === 'object') {
          this.agentPanelPayloads = cloneObject(activeSummaryTab.panelPayloads)
        }
        this.syncAgentSummaryStateFromPanelPayload(this.agentPanelPayloads)
      }
    },
    queueAgentPrompt(prompt = '') {
      const text = String(prompt || '').trim()
      this.openAgentPanel()
      this.agentWorkspaceView = 'chat'
      this.ensureAgentFollowupTabForPrompt(text)
      this.agentInput = text
      this.syncCurrentAgentSession()
    },
    getAgentToolLabel(value = '') {
      const mapping = {
        information: '信息',
        action: '执行',
        processing: '处理',
        foundation: '基础工具',
        capability: '能力工具',
        scenario: '场景工具',
        poi: 'POI',
        grid: '网格/H3',
        population: '人口',
        nightlight: '夜光',
        road: '路网',
        commerce: '商业',
        general: '通用',
        fetch: '获取',
        transform: '清洗/转换',
        analyze: '分析',
        interpret: '解释',
        decide: '决策',
        none: '未分类',
        area_character: '区域特征',
        site_selection: '选址分析',
        vitality: '活力评估',
        tod: 'TOD/站点规划',
        livability: '宜居评估',
        facility_gap: '设施缺口',
        renewal_priority: '更新优先级',
        primary: '主要',
        secondary: '次要',
        hidden: '隐含',
        safe: '低',
        normal: '中',
        expensive: '高',
        guarded: '需确认',
      }
      const key = asText(value)
      return mapping[key] || key || '-'
    },
    getAgentToolSchemaFields(schema = {}) {
      const properties = schema && typeof schema === 'object' && schema.properties && typeof schema.properties === 'object'
        ? schema.properties
        : {}
      return Object.keys(properties)
    },
    getAgentToolDetail() {
      const targetName = asText(this.agentActiveToolDetailName)
      if (!targetName) return null
      return Array.isArray(this.agentTools)
        ? this.agentTools.find((tool) => asText(tool && tool.name) === targetName) || null
        : null
    },
    getGroupedAgentTools() {
      const tierOrder = ['foundation', 'capability', 'scenario']
      const groups = []
      tierOrder.forEach((tierKey) => {
        const tools = cloneArray(this.agentTools).filter((item) => asText(item && item.uiTier) === tierKey)
        if (!tools.length) return
        const subgroupMap = new Map()
        tools.forEach((tool) => {
          const subgroupKey = tierKey === 'scenario'
            ? (asText(tool.sceneType) || 'general')
            : (asText(tool.dataDomain) || 'general')
          if (!subgroupMap.has(subgroupKey)) subgroupMap.set(subgroupKey, [])
          subgroupMap.get(subgroupKey).push(tool)
        })
        groups.push({
          key: tierKey,
          label: this.getAgentToolLabel(tierKey),
          description: tierKey === 'foundation'
            ? '底层数据与计算能力，主要用于补证和兜底。'
            : tierKey === 'capability'
              ? '把获取、分析、解释、决策固化为统一能力接口。'
              : '面向真实任务场景，供 Planner 优先选择。',
          subgroups: Array.from(subgroupMap.entries()).map(([subgroupKey, subgroupTools]) => ({
            key: subgroupKey,
            label: this.getAgentToolLabel(subgroupKey),
            tools: subgroupTools.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
          })),
        })
      })
      return groups
    },
    async loadAgentTools(force = false) {
      if (this.agentToolsLoading) return this.agentTools
      if (this.agentToolsLoaded && !force) return this.agentTools

      this.agentToolsLoading = true
      this.agentToolsError = ''
      try {
        const res = await fetch('/api/v1/analysis/agent/tools', {
          cache: force ? 'no-store' : 'default',
        })
        if (!res.ok) {
          throw new Error(`/api/v1/analysis/agent/tools 请求失败(${res.status})`)
        }
        const data = await res.json()
        this.agentTools = Array.isArray(data)
          ? data.map((item) => normalizeAgentToolSummary(item)).filter((item) => item.name)
          : []
        this.agentToolsLoaded = true
        return this.agentTools
      } catch (err) {
        this.agentToolsError = err && err.message ? err.message : String(err)
        throw err
      } finally {
        this.agentToolsLoading = false
      }
    },
    openAgentToolsPanel() {
      if (typeof this.selectStep3Panel === 'function') {
        this.selectStep3Panel('agent')
      } else {
        this.activeStep3Panel = 'agent'
        if (typeof this.ensureAgentPanelReady === 'function') {
          this.ensureAgentPanelReady()
        }
      }
      this.agentWorkspaceView = 'tools'
      this.closeAgentSessionMenu()
      if (!this.agentToolsLoaded && !this.agentToolsLoading) {
        this.loadAgentTools(false).catch((err) => {
          console.warn('Agent tools load failed', err)
        })
      }
    },
    backToAgentChat() {
      this.agentWorkspaceView = 'chat'
      this.closeAgentToolDetail()
    },
    openAgentToolDetail(tool = null, event = null) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation()
      }
      const toolName = asText(tool && tool.name)
      if (!toolName) return
      this.agentActiveToolDetailName = toolName
      this.agentToolDetailDialogOpen = true
    },
    closeAgentToolDetail() {
      this.agentToolDetailDialogOpen = false
      this.agentActiveToolDetailName = ''
    },
    agentCanSubmit() {
      return !this.agentSessionHydrating && !!String(this.agentInput || '').trim()
    },
    getAgentCurrentTurnMessageBoundary() {
      const messages = Array.isArray(this.agentMessages) ? this.agentMessages : []
      if (!this.agentShouldRenderThinkingBlock() || !messages.length) return -1
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (asText(messages[index] && messages[index].role) === 'user') {
          return index
        }
      }
      return -1
    },
    getAgentMessagesBeforeThinking() {
      const messages = cloneArray(this.agentMessages)
      const boundaryIndex = this.getAgentCurrentTurnMessageBoundary()
      if (boundaryIndex < 0) return messages
      return messages.slice(0, boundaryIndex + 1)
    },
    getAgentMessagesAfterThinking() {
      const messages = cloneArray(this.agentMessages)
      const boundaryIndex = this.getAgentCurrentTurnMessageBoundary()
      if (boundaryIndex < 0 || boundaryIndex >= messages.length - 1) return []
      return messages.slice(boundaryIndex + 1).filter((message) => asText(message && message.role) === 'assistant')
    },
    getAgentStatusLabel() {
      if (this.agentSessionHydrating) {
        return '加载中'
      }
      const mapping = {
        idle: '待执行',
        running: '执行中',
        answered: '已完成',
        requires_clarification: '需补充',
        requires_risk_confirmation: '待确认',
        failed: '失败',
      }
      return mapping[String(this.agentStatus || 'idle')] || String(this.agentStatus || '待执行')
    },
    agentShouldRenderThinkingBlock() {
      return !!(
        this.agentLoading
        || (Array.isArray(this.agentThinkingTimeline) && this.agentThinkingTimeline.length)
        || (Array.isArray(this.agentReasoningBlocks) && this.agentReasoningBlocks.length)
        || hasAgentPlanContent(this.agentPlan)
        || hasAgentExecutionTraceContent(this.agentExecutionTrace)
        || this.agentPendingTaskConfirmation
      )
    },
    getAgentThinkingStatusLabel() {
      if (this.agentLoading) return '思考中...'
      if (this.agentStreamState === 'failed') return '思考失败'
      if (this.agentThinkingTimeline.length) return '已思考'
      if (this.getAgentVisibleReasoningBlocks().length) return '已思考'
      if (this.agentExecutionTrace.length || hasAgentPlanContent(this.agentPlan)) return '已思考'
      return '处理中'
    },
    getAgentVisibleProcessSteps() {
      const steps = cloneArray(this.agentThinkingTimeline)
        .map((item) => ({
          id: asText(item && item.id),
          phase: asText(item && item.phase),
          title: asText(item && item.title) || '处理中',
          detail: asText(item && item.detail),
          items: cloneArray(item && item.items).map((entry) => asText(entry)).filter(Boolean),
          state: asText(item && item.state) || 'pending',
        }))
        .filter((item) => item.id !== 'stream-connect')
      const hasBackendStep = steps.some((item) => item.id && !item.id.startsWith('frontend-'))
      if (!hasBackendStep) return steps
      return steps.filter((item) => !item.id.startsWith('frontend-wait-'))
    },
    getAgentProcessRoleGroups() {
      const roleMeta = {
        connecting: {
          title: '\u8bf7\u6c42\u63d0\u4ea4',
          description: '\u628a\u95ee\u9898\u53d1\u9001\u7ed9 Agent\uff0c\u5e76\u7b49\u5f85\u540e\u7aef\u8fd4\u56de\u771f\u5b9e\u8fc7\u7a0b\u3002',
        },
        gating: {
          title: '\u95e8\u536b\u5224\u65ad',
          description: '\u5224\u65ad\u95ee\u9898\u662f\u5426\u6e05\u6670\u3001\u5f53\u524d\u8303\u56f4\u662f\u5426\u5177\u5907\u76f4\u63a5\u5206\u6790\u6761\u4ef6\u3002',
        },
        clarifying: {
          title: '\u8ffd\u95ee\u751f\u6210',
          description: '\u6574\u7406\u9700\u8981\u7528\u6237\u8865\u5145\u7684\u5173\u952e\u4fe1\u606f\u3002',
        },
        context_ready: {
          title: '\u4e0a\u4e0b\u6587\u6574\u7406',
          description: '\u6c47\u603b\u5f53\u524d\u8303\u56f4\u3001\u9762\u677f\u72b6\u6001\u548c\u53ef\u590d\u7528\u5206\u6790\u7ed3\u679c\u3002',
        },
        planning: {
          title: 'Planner',
          description: '\u89c4\u5212\u672c\u8f6e\u8981\u8c03\u7528\u7684\u5de5\u5177\u548c\u8bc1\u636e\u94fe\u3002',
        },
        replanning: {
          title: 'Planner \u590d\u76d8',
          description: '\u6839\u636e\u73b0\u573a\u53d8\u91cf\uff0c\u8c03\u6574\u8def\u7ebf\u6216\u66f4\u6362\u6267\u884c\u6b65\u9aa4\u3002',
        },
        tool_confirmation: {
          title: '\u5de5\u5177\u786e\u8ba4',
          description: '\u7b49\u5f85\u9700\u8981\u7528\u6237\u786e\u8ba4\u7684 Agent \u8c03\u7528\u3002\u786e\u8ba4\u540e\u53ef\u7ee7\u7eed\u6267\u884c\u3002',
        },
        executing: {
          title: '\u5de5\u5177\u6267\u884c',
          description: '\u6267\u884c\u5206\u6790\u5de5\u5177\u5e76\u6536\u96c6\u8bc1\u636e\u3002\u8fc7\u7a0b\u4fe1\u606f\u4f1a\u663e\u793a\u5728\u4e0b\u65b9\u6b65\u9aa4\u4e2d\u3002',
        },
        auditing: {
          title: '\u6821\u9a8c',
          description: '\u6574\u7406\u6267\u884c\u7ed3\u679c\uff0c\u505a\u8d28\u91cf\u548c\u98ce\u9669\u590d\u6838\u3002',
        },
        synthesizing: {
          title: '\u7ed3\u679c\u7ec4\u88c5',
          description: '\u628a\u6536\u96c6\u5230\u7684\u8bc1\u636e\u7ec4\u7ec7\u4e3a\u53ef\u8bfb\u7ed3\u8bba\uff0c\u5e76\u4fdd\u7559\u5173\u952e\u7406\u7531\u3002',
        },
        answering: {
          title: '\u8f93\u51fa\u56de\u7b54',
          description: '\u56de\u7b54\u751f\u6210\u4e2d\uff0c\u7ec4\u7ec7\u7ed3\u6784\u5316\u5185\u5bb9\u3002',
        },
        answered: {
          title: '\u5df2\u5b8c\u6210',
          description: '\u5df2\u5b8c\u6210\u8f93\u51fa\u56de\u7b54\u3002',
        },
        failed: {
          title: '\u5931\u8d25\u5904\u7406',
          description: '\u8bb0\u5f55\u6267\u884c\u5931\u8d25\u539f\u56e0\uff0c\u53ef\u5728\u6b64\u57fa\u7840\u4e0a\u91cd\u8bd5\u3002',
        },
        requires_clarification: {
          title: '\u7b49\u5f85\u8865\u5145',
          description: '\u7b49\u5f85\u7528\u6237\u8865\u5145\u4fe1\u606f\u540e\u7ee7\u7eed\u3002',
        },
      }
      const phaseOrder = [
        'connecting',
        'gating',
        'clarifying',
        'context_ready',
        'planning',
        'replanning',
        'tool_confirmation',
        'executing',
        'auditing',
        'synthesizing',
        'answering',
        'answered',
        'requires_clarification',
        'failed',
      ]
      const groupsByPhase = new Map()
      const ensureGroup = (phase = '', fallbackStep = null) => {
        const nextPhase = asText(phase) || 'status'
        if (!groupsByPhase.has(nextPhase)) {
          const meta = roleMeta[nextPhase] || {
            title: asText(fallbackStep && fallbackStep.title) || '\u6d41\u7a0b\u6b65\u9aa4',
            description: 'Agent \u672a\u63d0\u4f9b\u8be5\u9636\u6bb5\u63cf\u8ff0\uff0c\u5c06\u7ee7\u7eed\u5c55\u793a\u3002',
          }
          groupsByPhase.set(nextPhase, {
            key: nextPhase,
            title: meta.title,
            description: meta.description,
            state: 'pending',
            steps: [],
            planChecklist: null,
            toolCallItems: [],
            taskConfirmation: null,
            progressLabel: '',
          })
        }
        return groupsByPhase.get(nextPhase)
      }
      this.getAgentVisibleProcessSteps().forEach((step) => {
        const phase = asText(step && step.phase) || 'status'
        const group = ensureGroup(phase, step)
        group.steps.push(step)
      })
      const planChecklist = this.getAgentPlanChecklist()
      if (planChecklist.visible) {
        const planGroupKey = planChecklist.followupApplied ? 'replanning' : 'planning'
        const planGroup = ensureGroup(planGroupKey)
        planGroup.planChecklist = planChecklist
        planGroup.progressLabel = planChecklist.progressLabel
      }
      const toolCallItems = this.getAgentToolCallItems()
      if (toolCallItems.length) {
        const toolGroup = ensureGroup('executing')
        toolGroup.toolCallItems = toolCallItems
        toolGroup.progressLabel = `${toolCallItems.length} \u6b21`
      }
      const taskConfirmation = this.getAgentTaskConfirmation()
      if (taskConfirmation) {
        const taskGroup = ensureGroup('tool_confirmation')
        taskGroup.taskConfirmation = taskConfirmation
        taskGroup.progressLabel = this.getAgentTaskConfirmationStatusLabel(taskConfirmation.status)
      }
      const stateRank = {
        failed: 4,
        active: 3,
        blocked: 3,
        pending: 2,
        skipped: 1,
        completed: 0,
      }
      const sortGroup = (left, right) => {
        const leftIndex = phaseOrder.indexOf(left.key)
        const rightIndex = phaseOrder.indexOf(right.key)
        const safeLeft = leftIndex >= 0 ? leftIndex : phaseOrder.length
        const safeRight = rightIndex >= 0 ? rightIndex : phaseOrder.length
        if (safeLeft !== safeRight) return safeLeft - safeRight
        return left.key.localeCompare(right.key, 'zh-Hans-CN')
      }
      return Array.from(groupsByPhase.values())
        .map((group) => {
          const itemStates = [
            ...group.steps.map((step) => asText(step && step.state) || 'pending'),
            ...((group.planChecklist && group.planChecklist.visible)
              ? group.planChecklist.groups.flatMap((planGroup) => planGroup.items.map((item) => asText(item && item.status) || 'pending'))
              : []),
            ...cloneArray(group.toolCallItems).map((item) => {
              const status = asText(item && item.status)
              if (status === 'success') return 'completed'
              if (status === 'failed') return 'failed'
              if (status === 'blocked') return 'blocked'
              if (status === 'skipped') return 'skipped'
              return 'active'
            }),
            ...((group.taskConfirmation)
              ? [this.getAgentTaskConfirmationProcessState(group.taskConfirmation.status)]
              : []),
          ]
          const state = itemStates.reduce((current, nextState) => {
            const normalizedState = asText(nextState) || 'pending'
            return (stateRank[normalizedState] || 0) > (stateRank[current] || 0) ? normalizedState : current
          }, itemStates.length ? 'completed' : 'pending')
          const activeStep = group.steps.find((step) => asText(step && step.state) === 'active')
          const lastStep = group.steps[group.steps.length - 1]
          const summary = asText(group.taskConfirmation && group.taskConfirmation.description)
            || asText((activeStep || lastStep || {}).detail)
            || group.description
          const countParts = []
          if (group.steps.length) countParts.push(`${group.steps.length} \u6b65`)
          if (group.progressLabel) countParts.push(group.progressLabel)
          return {
            ...group,
            state,
            summary,
            countLabel: countParts.join(' \u00b7 ') || group.progressLabel || '',
            steps: group.steps,
          }
        })
        .sort(sortGroup)
    },
    getAgentVisibleReasoningBlocks() {
      return cloneArray(this.agentReasoningBlocks)
        .map((item) => ({
          id: asText(item && item.id) || 'agent-reasoning',
          phase: asText(item && item.phase),
          title: asText(item && item.title) || '推理过程',
          content: String((item && item.content) || ''),
          state: asText(item && item.state) || 'active',
        }))
        .filter((item) => item.content || item.state === 'active')
    },
    toggleAgentThinkingExpanded() {
      this.agentThinkingExpanded = !this.agentThinkingExpanded
    },
    toggleAgentPlanExpanded() {
      this.agentPlanExpanded = !this.agentPlanExpanded
    },
    toggleAgentTraceExpanded() {
      this.agentTraceExpanded = !this.agentTraceExpanded
    },
    getAgentPlanChecklist() {
      return buildAgentPlanChecklist(this.agentPlan, this.agentExecutionTrace, {
        isLoading: this.agentLoading,
        stage: this.agentStage,
        diagnostics: (this.findAgentSession(this.activeAgentSessionId) || {}).diagnostics || {},
      })
    },
    getAgentPlanSummary() {
      return this.getAgentPlanChecklist().summary
    },
    getAgentPlanProgressLabel() {
      return this.getAgentPlanChecklist().progressLabel
    },
    getAgentToolCallItems() {
      return buildAgentToolCallItems(this.agentExecutionTrace)
    },
    getAgentToolCallStatusLabel(status = '') {
      const mapping = {
        start: '执行中',
        success: '成功',
        failed: '失败',
        blocked: '等待确认',
        skipped: '已跳过',
      }
      return mapping[asText(status)] || '执行中'
    },
    getAgentTaskConfirmation() {
      return cloneAnalysisTaskConfirmation(this.agentPendingTaskConfirmation)
    },
    getAgentTaskConfirmationStatusLabel(status = '') {
      const mapping = {
        ready: '待确认',
        reuse_available: '可复用',
        running: '运行中',
        blocked: '已阻塞',
        executing: '执行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消',
      }
      return mapping[asText(status)] || '待确认'
    },
    getAgentTaskConfirmationProcessState(status = '') {
      const key = asText(status)
      if (key === 'completed') return 'completed'
      if (key === 'failed') return 'failed'
      if (key === 'blocked') return 'blocked'
      if (key === 'cancelled') return 'skipped'
      if (key === 'running' || key === 'executing') return 'active'
      return 'blocked'
    },
    setAgentTaskConfirmation(nextConfirmation = null, sessionId = '') {
      const normalized = cloneAnalysisTaskConfirmation(nextConfirmation)
      this.agentPendingTaskConfirmation = normalized
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!targetSessionId) return normalized
      this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
        ...session,
        pendingTaskConfirmation: normalized,
      }))
      return normalized
    },
    refreshAgentTaskConfirmation(seed = {}) {
      const current = this.getAgentTaskConfirmation()
      if (!current) return null
      const next = buildAnalysisTaskConfirmation(this, current.taskKey, {
        ...current,
        ...seed,
        updatedAt: new Date().toISOString(),
      })
      return this.setAgentTaskConfirmation(next)
    },
    onAgentTaskAdjustClick(taskConfirmation = null) {
      const current = cloneAnalysisTaskConfirmation(taskConfirmation || this.agentPendingTaskConfirmation)
      if (!current) return
      focusAnalysisTaskPanel(this, current.taskKey)
    },
    onAgentTaskCancelClick(taskConfirmation = null) {
      const current = cloneAnalysisTaskConfirmation(taskConfirmation || this.agentPendingTaskConfirmation)
      if (!current) return
      this.setAgentTaskConfirmation({
        ...current,
        status: 'cancelled',
        statusLabel: '已取消',
        updatedAt: new Date().toISOString(),
      })
    },
    async onAgentTaskReuseClick(taskConfirmation = null) {
      const current = cloneAnalysisTaskConfirmation(taskConfirmation || this.agentPendingTaskConfirmation)
      if (!current || this.agentLoading || this.agentSessionHydrating) return
      focusAnalysisTaskPanel(this, current.taskKey)
      this.setAgentTaskConfirmation({
        ...current,
        status: 'completed',
        statusLabel: '\u5df2\u590d\u7528',
        updatedAt: new Date().toISOString(),
      })
      await this.submitAgentTurn({
        prompt: `已复用当前${current.label}结果，请基于最新左侧计算结果继续回答。`,
      })
    },
    async onAgentTaskStartClick(taskConfirmation = null) {
      const current = cloneAnalysisTaskConfirmation(taskConfirmation || this.agentPendingTaskConfirmation)
      if (!current || this.agentLoading || this.agentSessionHydrating) return
      const checked = buildAnalysisTaskConfirmation(this, current.taskKey, current)
      this.setAgentTaskConfirmation(checked)
      if (!checked || !checked.canStart || ['blocked', 'running'].includes(asText(checked.status))) {
        focusAnalysisTaskPanel(this, current.taskKey)
        return
      }
      this.setAgentTaskConfirmation({
        ...checked,
        status: 'executing',
        statusLabel: '执行中',
        updatedAt: new Date().toISOString(),
      })
      try {
        await runAnalysisTask(this, current.taskKey)
        this.setAgentTaskConfirmation({
          ...checked,
          status: 'completed',
          statusLabel: '已完成',
          updatedAt: new Date().toISOString(),
        })
        await this.submitAgentTurn({
          prompt: `${checked.label}已完成，请基于最新左侧计算结果继续回答。`,
        })
      } catch (err) {
        this.setAgentTaskConfirmation({
          ...checked,
          status: 'failed',
          statusLabel: '执行失败',
          error: err && err.message ? err.message : String(err),
          updatedAt: new Date().toISOString(),
        })
      }
    },
    getAgentPlanStatusLabel(status = '') {
      const mapping = {
        completed: '已完成',
        active: '执行中',
        pending: '待执行',
        failed: '失败',
        blocked: '等待确认',
        skipped: '已跳过',
      }
      return mapping[asText(status)] || '待执行'
    },
    getAgentPlanStatusSymbol(status = '') {
      const mapping = {
        completed: '✓',
        active: '•',
        pending: '•',
        failed: '×',
        blocked: '!',
        skipped: '-',
      }
      return mapping[asText(status)] || '•'
    },
    getAgentPanelPreloadNotes() {
      const runState = this.getAgentRunState(this.activeAgentSessionId)
      if (runState) {
        return normalizeAgentPanelPreloadNotes(runState.panelPreloadNotes)
      }
      const activeSession = this.findAgentSession(this.activeAgentSessionId)
      if (activeSession) {
        return normalizeAgentPanelPreloadNotes(activeSession.panelPreloadNotes)
      }
      return normalizeAgentPanelPreloadNotes(this.agentPanelPreloadNotes)
    },
    getAgentActivePanelPayloads(sessionId = '') {
      const targetSession = this.findAgentSession(sessionId || this.activeAgentSessionId)
      if (targetSession) {
        return cloneObject(targetSession.panelPayloads)
      }
      return cloneObject(this.agentPanelPayloads)
    },
    hasAgentStructuredOutput() {
      return !!(
        asText(this.agentDecision && this.agentDecision.summary)
        || (Array.isArray(this.agentSupport) && this.agentSupport.length)
        || (Array.isArray(this.agentActions) && this.agentActions.length)
        || (Array.isArray(this.agentCounterpoints) && this.agentCounterpoints.length)
        || (Array.isArray(this.agentBoundary) && this.agentBoundary.length)
      )
    },
    getAgentDecisionStrengthLabel(strength = '') {
      const key = asText(strength || (this.agentDecision && this.agentDecision.strength) || 'weak')
      return {
        strong: '强判断',
        moderate: '中等判断',
        weak: '方向性判断',
      }[key] || '方向性判断'
    },
    getAgentDecisionModeLabel(mode = '') {
      const key = asText(mode || (this.agentDecision && this.agentDecision.mode) || 'judgment')
      return {
        cognition: '认知输出',
        judgment: '判断输出',
        action: '行动输出',
      }[key] || '判断输出'
    },
    getAgentStructuredItemKey(item = null, fallbackIndex = 0) {
      if (item && typeof item === 'object') {
        return asText(item.key || item.metric || item.title || item.prompt) || `agent-structured-item-${fallbackIndex}`
      }
      return `agent-structured-item-${fallbackIndex}`
    },
    hasAgentActionPrompt(item = null) {
      return !!asText(item && item.prompt)
    },
    getAgentClarificationOptions(limit = 3) {
      const max = Math.max(0, Number(limit || 0))
      return cloneArray(this.agentClarificationOptions)
        .map((item) => asText(item))
        .filter(Boolean)
        .slice(0, max)
    },
    hasAgentClarificationOptions() {
      return this.getAgentClarificationOptions().length > 0
    },
    getAgentClarificationInputIndexLabel() {
      return this.hasAgentClarificationOptions() ? '4.' : ''
    },
    canSubmitAgentClarificationDraft() {
      return !this.agentLoading
        && !this.agentSessionHydrating
        && !this.agentClarificationSubmitting
        && !!String(this.agentClarificationDraft || '').trim()
    },
    onAgentClarificationOptionClick(option = '') {
      const prompt = asText(option)
      if (!prompt || this.agentLoading || this.agentSessionHydrating || this.agentClarificationSubmitting) return
      this.agentClarificationSubmitting = true
      this.submitAgentTurn({ prompt })
    },
    onAgentClarificationDraftSubmit() {
      const prompt = String(this.agentClarificationDraft || '').trim()
      if (!prompt || this.agentLoading || this.agentSessionHydrating || this.agentClarificationSubmitting) return
      this.agentClarificationSubmitting = true
      this.submitAgentTurn({ prompt })
    },
    onAgentActionPromptClick(item = null) {
      const prompt = asText(item && item.prompt)
      if (!prompt) return
      this.queueAgentPrompt(prompt)
    },
    isAgentCardActionItem(item = null) {
      return !!(item && typeof item === 'object' && asText(item.type) === 'h3_candidate' && asText(item.h3_id))
    },
    getAgentCardItemText(item = null) {
      if (item && typeof item === 'object') {
        return asText(item.text || item.label || item.title || '')
      }
      return asText(item)
    },
    getAgentCardItemKey(item = null, fallbackIndex = 0) {
      if (item && typeof item === 'object') {
        return asText(item.h3_id || item.key || item.label) || `agent-card-item-${fallbackIndex}`
      }
      return asText(item) || `agent-card-item-${fallbackIndex}`
    },
    async onAgentCardItemClick(item = null) {
      if (!this.isAgentCardActionItem(item)) return
      const h3Id = asText(item.h3_id)
      if (!h3Id) return
      this.sidebarView = 'wizard'
      this.step = 2
      this.lastNonAgentStep3Panel = 'poi'
      if (typeof this.selectStep3Panel === 'function') {
        this.selectStep3Panel('poi')
      } else {
        this.activeStep3Panel = 'poi'
        this.poiSubTab = 'grid'
      }
      this.poiSubTab = 'grid'
      if (typeof this.$nextTick === 'function') {
        await this.$nextTick()
      }
      const activePanelPayloads = this.getAgentActivePanelPayloads()
      const ready = typeof this.ensureH3ReadyForAgentTarget === 'function'
        ? await this.ensureH3ReadyForAgentTarget(activePanelPayloads, {
          allowCompute: true,
          targetCategory: asText((activePanelPayloads.h3_result || {}).ui && (activePanelPayloads.h3_result || {}).ui.target_category),
        })
        : false
      if (ready && typeof this.focusGridByH3Id === 'function') {
        this.focusGridByH3Id(h3Id)
      }
    },
    closeAgentSessionMenu() {
      this.agentSessionMenuId = ''
    },
    toggleAgentSessionMenu(sessionId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation()
      }
      const nextId = asText(sessionId)
      this.agentSessionMenuId = this.agentSessionMenuId === nextId ? '' : nextId
    },
    openAgentRenameDialog(sessionId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation()
      }
      const session = this.findAgentSession(sessionId)
      if (!session) return
      this.agentRenameDialogOpen = true
      this.agentRenameSessionId = session.id
      this.agentRenameInput = this.getAgentSessionTitle(session)
      this.closeAgentSessionMenu()
    },
    closeAgentRenameDialog() {
      this.agentRenameDialogOpen = false
      this.agentRenameSessionId = ''
      this.agentRenameInput = ''
    },
    async submitAgentRename() {
      const sessionId = asText(this.agentRenameSessionId)
      const title = clampText(this.agentRenameInput, 60)
      if (!sessionId || !title) {
        window.alert('名称不能为空')
        return
      }
      const session = this.findAgentSession(sessionId)
      if (!session) return
      let nextSession = null
      if (session.persisted) {
        nextSession = await this.patchAgentSessionMetadata(sessionId, { title })
      } else {
        nextSession = createAgentSessionRecord({
          ...session,
          title,
          titleSource: 'user',
          updatedAt: new Date().toISOString(),
        })
        const filtered = this.agentSessions.filter((item) => asText(item && item.id) !== sessionId)
        this.updateAgentSessions([nextSession, ...filtered], { loaded: this.agentSessionsLoaded })
      }
      if (asText(this.activeAgentSessionId) === sessionId && nextSession) {
        this.applyAgentSessionSnapshot(nextSession)
      }
      this.closeAgentRenameDialog()
    },
    async toggleAgentSessionPinned(sessionId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation()
      }
      const session = this.findAgentSession(sessionId)
      if (!session) return
      const nextPinned = !session.isPinned
      if (session.persisted) {
        const nextSession = await this.patchAgentSessionMetadata(session.id, { is_pinned: nextPinned })
        if (asText(this.activeAgentSessionId) === session.id) {
          this.applyAgentSessionSnapshot(nextSession)
        }
      } else {
        const nextSession = createAgentSessionRecord({
          ...session,
          isPinned: nextPinned,
          pinnedAt: nextPinned ? new Date().toISOString() : '',
          updatedAt: new Date().toISOString(),
        })
        const filtered = this.agentSessions.filter((item) => asText(item && item.id) !== session.id)
        this.updateAgentSessions([nextSession, ...filtered], { loaded: this.agentSessionsLoaded })
        if (asText(this.activeAgentSessionId) === session.id) {
          this.applyAgentSessionSnapshot(nextSession)
        }
      }
      this.closeAgentSessionMenu()
    },
    async activateFallbackAgentSession(remainingSessions = []) {
      const rows = sortAgentSessions(remainingSessions)
      const visibleRows = rows.filter((item) => !!(item && item.persisted))
      if (!visibleRows.length) {
        const session = this.createAgentSession()
        this.updateAgentSessions([...rows.filter((item) => !!(item && !item.persisted)), session], { loaded: this.agentSessionsLoaded })
        this.applyAgentSessionSnapshot(session)
        return
      }
      const nextSession = visibleRows[0]
      if (nextSession.persisted && !nextSession.snapshotLoaded) {
        await this.activateAgentSession(nextSession.id)
        return
      }
      this.applyAgentSessionSnapshot(nextSession)
    },
    async deleteAgentSession(sessionId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation()
      }
      this.syncCurrentAgentSession()
      const session = this.findAgentSession(sessionId)
      if (!session) return
      if (!window.confirm('确定要删除这条对话吗？')) return

      const previousSessions = this.agentSessions
        .map((item) => cloneAgentSessionRecord(item))
        .filter((item) => !!item)
      const previousActiveSessionId = asText(this.activeAgentSessionId)
      const previousConversationId = asText(this.agentConversationId)
      const previousAgentSessionDetailLoadingId = asText(this.agentSessionDetailLoadingId)
      const previousAgentSessionDetailRequestToken = Number(this.agentSessionDetailRequestToken || 0)
      const previousAgentSessionHydrating = !!this.agentSessionHydrating
      const previousActiveSession = cloneAgentSessionRecord(
        previousActiveSessionId ? this.findAgentSession(previousActiveSessionId) : null,
      )

      this.closeAgentSessionMenu()
      const remaining = this.agentSessions.filter((item) => asText(item && item.id) !== session.id)
      this.updateAgentSessions(remaining, { loaded: this.agentSessionsLoaded })
      if (asText(this.activeAgentSessionId) === session.id) {
        await this.activateFallbackAgentSession(remaining)
      }

      if (session.persisted) {
        try {
          const res = await fetch(`/api/v1/analysis/agent/sessions/${encodeURIComponent(session.id)}`, {
            method: 'DELETE',
          })
          if (!res.ok) {
            throw new Error(`/api/v1/analysis/agent/sessions/${session.id} DELETE 失败(${res.status})`)
          }
        } catch (err) {
          this.updateAgentSessions(previousSessions, { loaded: this.agentSessionsLoaded })
          this.agentConversationId = previousConversationId
          this.agentSessionDetailLoadingId = previousAgentSessionDetailLoadingId
          this.agentSessionDetailRequestToken = previousAgentSessionDetailRequestToken
          this.agentSessionHydrating = previousAgentSessionHydrating
          if (previousActiveSession) {
            this.applyAgentSessionSnapshot(previousActiveSession, {
              hydrating: previousAgentSessionHydrating,
              keepDetailLoadingId: previousAgentSessionHydrating && !!previousAgentSessionDetailLoadingId,
            })
          } else {
            this.activeAgentSessionId = previousActiveSessionId
          }
          window.alert(`删除对话失败: ${err && err.message ? err.message : String(err)}`)
          return
        }
      }
    },
  }
}

export {
  createAgentUiMethods,
}

