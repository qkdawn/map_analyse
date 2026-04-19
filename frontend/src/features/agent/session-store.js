import {
  asText,
  cloneArray,
  cloneObject,
  cloneRecordMap,
  createAgentRunState,
  createAgentSessionPlaceholderRecord,
  createAgentSessionRecord,
  clampText,
  cloneAgentSessionRecord,
  deriveAgentSessionPreview,
  deriveAgentSessionTitle,
  normalizeAgentAction,
  normalizeAgentBoundaryItem,
  normalizeAgentCounterpoint,
  normalizeAgentDecision,
  normalizeAgentDecisionEvidence,
  normalizeAgentPanelPreloadNotes,
  normalizeAgentPlanEnvelope,
  normalizeAgentSessionSummary,
  sortAgentSessions,
} from './normalizers.js'
import {
  hasAgentExecutionTraceContent,
  hasAgentPlanContent,
  shouldExpandAgentProcessSection,
} from './derived.js'
import { cloneAnalysisTaskConfirmation } from './analysis-task-registry.js'

function createAgentSessionStoreMethods() {
  return {
    createAgentSession(seedTitle = '') {
      return createAgentSessionRecord({
        title: String(seedTitle || '').trim() || '新聊天',
        preview: '开始一段新的分析对话',
        analysisFingerprint: this.getCurrentAgentAnalysisFingerprint(),
        status: 'idle',
        persisted: false,
        snapshotLoaded: true,
        titleSource: 'fallback',
      })
    },
    getAgentHistorySessions() {
      return this.agentSessions.filter((item) => !!(item && item.persisted))
    },
    getCurrentAgentAnalysisFingerprint() {
      return asText(this.buildAgentAnalysisFingerprint())
    },
    getAgentCurrentRangeSessions() {
      const currentFingerprint = this.getCurrentAgentAnalysisFingerprint()
      if (!currentFingerprint) return []
      return this.getAgentHistorySessions().filter((item) => asText(item && item.analysisFingerprint) === currentFingerprint)
    },
    getAgentOtherRangeSessions() {
      const currentFingerprint = this.getCurrentAgentAnalysisFingerprint()
      return this.getAgentHistorySessions().filter((item) => {
        const sessionFingerprint = asText(item && item.analysisFingerprint)
        return !currentFingerprint || sessionFingerprint !== currentFingerprint
      })
    },
    getAgentRangeSessionGroups() {
      return [
        {
          id: 'current',
          title: '当前范围',
          count: this.getAgentCurrentRangeSessions().length,
          emptyText: '当前范围暂无历史对话',
          sessions: this.getAgentCurrentRangeSessions(),
        },
        {
          id: 'other',
          title: '其他范围',
          count: this.getAgentOtherRangeSessions().length,
          emptyText: '其他范围暂无历史对话',
          sessions: this.getAgentOtherRangeSessions(),
        },
      ]
    },
    findAgentSession(sessionId = '') {
      const nextId = asText(sessionId)
      if (!nextId) return null
      return this.agentSessions.find((item) => asText(item && item.id) === nextId) || null
    },
    updateAgentSessionSnapshot(sessionId = '', updater = null, options = {}) {
      const nextId = asText(sessionId)
      if (!nextId) return null
      const existing = this.findAgentSession(nextId) || this.createAgentSession()
      const nextSeed = typeof updater === 'function'
        ? updater(cloneAgentSessionRecord(existing) || createAgentSessionRecord({ id: nextId }))
        : { ...existing, ...(updater && typeof updater === 'object' ? updater : {}) }
      const nextSession = createAgentSessionRecord({
        ...existing,
        ...nextSeed,
        id: nextId,
      })
      const filtered = this.agentSessions.filter((item) => asText(item && item.id) !== nextId)
      this.updateAgentSessions([nextSession, ...filtered], { loaded: this.agentSessionsLoaded })
      if (options.syncActive !== false && nextId === asText(this.activeAgentSessionId)) {
        this.applyAgentSessionSnapshot(nextSession)
      }
      return nextSession
    },
    updateAgentSessions(nextSessions = [], options = {}) {
      this.agentSessions = sortAgentSessions(nextSessions)
      if (Object.prototype.hasOwnProperty.call(options || {}, 'loaded')) {
        this.agentSessionsLoaded = !!options.loaded
      }
    },
    applyAgentSessionSnapshot(session, options = {}) {
      if (!session || typeof session !== 'object') return
      const previousActiveSessionId = asText(this.activeAgentSessionId)
      this.agentConversationId = String(session.id || '')
      this.activeAgentSessionId = String(session.id || '')
      this.agentInput = String(session.input || '')
      this.agentSessionHydrating = !!options.hydrating
      this.agentStatus = String(session.status || 'idle')
      this.agentStage = String(session.stage || 'gating')
      this.agentCards = cloneArray(session.cards)
      this.agentDecision = normalizeAgentDecision(session.decision)
      this.agentSupport = cloneArray(session.support).map((item) => normalizeAgentDecisionEvidence(item))
      this.agentCounterpoints = cloneArray(session.counterpoints).map((item) => normalizeAgentCounterpoint(item))
      this.agentActions = cloneArray(session.actions).map((item) => normalizeAgentAction(item))
      this.agentBoundary = cloneArray(session.boundary).map((item) => normalizeAgentBoundaryItem(item))
      this.agentExecutionTrace = cloneArray(session.executionTrace)
      this.agentUsedTools = cloneArray(session.usedTools)
      this.agentCitations = cloneArray(session.citations)
      this.agentResearchNotes = cloneArray(session.researchNotes)
      this.agentAuditIssues = cloneArray(session.auditIssues)
      this.agentNextSuggestions = cloneArray(session.nextSuggestions)
      this.agentPanelPayloads = cloneObject(session.panelPayloads)
      if (typeof this.syncAgentSummaryReadinessFromPanelPayload === 'function') {
        this.syncAgentSummaryReadinessFromPanelPayload(this.agentPanelPayloads)
      }
      this.agentClarificationQuestion = String(session.clarificationQuestion || '')
      this.agentClarificationOptions = cloneArray(session.clarificationOptions)
      this.agentClarificationDraft = ''
      this.agentClarificationSubmitting = false
      this.agentRiskPrompt = String(session.riskPrompt || '')
      this.agentPendingTaskConfirmation = cloneAnalysisTaskConfirmation(session.pendingTaskConfirmation)
      this.agentError = String(session.error || '')
      this.agentContextSummary = cloneObject(session.contextSummary)
      this.agentPlan = normalizeAgentPlanEnvelope(session.plan)
      this.agentPlanExpanded = shouldExpandAgentProcessSection(this.agentStatus, {
        hasContent: hasAgentPlanContent(this.agentPlan),
      })
      this.agentTraceExpanded = shouldExpandAgentProcessSection(this.agentStatus, {
        hasContent: hasAgentExecutionTraceContent(this.agentExecutionTrace),
      })
      this.agentRiskConfirmations = cloneArray(session.riskConfirmations)
      this.agentMessages = cloneArray(session.messages)
      this.agentThinkingTimeline = cloneArray(session.thinkingTimeline)
      this.agentSummaryLoading = false
      this.agentSummaryGenerating = false
      this.agentSummaryProgressPhase = ''
      this.agentLoading = false
      this.agentReasoningBlocks = []
      this.agentStreamingMessageId = ''
      this.agentStreamState = 'idle'
      this.agentStreamStartedAt = 0
      this.agentStreamElapsedTick = 0
      this.agentStreamElapsedTimer = null
      this.agentPanelPreloadNotes = normalizeAgentPanelPreloadNotes(session.panelPreloadNotes)
      this.agentPreloadedPanelKeys = cloneArray(session.preloadedPanelKeys)
      this.agentThinkingExpanded = shouldExpandAgentProcessSection(this.agentStatus, {
        hasContent: !!(
          this.agentThinkingTimeline.length
          || hasAgentPlanContent(this.agentPlan)
          || hasAgentExecutionTraceContent(this.agentExecutionTrace)
        ),
      })
      if (!options.keepDetailLoadingId) {
        this.agentSessionDetailLoadingId = ''
      }
      const shouldRestoreTabs = !!(
        options.hydrating
        || !this.agentTabs
        || !Array.isArray(this.agentTabs.followupTabs)
        || !this.agentTabs.followupTabs.length
        || previousActiveSessionId !== asText(session.id)
      )
      if (typeof this.restoreAgentTabsFromSession === 'function') {
        if (shouldRestoreTabs) {
          this.restoreAgentTabsFromSession(session)
        } else if (typeof this.ensureAgentTabs === 'function') {
          this.ensureAgentTabs()
          if (typeof this.captureAgentActiveFollowupTabState === 'function') {
            this.captureAgentActiveFollowupTabState()
          }
        }
      }
      this.closeAgentSessionMenu()
      this.syncActiveAgentRuntimeView(session.id)
      if (typeof this.refreshAgentSummaryReadiness === 'function' && typeof this.isAgentSummaryTabActive === 'function') {
        if (this.isAgentSummaryTabActive()) {
          this.refreshAgentSummaryReadiness(false).catch((err) => {
            console.warn('Agent summary readiness refresh failed', err)
          })
        }
      }
    },
    mergeAgentSessionDetail(detail) {
      const existing = this.findAgentSession(detail && detail.id)
      const session = createAgentSessionRecord({
        ...existing,
        id: detail && detail.id,
        title: detail && detail.title,
        preview: detail && detail.preview,
        analysisFingerprint: (detail && (detail.analysis_fingerprint || detail.analysisFingerprint)) || (existing && existing.analysisFingerprint),
        status: detail && detail.status,
        stage: detail && detail.stage,
        input: detail && detail.input,
        output: detail && detail.output,
        diagnostics: detail && detail.diagnostics,
        contextSummary: detail && detail.context_summary,
        plan: detail && detail.plan,
        riskConfirmations: detail && detail.risk_confirmations,
        messages: detail && detail.messages,
        isPinned: !!(detail && detail.is_pinned),
        persisted: true,
        snapshotLoaded: true,
        titleSource: detail && detail.title_source,
        createdAt: detail && detail.created_at,
        updatedAt: detail && detail.updated_at,
        pinnedAt: detail && detail.pinned_at,
      })
      const filtered = this.agentSessions.filter((item) => asText(item && item.id) !== session.id)
      this.updateAgentSessions([session, ...filtered], { loaded: this.agentSessionsLoaded })
      return session
    },
    syncCurrentAgentSession(options = {}) {
      const activeId = asText(this.activeAgentSessionId || this.agentConversationId)
      if (!activeId) return null
      if (typeof this.captureAgentActiveFollowupTabState === 'function') {
        this.captureAgentActiveFollowupTabState()
      }
      const existing = this.findAgentSession(activeId)
      let messages = cloneArray(this.agentMessages)
      if (typeof this.getAgentActiveFollowupTab === 'function') {
        const activeFollowupTab = this.getAgentActiveFollowupTab()
        if (activeFollowupTab && activeFollowupTab.thread) {
          messages = cloneArray(activeFollowupTab.thread.messages)
        }
      }
      const panelPayloads = cloneObject(this.agentPanelPayloads)
      if (typeof this.buildAgentTabsUiState === 'function') {
        panelPayloads.agent_tabs = this.buildAgentTabsUiState()
      }
      const existingTitleSource = asText(existing && existing.titleSource) || 'fallback'
      const shouldPreserveTitle = existing && ['user', 'ai'].includes(existingTitleSource)
      const fallbackTitle = deriveAgentSessionTitle(messages)
      const draft = createAgentSessionRecord({
        ...existing,
        id: activeId,
        title: shouldPreserveTitle
          ? existing.title
          : (messages.length ? fallbackTitle : clampText(existing && existing.title, 60) || '新聊天'),
        preview: deriveAgentSessionPreview({
          error: this.agentError,
          riskPrompt: this.agentRiskPrompt,
          clarificationQuestion: this.agentClarificationQuestion,
          cards: this.agentCards,
          messages,
        }),
        updatedAt: new Date().toISOString(),
        createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString(),
        pinnedAt: existing && existing.pinnedAt ? existing.pinnedAt : '',
        analysisFingerprint: Object.prototype.hasOwnProperty.call(options || {}, 'analysisFingerprint')
          ? asText(options.analysisFingerprint)
          : (asText(existing && existing.analysisFingerprint) || this.getCurrentAgentAnalysisFingerprint()),
        status: String(this.agentStatus || 'idle'),
        stage: String(this.agentStage || 'gating'),
        input: String(this.agentInput || ''),
        output: {
          cards: this.agentCards,
          clarificationQuestion: this.agentClarificationQuestion,
          clarificationOptions: this.agentClarificationOptions,
          riskPrompt: this.agentRiskPrompt,
          nextSuggestions: this.agentNextSuggestions,
          panelPayloads,
          decision: this.agentDecision,
          support: this.agentSupport,
          counterpoints: this.agentCounterpoints,
          actions: this.agentActions,
          boundary: this.agentBoundary,
        },
        diagnostics: {
          executionTrace: this.agentExecutionTrace,
          usedTools: this.agentUsedTools,
          citations: this.agentCitations,
          researchNotes: this.agentResearchNotes,
          auditIssues: this.agentAuditIssues,
          planningSummary: asText(
            (existing && existing.diagnostics && (existing.diagnostics.planningSummary || existing.diagnostics.planning_summary))
            || (this.agentPlan && this.agentPlan.summary),
          ),
          auditSummary: asText(existing && existing.diagnostics && (existing.diagnostics.auditSummary || existing.diagnostics.audit_summary)),
          replanCount: Number(existing && existing.diagnostics && (existing.diagnostics.replanCount ?? existing.diagnostics.replan_count ?? 0)) || 0,
          thinkingTimeline: this.agentThinkingTimeline,
          error: this.agentError,
        },
        contextSummary: this.agentContextSummary,
        plan: this.agentPlan,
        riskConfirmations: this.agentRiskConfirmations,
        pendingTaskConfirmation: cloneAnalysisTaskConfirmation(this.agentPendingTaskConfirmation),
        panelPreloadNotes: this.agentPanelPreloadNotes,
        preloadedPanelKeys: this.agentPreloadedPanelKeys,
        panelPayloads,
        messages,
        isPinned: Object.prototype.hasOwnProperty.call(options || {}, 'isPinned')
          ? !!options.isPinned
          : !!(existing && existing.isPinned),
        persisted: Object.prototype.hasOwnProperty.call(options || {}, 'persisted')
          ? !!options.persisted
          : !!(existing && existing.persisted),
        snapshotLoaded: Object.prototype.hasOwnProperty.call(options || {}, 'snapshotLoaded')
          ? !!options.snapshotLoaded
          : true,
        titleSource: shouldPreserveTitle ? existingTitleSource : (existingTitleSource || 'fallback'),
      })
      const filtered = this.agentSessions.filter((item) => asText(item && item.id) !== activeId)
      this.updateAgentSessions([draft, ...filtered], { loaded: this.agentSessionsLoaded })
      return draft
    },
    async loadAgentSessionSummaries(force = false) {
      if (this.agentSessionsLoading) return this.agentSessions
      if (this.agentSessionsLoaded && !force) return this.agentSessions

      this.agentSessionsLoading = true
      try {
        const res = await fetch('/api/v1/analysis/agent/sessions', {
          cache: force ? 'no-store' : 'default',
        })
        if (!res.ok) {
          throw new Error(`/api/v1/analysis/agent/sessions 请求失败(${res.status})`)
        }
        const data = await res.json()
        const existingById = new Map(this.agentSessions.map((item) => [asText(item && item.id), item]))
        const persistedSessions = Array.isArray(data)
          ? data.map((item) => normalizeAgentSessionSummary(item, existingById.get(asText(item && item.id))))
          : []
        const persistedIds = new Set(persistedSessions.map((item) => item.id))
        const localDrafts = this.agentSessions.filter((item) => !item.persisted && !persistedIds.has(asText(item && item.id)))
        this.updateAgentSessions([...persistedSessions, ...localDrafts], { loaded: true })
        return this.agentSessions
      } finally {
        this.agentSessionsLoading = false
      }
    },
    async loadAgentSessionDetail(sessionId = '') {
      const nextId = asText(sessionId)
      if (!nextId) return null
      const res = await fetch(`/api/v1/analysis/agent/sessions/${encodeURIComponent(nextId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error(`/api/v1/analysis/agent/sessions/${nextId} 请求失败(${res.status})`)
      }
      const detail = await res.json()
      return this.mergeAgentSessionDetail(detail)
    },
    ensureAgentPanelReady() {
      const activeId = asText(this.activeAgentSessionId || this.agentConversationId)
      if (activeId) {
        const existing = this.findAgentSession(activeId)
        if (existing) {
          this.applyAgentSessionSnapshot(existing)
        }
      } else if (!this.agentSessions.length) {
        const session = this.createAgentSession()
        this.updateAgentSessions([session], { loaded: this.agentSessionsLoaded })
        this.applyAgentSessionSnapshot(session)
      } else {
        const localDraft = this.agentSessions.find((item) => !item.persisted) || this.agentSessions[0]
        if (localDraft) {
          this.applyAgentSessionSnapshot(localDraft)
        }
      }

      if (!this.agentSessionsLoaded && !this.agentSessionsLoading) {
        this.loadAgentSessionSummaries(false).catch((err) => {
          console.warn('Agent session summaries load failed', err)
        })
      }
    },
    startNewAgentChat() {
      this.agentWorkspaceView = 'chat'
      this.syncCurrentAgentSession()
      const session = this.createAgentSession()
      this.updateAgentSessions([session, ...this.agentSessions], { loaded: this.agentSessionsLoaded })
      this.applyAgentSessionSnapshot(session)
    },
    async activateAgentSession(sessionId = '') {
      const nextId = asText(sessionId)
      if (!nextId) return
      this.agentWorkspaceView = 'chat'
      if (nextId === asText(this.activeAgentSessionId)) {
        const current = this.findAgentSession(nextId)
        if (current && current.snapshotLoaded) return
      }

      this.syncCurrentAgentSession()
      let session = this.findAgentSession(nextId)
      if (!session) return
      if (session.persisted && !session.snapshotLoaded) {
        const requestToken = Number(this.agentSessionDetailRequestToken || 0) + 1
        this.agentSessionDetailRequestToken = requestToken
        this.agentSessionDetailLoadingId = nextId
        this.applyAgentSessionSnapshot(createAgentSessionPlaceholderRecord(session), {
          hydrating: true,
          keepDetailLoadingId: true,
        })
        try {
          session = await this.loadAgentSessionDetail(nextId)
          if (
            Number(this.agentSessionDetailRequestToken || 0) !== requestToken
            || asText(this.activeAgentSessionId) !== nextId
          ) {
            return
          }
          this.applyAgentSessionSnapshot(session)
        } catch (err) {
          if (
            Number(this.agentSessionDetailRequestToken || 0) !== requestToken
            || asText(this.activeAgentSessionId) !== nextId
          ) {
            return
          }
          this.applyAgentSessionSnapshot(createAgentSessionRecord({
            ...session,
            error: `加载对话失败: ${err && err.message ? err.message : String(err)}`,
            snapshotLoaded: false,
          }))
        } finally {
          if (
            Number(this.agentSessionDetailRequestToken || 0) === requestToken
            && this.agentSessionDetailLoadingId === nextId
          ) {
            this.agentSessionDetailLoadingId = ''
          }
        }
        return
      }
      this.applyAgentSessionSnapshot(session)
    },
  }
}

export { createAgentSessionStoreMethods }
