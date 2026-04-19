import {
  asText,
  clampText,
  cloneArray,
  cloneAgentSessionRecord,
  cloneObject,
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
      if (this.isAgentSummaryTabActive()) {
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
        frozen: true,
        createdAt: new Date().toISOString(),
        content: {},
        evidenceRefs: [],
      }
    },
    createDefaultAgentTabs() {
      return {
        summaryTab: this.createDefaultAgentSummaryTab(),
        followupTabs: [],
        activeTabId: 'summary',
        followupLimit: 6,
        nextFollowupNumber: 1,
      }
    },
    normalizeAgentFollowupTitle(title = '') {
      const raw = asText(title)
      if (!raw) return '追问'
      return /^追问\d+$/u.test(raw) ? '追问' : raw
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
    getAgentSummaryPack() {
      const payloads = cloneObject(this.agentPanelPayloads)
      const pack = payloads.summary_pack && typeof payloads.summary_pack === 'object'
        ? payloads.summary_pack
        : {}
      return cloneObject(pack)
    },
    hasAgentSummaryPack() {
      const summaryPack = this.getAgentSummaryPack()
      return !!(
        summaryPack.one_line_conclusion
        || (Array.isArray(summaryPack.icsc_tags) && summaryPack.icsc_tags.length)
        || (summaryPack.key_metrics && typeof summaryPack.key_metrics === 'object')
        || (summaryPack.behavior_inference && typeof summaryPack.behavior_inference === 'object')
      )
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
        poi_grid: 'POI / 网格分析',
        population: '人口结构分析',
        nightlight: '夜光分析',
        road_syntax: '路网与可达性分析',
      }
      return mapping[key] || key || '-'
    },
    getAgentSummaryMissingTaskLabels() {
      const readiness = this.normalizeAgentSummaryReadiness(this.agentSummaryReadiness)
      return cloneArray(readiness.missingTasks).map((taskKey) => this.getAgentSummaryTaskLabel(taskKey))
    },
    getAgentSummaryPhaseLabel() {
      const phase = asText(this.agentSummaryProgressPhase)
      const mapping = {
        checked: '已完成就绪检查',
        fetch_missing: '正在补齐缺失分析',
        analysis_started: '正在生成结构化总结',
      }
      return mapping[phase] || ''
    },
    async refreshAgentSummaryReadiness(force = false) {
      if (!this.isAgentSummaryTabActive()) return this.agentSummaryReadiness
      if (this.agentSummaryLoading) return this.agentSummaryReadiness
      if (!force && this.hasAgentSummaryPack() && this.agentSummaryReadiness.ready) return this.agentSummaryReadiness
      this.agentSummaryLoading = true
      this.agentSummaryError = ''
      this.agentSummaryWarnings = []
      try {
        const res = await fetch('/api/v1/analysis/agent/summary/readiness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: asText(this.activeAgentSessionId || this.agentConversationId),
            analysis_fingerprint: asText(this.getCurrentAgentAnalysisFingerprint()),
            analysis_snapshot: this.buildAgentAnalysisSnapshot(),
          }),
        })
        if (!res.ok) {
          throw new Error(`/api/v1/analysis/agent/summary/readiness 请求失败(${res.status})`)
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
      this.agentSummaryGenerating = true
      this.agentSummaryProgressPhase = 'checked'
      this.agentSummaryError = ''
      this.agentSummaryWarnings = []
      try {
        const res = await fetch('/api/v1/analysis/agent/summary/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: asText(this.activeAgentSessionId || this.agentConversationId),
            analysis_fingerprint: asText(this.getCurrentAgentAnalysisFingerprint()),
            analysis_snapshot: this.buildAgentAnalysisSnapshot(),
          }),
        })
        if (!res.ok) {
          throw new Error(`/api/v1/analysis/agent/summary/generate 请求失败(${res.status})`)
        }
        const data = await res.json()
        const phases = cloneArray(data && data.phases).map((item) => asText(item)).filter(Boolean)
        this.agentSummaryProgressPhase = phases.length ? phases[phases.length - 1] : 'analysis_started'
        this.agentSummaryReadiness = this.normalizeAgentSummaryReadiness(data && data.data_readiness)
        this.agentSummaryWarnings = cloneArray(data && data.warnings)
        this.agentSummaryError = asText(data && data.error)
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
        this.syncCurrentAgentSession()
      } catch (err) {
        this.agentSummaryError = err && err.message ? err.message : String(err)
      } finally {
        this.agentSummaryGenerating = false
      }
    },
    ensureAgentTabs(commit = false) {
      const base = this.agentTabs && typeof this.agentTabs === 'object'
        ? this.agentTabs
        : this.createDefaultAgentTabs()
      const nextTabs = {
        summaryTab: cloneObject(base.summaryTab && typeof base.summaryTab === 'object' ? base.summaryTab : this.createDefaultAgentSummaryTab()),
        followupTabs: cloneArray(base.followupTabs).map((item) => ({
          id: asText(item && item.id),
          title: this.normalizeAgentFollowupTitle(item && item.title),
          linkedSummaryId: asText(item && item.linkedSummaryId) || 'summary',
          createdAt: asText(item && item.createdAt) || new Date().toISOString(),
          thread: this.createAgentFollowupThreadState(item && item.thread),
        })).filter((item) => item.id),
        activeTabId: asText(base.activeTabId) || 'summary',
        followupLimit: Number(base.followupLimit || 6) || 6,
        nextFollowupNumber: Number(base.nextFollowupNumber || 1) || 1,
      }
      if (!nextTabs.summaryTab.id) nextTabs.summaryTab.id = 'summary'
      if (!nextTabs.followupTabs.length) {
        const tabId = `followup-${nextTabs.nextFollowupNumber}`
        nextTabs.followupTabs = [{
          id: tabId,
          title: '追问',
          linkedSummaryId: 'summary',
          createdAt: new Date().toISOString(),
          thread: this.buildAgentFollowupThreadFromCurrentState(),
        }]
        nextTabs.nextFollowupNumber += 1
        if (this.hasAgentSummaryPack()) {
          nextTabs.activeTabId = 'summary'
        } else {
          nextTabs.activeTabId = tabId
        }
      }
      const validIds = new Set(['summary', ...nextTabs.followupTabs.map((item) => item.id)])
      if (!validIds.has(nextTabs.activeTabId)) {
        nextTabs.activeTabId = nextTabs.followupTabs[0] ? nextTabs.followupTabs[0].id : 'summary'
      }
      nextTabs.summaryTab.content = this.getAgentSummaryPack()
      nextTabs.summaryTab.evidenceRefs = cloneArray((this.getAgentSummaryPack().evidence_refs || []))
      if (commit) {
        this.agentTabs = nextTabs
      }
      return nextTabs
    },
    getAgentTopTabs() {
      const tabs = this.ensureAgentTabs(false)
      return [
        { id: 'summary', title: '总结', fixed: true },
        ...tabs.followupTabs.map((item) => ({ id: item.id, title: item.title || '追问', fixed: false })),
      ]
    },
    isAgentSummaryTabActive() {
      const tabs = this.ensureAgentTabs(false)
      return asText(tabs.activeTabId) === 'summary'
    },
    getAgentActiveFollowupTab() {
      const tabs = this.ensureAgentTabs(false)
      const activeId = asText(tabs.activeTabId)
      if (!activeId || activeId === 'summary') return tabs.followupTabs[0] || null
      return tabs.followupTabs.find((item) => item.id === activeId) || tabs.followupTabs[0] || null
    },
    captureAgentActiveFollowupTabState() {
      const tabs = this.ensureAgentTabs(true)
      const target = this.getAgentActiveFollowupTab()
      if (!target) return
      target.thread = this.buildAgentFollowupThreadFromCurrentState()
      this.agentTabs = { ...tabs, followupTabs: cloneArray(tabs.followupTabs) }
    },
    switchAgentTopTab(tabId = '') {
      const nextId = asText(tabId)
      const tabs = this.ensureAgentTabs(true)
      if (!nextId || tabs.activeTabId === nextId) return
      this.captureAgentActiveFollowupTabState()
      tabs.activeTabId = nextId
      this.agentTabs = { ...tabs, followupTabs: cloneArray(tabs.followupTabs) }
      if (nextId !== 'summary') {
        const target = tabs.followupTabs.find((item) => item.id === nextId)
        if (target) {
          this.applyAgentFollowupThreadToCurrentState(target.thread)
          this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
        }
      }
      this.syncCurrentAgentSession()
      if (nextId === 'summary') {
        this.refreshAgentSummaryReadiness(false)
      }
    },
    canCreateAgentFollowupTab() {
      const tabs = this.ensureAgentTabs(false)
      return tabs.followupTabs.length < Number(tabs.followupLimit || 6)
    },
    createAgentFollowupTab(options = {}) {
      const tabs = this.ensureAgentTabs(true)
      if (!this.canCreateAgentFollowupTab()) {
        window.alert(`最多可创建 ${tabs.followupLimit} 个追问标签，请先关闭旧标签。`)
        return null
      }
      this.captureAgentActiveFollowupTabState()
      const number = Number(tabs.nextFollowupNumber || (tabs.followupTabs.length + 1))
      const tabId = `followup-${number}`
      const title = this.normalizeAgentFollowupTitle(options.title)
      const seedPrompt = asText(options.seedPrompt)
      const thread = this.createAgentFollowupThreadState({
        input: seedPrompt,
      })
      tabs.followupTabs = [
        ...cloneArray(tabs.followupTabs),
        {
          id: tabId,
          title,
          linkedSummaryId: 'summary',
          createdAt: new Date().toISOString(),
          thread,
        },
      ]
      tabs.nextFollowupNumber = number + 1
      tabs.activeTabId = tabId
      this.agentTabs = tabs
      this.applyAgentFollowupThreadToCurrentState(thread)
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
      return tabId
    },
    closeAgentFollowupTab(tabId = '', event = null) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      const targetId = asText(tabId)
      if (!targetId || targetId === 'summary') return
      const tabs = this.ensureAgentTabs(true)
      const currentActiveId = asText(tabs.activeTabId)
      tabs.followupTabs = cloneArray(tabs.followupTabs).filter((item) => item.id !== targetId)
      if (!tabs.followupTabs.length) {
        tabs.followupTabs = [{
          id: `followup-${tabs.nextFollowupNumber}`,
          title: '追问',
          linkedSummaryId: 'summary',
          createdAt: new Date().toISOString(),
          thread: this.createAgentFollowupThreadState(),
        }]
        tabs.nextFollowupNumber += 1
      }
      if (currentActiveId === targetId) {
        tabs.activeTabId = tabs.followupTabs[0].id
        this.applyAgentFollowupThreadToCurrentState(tabs.followupTabs[0].thread)
      }
      this.agentTabs = tabs
      this.syncActiveAgentRuntimeView(this.activeAgentSessionId)
      this.syncCurrentAgentSession()
    },
    openAgentFollowupFromSummary(prompt = '', title = '追问') {
      const nextPrompt = asText(prompt)
      const tabId = this.createAgentFollowupTab({
        title,
        seedPrompt: nextPrompt,
      })
      if (!tabId) return
      if (nextPrompt) this.agentInput = nextPrompt
    },
    ensureAgentFollowupTabForPrompt(prompt = '') {
      if (!this.isAgentSummaryTabActive()) return
      this.openAgentFollowupFromSummary(prompt || this.agentInput || '', '追问')
    },
    shouldShowAgentComposer() {
      return !this.isAgentSummaryTabActive()
    },
    buildAgentTabsUiState() {
      this.captureAgentActiveFollowupTabState()
      const tabs = this.ensureAgentTabs(true)
      return {
        summary_tab: {
          id: asText((tabs.summaryTab || {}).id) || 'summary',
          frozen: true,
          created_at: asText((tabs.summaryTab || {}).createdAt) || new Date().toISOString(),
          content: cloneObject((tabs.summaryTab || {}).content),
          evidence_refs: cloneArray((tabs.summaryTab || {}).evidenceRefs),
        },
        followup_tabs: cloneArray(tabs.followupTabs).map((item) => ({
          id: item.id,
          title: item.title,
          linked_summary_id: item.linkedSummaryId || 'summary',
          created_at: item.createdAt,
          thread: this.createAgentFollowupThreadState(item.thread),
        })),
        active_tab_id: asText(tabs.activeTabId) || 'summary',
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
        frozen: true,
        createdAt: asText((uiState.summary_tab || {}).created_at) || new Date().toISOString(),
        content: cloneObject((uiState.summary_tab || {}).content),
        evidenceRefs: cloneArray((uiState.summary_tab || {}).evidence_refs),
      }
      const followupTabs = cloneArray(uiState.followup_tabs).map((item) => ({
        id: asText(item && item.id),
        title: this.normalizeAgentFollowupTitle(item && item.title),
        linkedSummaryId: asText(item && item.linked_summary_id) || 'summary',
        createdAt: asText(item && item.created_at) || new Date().toISOString(),
        thread: this.createAgentFollowupThreadState(item && item.thread),
      })).filter((item) => item.id)
      const activeId = asText(uiState.active_tab_id) || (this.hasAgentSummaryPack() ? 'summary' : '')
      this.agentTabs = {
        summaryTab: summaryTab.id ? summaryTab : defaultTabs.summaryTab,
        followupTabs: followupTabs.length ? followupTabs : defaultTabs.followupTabs,
        activeTabId: activeId || (followupTabs[0] ? followupTabs[0].id : 'summary'),
        followupLimit: Number(uiState.followup_limit || 6) || 6,
        nextFollowupNumber: Number(uiState.next_followup_number || (followupTabs.length + 1) || 1) || 1,
      }
      this.ensureAgentTabs(true)
      if (!this.isAgentSummaryTabActive()) {
        const activeTab = this.getAgentActiveFollowupTab()
        if (activeTab) {
          this.applyAgentFollowupThreadToCurrentState(activeTab.thread)
        }
      } else {
        this.syncAgentSummaryReadinessFromPanelPayload(this.agentPanelPayloads)
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
          throw new Error(`/api/v1/analysis/agent/tools 璇锋眰澶辫触(${res.status})`)
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
          title: '\u95e8\u7981\u5224\u65ad',
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
          title: asText(item && item.title) || '妯″瀷鎬濊€?',
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
        statusLabel: '宸插彇娑?',
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
          statusLabel: '澶辫触',
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
        cognition: '璁ょ煡杈撳嚭',
        judgment: '鍒ゆ柇杈撳嚭',
        action: '琛屽姩杈撳嚭',
      }[key] || '鍒ゆ柇杈撳嚭'
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
        window.alert('鍚嶇О涓嶈兘涓虹┖')
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
            throw new Error(`/api/v1/analysis/agent/sessions/${session.id} DELETE 澶辫触(${res.status})`)
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
          window.alert(`鍒犻櫎瀵硅瘽澶辫触: ${err && err.message ? err.message : String(err)}`)
          return
        }
      }
    },
  }
}

export {
  createAgentUiMethods,
}

