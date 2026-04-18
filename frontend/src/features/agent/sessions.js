function asText(value, fallback = '') {
  const text = String(value ?? fallback ?? '').trim()
  return text
}

function clampText(value, maxLength, fallback = '') {
  const text = asText(value, fallback)
  if (!maxLength || maxLength <= 0) return text
  return text.slice(0, maxLength)
}

function cloneArray(items) {
  return Array.isArray(items) ? items.map((item) => (item && typeof item === 'object' ? { ...item } : item)) : []
}

function cloneObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : { ...fallback }
}

function cloneRecordMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.keys(value).reduce((result, key) => {
    const nextKey = asText(key)
    if (!nextKey) return result
    result[nextKey] = value[key]
    return result
  }, {})
}

function stableAgentHash(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function normalizeAgentThinkingItem(seed = {}) {
  return {
    id: asText(seed.id) || `thinking-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    phase: asText(seed.phase),
    title: asText(seed.title) || '处理中',
    detail: asText(seed.detail),
    items: cloneArray(seed.items).map((item) => asText(item)).filter(Boolean),
    meta: cloneObject(seed.meta),
    state: asText(seed.state || 'pending') || 'pending',
  }
}

function upsertThinkingItemInList(items = [], seed = {}) {
  const item = normalizeAgentThinkingItem(seed)
  const nextTimeline = cloneArray(items)
  const existingIndex = nextTimeline.findIndex((entry) => asText(entry && entry.id) === item.id)
  if (existingIndex >= 0) {
    nextTimeline.splice(existingIndex, 1, { ...nextTimeline[existingIndex], ...item })
  } else {
    nextTimeline.push(item)
  }
  return nextTimeline
}

function completeActiveThinkingItemsInList(items = [], excludeId = '') {
  const skipId = asText(excludeId)
  return cloneArray(items).map((item) => {
    const normalized = normalizeAgentThinkingItem(item)
    if (normalized.id === skipId || normalized.state !== 'active') return normalized
    return { ...normalized, state: 'completed' }
  })
}

function normalizeAgentTraceThinkingItem(seed = {}) {
  const toolName = asText(seed.tool_name || seed.toolName || 'unknown_tool')
  const status = asText(seed.status)
  const state = status === 'success' ? 'completed' : (['failed', 'blocked', 'skipped'].includes(status) ? 'failed' : 'active')
  const titleStatus = {
    start: '开始调用',
    success: '执行成功',
    failed: '执行失败',
    blocked: '等待确认',
    skipped: '已跳过',
  }[status] || status || '执行中'
  const items = []
  const argumentsSummary = asText(seed.arguments_summary || seed.argumentsSummary)
  const resultSummary = asText(seed.result_summary || seed.resultSummary)
  const evidenceCount = seed.evidence_count ?? seed.evidenceCount
  const warningCount = seed.warning_count ?? seed.warningCount
  const producedArtifacts = cloneArray(seed.produced_artifacts || seed.producedArtifacts).map((item) => asText(item)).filter(Boolean)
  if (argumentsSummary) items.push(`参数：${argumentsSummary}`)
  if (resultSummary) items.push(`结果：${resultSummary}`)
  if (evidenceCount !== undefined && evidenceCount !== null && String(evidenceCount) !== '') items.push(`证据：${evidenceCount} 条`)
  if (warningCount !== undefined && warningCount !== null && Number(warningCount) > 0) items.push(`警告：${warningCount} 条`)
  if (producedArtifacts.length) items.push(`产物：${producedArtifacts.slice(0, 6).join('、')}`)
  return normalizeAgentThinkingItem({
    id: asText(seed.id || seed.call_id || seed.callId) || `trace:${toolName}`,
    phase: 'executing',
    title: `${titleStatus} ${toolName}`,
    detail: asText(seed.message || seed.reason),
    items,
    meta: {
      toolName,
      status,
      callId: asText(seed.call_id || seed.callId),
    },
    state,
  })
}

function normalizeAgentReasoningDelta(seed = {}) {
  return {
    id: asText(seed.id) || 'agent-reasoning',
    phase: asText(seed.phase),
    title: asText(seed.title) || '模型思考',
    delta: String(seed.delta || ''),
    state: asText(seed.state || 'active') || 'active',
  }
}

function upsertReasoningDeltaInList(items = [], seed = {}) {
  const item = normalizeAgentReasoningDelta(seed)
  const nextBlocks = cloneArray(items)
  const existingIndex = nextBlocks.findIndex((entry) => asText(entry && entry.id) === item.id)
  if (existingIndex >= 0) {
    const current = nextBlocks[existingIndex] || {}
    nextBlocks.splice(existingIndex, 1, {
      ...current,
      id: item.id,
      phase: item.phase || current.phase || '',
      title: item.title || current.title || '模型思考',
      content: String(current.content || '') + item.delta,
      state: item.state || current.state || 'active',
    })
  } else if (item.delta || item.state !== 'completed') {
    nextBlocks.push({
      id: item.id,
      phase: item.phase,
      title: item.title,
      content: item.delta,
      state: item.state,
    })
  }
  return nextBlocks
}

function normalizeAgentPlanStep(seed = {}) {
  return {
    tool_name: asText(seed.tool_name || seed.toolName),
    arguments: cloneObject(seed.arguments),
    reason: asText(seed.reason),
    evidence_goal: asText(seed.evidence_goal || seed.evidenceGoal),
    expected_artifacts: cloneArray(seed.expected_artifacts || seed.expectedArtifacts).map((item) => asText(item)).filter(Boolean),
    optional: !!seed.optional,
  }
}

function normalizeAgentPlanEnvelope(seed = {}) {
  return {
    steps: cloneArray(seed.steps).map((item) => normalizeAgentPlanStep(item)).filter((item) => item.tool_name),
    followupSteps: cloneArray(seed.followupSteps || seed.followup_steps).map((item) => normalizeAgentPlanStep(item)).filter((item) => item.tool_name),
    followupApplied: !!(seed.followupApplied || seed.followup_applied),
    summary: asText(seed.summary),
  }
}

function normalizeAgentDecision(seed = {}) {
  return {
    summary: asText(seed.summary),
    mode: asText(seed.mode || 'judgment') || 'judgment',
    strength: asText(seed.strength || 'weak') || 'weak',
    canAct: !!(seed.canAct || seed.can_act),
  }
}

function normalizeAgentDecisionEvidence(seed = {}) {
  return {
    key: asText(seed.key || seed.metric),
    metric: asText(seed.metric),
    headline: asText(seed.headline),
    value: seed && Object.prototype.hasOwnProperty.call(seed, 'value') ? seed.value : null,
    interpretation: asText(seed.interpretation),
    source: asText(seed.source),
    confidence: asText(seed.confidence || 'weak') || 'weak',
    limitation: asText(seed.limitation),
    supports: cloneArray(seed.supports).map((item) => asText(item)).filter(Boolean),
    isKey: !!(seed.isKey || seed.is_key),
  }
}

function normalizeAgentCounterpoint(seed = {}) {
  return {
    kind: asText(seed.kind || 'boundary') || 'boundary',
    title: asText(seed.title),
    detail: asText(seed.detail),
  }
}

function normalizeAgentAction(seed = {}) {
  return {
    title: asText(seed.title),
    detail: asText(seed.detail),
    condition: asText(seed.condition),
    target: asText(seed.target),
    prompt: asText(seed.prompt),
  }
}

function normalizeAgentBoundaryItem(seed = {}) {
  return {
    title: asText(seed.title),
    detail: asText(seed.detail),
  }
}

function normalizeAgentPanelPreloadNote(seed = {}) {
  return {
    key: asText(seed.key),
    label: asText(seed.label),
  }
}

function normalizeAgentPanelPreloadNotes(items = []) {
  return cloneArray(items)
    .map((item) => normalizeAgentPanelPreloadNote(item))
    .filter((item) => item.key && item.label)
}

function normalizeAgentProducedArtifacts(seed = {}) {
  return cloneArray(seed.produced_artifacts || seed.producedArtifacts)
    .map((item) => asText(item))
    .filter(Boolean)
}

function getAgentPlanTraceStatus(seed = {}) {
  const status = asText(seed.status)
  if (status === 'success') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'blocked') return 'blocked'
  if (status === 'skipped') return 'skipped'
  if (status === 'start') return 'active'
  return 'pending'
}

function summarizeAgentPlan(plan = {}, diagnostics = {}) {
  const baseSummary = asText(plan.summary || diagnostics.planningSummary || diagnostics.planning_summary)
  if (plan.followupApplied && cloneArray(plan.followupSteps).length) {
    return baseSummary ? `${baseSummary} 已根据审计补充步骤。` : '已根据审计补充步骤。'
  }
  return baseSummary
}

function buildAgentPlanChecklist(plan = {}, executionTrace = [], options = {}) {
  const normalizedPlan = normalizeAgentPlanEnvelope(plan)
  const traces = cloneArray(executionTrace)
  const groups = [
    { key: 'initial', title: '初始计划', description: 'AI 生成的首轮分析步骤', items: normalizedPlan.steps },
    { key: 'followup', title: '补充计划', description: '审计后补充的步骤', items: normalizedPlan.followupSteps },
  ].filter((group) => group.items.length)
  const allSteps = groups.flatMap((group) => group.items)
  const totalCount = allSteps.length
  if (!totalCount) {
    return {
      visible: false,
      summary: summarizeAgentPlan(normalizedPlan, options.diagnostics),
      progressLabel: '',
      completedCount: 0,
      totalCount: 0,
      followupApplied: normalizedPlan.followupApplied,
      groups: [],
    }
  }

  let traceCursor = 0
  let firstPendingAssigned = false
  const isExecuting = !!options.isLoading && ['planning', 'executing', 'auditing', 'replanning', 'synthesizing'].includes(asText(options.stage))
  const normalizedGroups = groups.map((group) => ({
    ...group,
    items: group.items.map((step) => {
      const toolName = asText(step.tool_name || step.toolName)
      let matchedTrace = null
      for (let index = traceCursor; index < traces.length; index += 1) {
        const traceToolName = asText(traces[index] && (traces[index].tool_name || traces[index].toolName))
        if (traceToolName === toolName) {
          matchedTrace = traces[index]
          while (index + 1 < traces.length) {
            const nextTraceToolName = asText(traces[index + 1] && (traces[index + 1].tool_name || traces[index + 1].toolName))
            if (nextTraceToolName !== toolName) break
            index += 1
            matchedTrace = traces[index]
          }
          traceCursor = index + 1
          break
        }
      }

      let status = matchedTrace ? getAgentPlanTraceStatus(matchedTrace) : 'pending'
      if (!matchedTrace && isExecuting && !firstPendingAssigned) {
        status = 'active'
        firstPendingAssigned = true
      } else if (status !== 'pending') {
        firstPendingAssigned = true
      }

      return {
        ...step,
        title: asText(step.reason) || toolName,
        detail: asText(step.evidence_goal || step.evidenceGoal),
        status,
        toolName,
      }
    }),
  }))

  const completedCount = normalizedGroups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.status === 'completed').length,
    0,
  )

  return {
    visible: true,
    summary: summarizeAgentPlan(normalizedPlan, options.diagnostics),
    progressLabel: `${completedCount}/${totalCount} 已完成`,
    completedCount,
    totalCount,
    followupApplied: normalizedPlan.followupApplied,
    groups: normalizedGroups,
  }
}

function normalizeAgentStatusThinkingItem(seed = {}) {
  const stage = asText(seed.stage)
  const mapping = {
    gating: ['门卫判断', '正在判断你的问题是否清晰、当前范围是否能直接开始分析。'],
    clarifying: ['生成追问', '还缺少关键信息，正在整理最关键的补充问题。'],
    context_ready: ['整理上下文', '正在汇总当前分析快照与可复用结果。'],
    planning: ['规划分析步骤', '正在决定这轮要调用哪些工具、补哪些证据。'],
    executing: ['执行工具', '正在执行工具调用并收集证据。'],
    auditing: ['审计结果', '正在检查这些证据够不够真正回答你的问题。'],
    replanning: ['重新规划', '审计发现证据还不够，正在调整下一轮分析步骤。'],
    synthesizing: ['综合分析', '正在把结果整理成更完整的判断、依据和建议。'],
    answered: ['回答生成完成', '已生成最终回答。'],
    requires_clarification: ['需要补充信息', '还差关键信息，补充后才能继续分析。'],
    requires_risk_confirmation: ['等待风险确认', '需要确认后继续执行。'],
    failed: ['处理失败', asText(seed.message) || 'Agent 执行失败。'],
  }
  const [title, detail] = mapping[stage] || ['更新状态', asText(seed.label || stage) || 'Agent 状态已更新。']
  return normalizeAgentThinkingItem({
    id: `status-${stage || 'unknown'}`,
    phase: stage || 'status',
    title,
    detail,
    state: ['answered'].includes(stage)
      ? 'completed'
      : (['failed', 'requires_clarification'].includes(stage) ? 'failed' : 'active'),
  })
}

function normalizeAgentSubmitThinkingItem(state = 'active') {
  return normalizeAgentThinkingItem({
    id: 'frontend-submit-request',
    phase: 'connecting',
    title: '提交请求',
    detail: state === 'completed' ? '问题已经发给 AI 了，正在等它开始处理。' : '正在提交问题，并等待 AI 接收请求。',
    state,
  })
}

function normalizeAgentWaitingThinkingItem(elapsedSeconds = 0) {
  const seconds = Number(elapsedSeconds || 0)
  if (seconds >= 30) {
    return normalizeAgentThinkingItem({
      id: 'frontend-wait-backend',
      phase: 'connecting',
      title: '等待后端首个进度事件',
      detail: '请求已经发出，但后端还没推来第一条真实进度。这里一旦收到门卫判断、规划、工具执行或审计事件，就会立刻切换成真实步骤。',
      state: 'active',
    })
  }
  if (seconds >= 12) {
    return normalizeAgentThinkingItem({
      id: 'frontend-wait-backend',
      phase: 'connecting',
      title: '等待后端首个进度事件',
      detail: '后端已收到请求，正在准备返回第一条真实步骤。',
      state: 'active',
    })
  }
  return normalizeAgentThinkingItem({
    id: 'frontend-wait-backend',
    phase: 'connecting',
    title: '等待后端首个进度事件',
    detail: '正在等待后端返回第一条真实进度。',
    state: 'active',
  })
}

function normalizeAgentPlanThinkingItem(seed = {}) {
  const normalizedPlan = normalizeAgentPlanEnvelope(seed)
  const previewItems = normalizedPlan.steps
    .slice(0, 4)
    .map((step) => asText(step.reason || step.tool_name))
    .filter(Boolean)
  return normalizeAgentThinkingItem({
    id: `plan-envelope-${stableAgentHash({
      steps: normalizedPlan.steps.map((step) => step.tool_name),
      followup: normalizedPlan.followupSteps.map((step) => step.tool_name),
      summary: normalizedPlan.summary,
    })}`,
    phase: normalizedPlan.followupApplied ? 'replanning' : 'planning',
    title: normalizedPlan.followupApplied ? '已补充后续步骤' : '已列出本轮步骤',
    detail: normalizedPlan.summary || '已生成待执行的分析步骤。',
    items: previewItems,
    state: 'completed',
  })
}

function mergeAgentThinkingTimeline(liveItems = [], finalItems = []) {
  const merged = cloneArray(liveItems).map((item) => normalizeAgentThinkingItem(item))
  cloneArray(finalItems)
    .map((item) => normalizeAgentThinkingItem(item))
    .forEach((item) => {
      const existingIndex = merged.findIndex((entry) => asText(entry && entry.id) === item.id)
      if (existingIndex >= 0) {
        merged.splice(existingIndex, 1, {
          ...merged[existingIndex],
          ...item,
        })
        return
      }
      merged.push(item)
    })
  return merged
}

function parseSseChunk(rawChunk = '') {
  const lines = String(rawChunk || '').split(/\r?\n/)
  let type = 'message'
  const dataLines = []
  lines.forEach((line) => {
    if (!line) return
    if (line.startsWith('event:')) {
      type = asText(line.slice(6))
      return
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  })
  const rawData = dataLines.join('\n').trim()
  if (!rawData) {
    return { type, payload: {} }
  }
  return {
    type,
    payload: JSON.parse(rawData),
  }
}

async function consumeSseStream(response, onEvent) {
  if (!response || !response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Agent 流式响应缺少可读数据流')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    let splitIndex = buffer.indexOf('\n\n')
    while (splitIndex >= 0) {
      const rawChunk = buffer.slice(0, splitIndex)
      buffer = buffer.slice(splitIndex + 2)
      if (rawChunk.trim()) {
        onEvent(parseSseChunk(rawChunk))
      }
      splitIndex = buffer.indexOf('\n\n')
    }
    if (done) break
  }

  if (buffer.trim()) {
    onEvent(parseSseChunk(buffer))
  }
}

function normalizeAgentTurnPayload(seed = {}) {
  const rawOutput = seed.output && typeof seed.output === 'object' ? seed.output : {}
  const rawDiagnostics = seed.diagnostics && typeof seed.diagnostics === 'object' ? seed.diagnostics : {}
  const rawContextSummary = (seed.contextSummary && typeof seed.contextSummary === 'object')
    ? seed.contextSummary
    : ((seed.context_summary && typeof seed.context_summary === 'object') ? seed.context_summary : {})
  const rawPlan = seed.plan && typeof seed.plan === 'object' ? seed.plan : {}
  const output = {
    cards: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'cards')
        ? seed.cards
        : (Object.prototype.hasOwnProperty.call(seed, 'assistant_cards') ? seed.assistant_cards : rawOutput.cards),
    ),
    clarificationQuestion: String(
      Object.prototype.hasOwnProperty.call(seed, 'clarificationQuestion')
        ? seed.clarificationQuestion
        : (
          Object.prototype.hasOwnProperty.call(seed, 'clarification_question')
            ? seed.clarification_question
            : (rawOutput.clarificationQuestion || rawOutput.clarification_question || '')
        ),
    ),
    clarificationOptions: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'clarificationOptions')
        ? seed.clarificationOptions
        : (
          Object.prototype.hasOwnProperty.call(seed, 'clarification_options')
            ? seed.clarification_options
            : (rawOutput.clarificationOptions || rawOutput.clarification_options)
        ),
    ).map((item) => asText(item)).filter(Boolean),
    riskPrompt: String(
      Object.prototype.hasOwnProperty.call(seed, 'riskPrompt')
        ? seed.riskPrompt
        : (
          Object.prototype.hasOwnProperty.call(seed, 'risk_prompt')
            ? seed.risk_prompt
            : (rawOutput.riskPrompt || rawOutput.risk_prompt || '')
        ),
    ),
    nextSuggestions: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'nextSuggestions')
        ? seed.nextSuggestions
        : (
          Object.prototype.hasOwnProperty.call(seed, 'next_suggestions')
            ? seed.next_suggestions
            : (rawOutput.nextSuggestions || rawOutput.next_suggestions)
        ),
    ),
    panelPayloads: cloneObject(
      Object.prototype.hasOwnProperty.call(seed, 'panelPayloads')
        ? seed.panelPayloads
        : (
          Object.prototype.hasOwnProperty.call(seed, 'panel_payloads')
            ? seed.panel_payloads
            : (rawOutput.panelPayloads || rawOutput.panel_payloads || {})
        ),
    ),
    decision: normalizeAgentDecision(
      Object.prototype.hasOwnProperty.call(seed, 'decision')
        ? seed.decision
        : (rawOutput.decision || {}),
    ),
    support: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'support')
        ? seed.support
        : rawOutput.support,
    ).map((item) => normalizeAgentDecisionEvidence(item)).filter((item) => item.key || item.metric || item.headline),
    counterpoints: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'counterpoints')
        ? seed.counterpoints
        : rawOutput.counterpoints,
    ).map((item) => normalizeAgentCounterpoint(item)).filter((item) => item.detail),
    actions: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'actions')
        ? seed.actions
        : rawOutput.actions,
    ).map((item) => normalizeAgentAction(item)).filter((item) => item.title || item.detail),
    boundary: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'boundary')
        ? seed.boundary
        : rawOutput.boundary,
    ).map((item) => normalizeAgentBoundaryItem(item)).filter((item) => item.detail),
  }
  const diagnostics = {
    executionTrace: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'executionTrace')
        ? seed.executionTrace
        : (
          Object.prototype.hasOwnProperty.call(seed, 'execution_trace')
            ? seed.execution_trace
            : (rawDiagnostics.executionTrace || rawDiagnostics.execution_trace)
        ),
    ),
    usedTools: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'usedTools')
        ? seed.usedTools
        : (
          Object.prototype.hasOwnProperty.call(seed, 'used_tools')
            ? seed.used_tools
            : (rawDiagnostics.usedTools || rawDiagnostics.used_tools)
        ),
    ),
    citations: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'citations')
        ? seed.citations
        : rawDiagnostics.citations,
    ),
    researchNotes: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'researchNotes')
        ? seed.researchNotes
        : (
          Object.prototype.hasOwnProperty.call(seed, 'research_notes')
            ? seed.research_notes
            : (rawDiagnostics.researchNotes || rawDiagnostics.research_notes)
        ),
    ),
    auditIssues: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'auditIssues')
        ? seed.auditIssues
        : (
          Object.prototype.hasOwnProperty.call(seed, 'audit_issues')
            ? seed.audit_issues
            : (rawDiagnostics.auditIssues || rawDiagnostics.audit_issues)
        ),
    ),
    planningSummary: String(
      Object.prototype.hasOwnProperty.call(seed, 'planningSummary')
        ? seed.planningSummary
        : (
          Object.prototype.hasOwnProperty.call(seed, 'planning_summary')
            ? seed.planning_summary
            : (rawDiagnostics.planningSummary || rawDiagnostics.planning_summary || '')
        ),
    ),
    auditSummary: String(
      Object.prototype.hasOwnProperty.call(seed, 'auditSummary')
        ? seed.auditSummary
        : (
          Object.prototype.hasOwnProperty.call(seed, 'audit_summary')
            ? seed.audit_summary
            : (rawDiagnostics.auditSummary || rawDiagnostics.audit_summary || '')
        ),
    ),
    replanCount: Number(
      Object.prototype.hasOwnProperty.call(seed, 'replanCount')
        ? seed.replanCount
        : (
          Object.prototype.hasOwnProperty.call(seed, 'replan_count')
            ? seed.replan_count
            : (rawDiagnostics.replanCount ?? rawDiagnostics.replan_count ?? 0)
        ),
    ) || 0,
    thinkingTimeline: cloneArray(
      Object.prototype.hasOwnProperty.call(seed, 'thinkingTimeline')
        ? seed.thinkingTimeline
        : (
          Object.prototype.hasOwnProperty.call(seed, 'thinking_timeline')
            ? seed.thinking_timeline
            : (rawDiagnostics.thinkingTimeline || rawDiagnostics.thinking_timeline)
        ),
    ),
    error: String(
      Object.prototype.hasOwnProperty.call(seed, 'error')
        ? seed.error
        : (rawDiagnostics.error || ''),
    ),
  }
  return {
    stage: String(seed.stage || 'gating'),
    output,
    diagnostics,
    contextSummary: cloneObject(rawContextSummary),
    plan: normalizeAgentPlanEnvelope(rawPlan),
  }
}

function getAgentSummaryCardContent(cards = []) {
  const summaryCard = cloneArray(cards).find((item) => item && asText(item.type) === 'summary')
  return asText(summaryCard && summaryCard.content)
}

function stripMirroredSummaryAssistantMessage(messages = [], cards = []) {
  const normalizedMessages = cloneArray(messages)
  const summaryContent = getAgentSummaryCardContent(cards)
  if (!summaryContent || !normalizedMessages.length) return normalizedMessages
  const lastMessage = normalizedMessages[normalizedMessages.length - 1]
  if (asText(lastMessage && lastMessage.role) !== 'assistant') return normalizedMessages
  if (asText(lastMessage && lastMessage.content) !== summaryContent) return normalizedMessages
  normalizedMessages.pop()
  return normalizedMessages
}

function toTimestamp(value) {
  if (!value) return 0
  const ts = Date.parse(String(value))
  return Number.isFinite(ts) ? ts : 0
}

function buildAgentPreviewCandidate(session = null) {
  if (!session || typeof session !== 'object') return ''
  const fields = [
    session.error,
    session.riskPrompt,
    session.clarificationQuestion,
  ]
  for (const field of fields) {
    const text = clampText(field, 120)
    if (text) return text
  }
  const summaryCardText = clampText(
    getAgentSummaryCardContent(session.cards || (session.output && session.output.cards) || []),
    120,
  )
  if (summaryCardText) return summaryCardText
  const messages = Array.isArray(session.messages) ? session.messages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    const text = clampText(item && item.content, 120)
    if (text) return text
  }
  return ''
}

function sortAgentSessions(sessions = []) {
  return [...(Array.isArray(sessions) ? sessions : [])].sort((left, right) => {
    const leftPinned = !!(left && left.isPinned)
    const rightPinned = !!(right && right.isPinned)
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1
    }

    const pinnedDiff = toTimestamp(right && right.pinnedAt) - toTimestamp(left && left.pinnedAt)
    if (pinnedDiff !== 0) return pinnedDiff

    const updatedDiff = toTimestamp(right && right.updatedAt) - toTimestamp(left && left.updatedAt)
    if (updatedDiff !== 0) return updatedDiff

    const createdDiff = toTimestamp(right && right.createdAt) - toTimestamp(left && left.createdAt)
    if (createdDiff !== 0) return createdDiff

    return asText(left && left.id).localeCompare(asText(right && right.id))
  })
}

function deriveAgentSessionTitle(messages = []) {
  const rows = Array.isArray(messages) ? messages : []
  const firstUserMessage = rows.find((item) => item && item.role === 'user' && asText(item.content))
  const raw = firstUserMessage ? asText(firstUserMessage.content) : ''
  return raw ? raw.slice(0, 24) : '新聊天'
}

function deriveAgentSessionPreview(session = null) {
  const text = buildAgentPreviewCandidate(session)
  return text ? text.slice(0, 120) : '开始一段新的分析对话'
}

function createAgentSessionRecord(seed = {}) {
  const nowIso = new Date().toISOString()
  const turn = normalizeAgentTurnPayload(seed)
  const messages = stripMirroredSummaryAssistantMessage(seed.messages, turn.output.cards)
  const titleSource = asText(seed.titleSource || seed.title_source || 'fallback') || 'fallback'
  const session = {
    id: asText(seed.id),
    title: clampText(seed.title, 60) || deriveAgentSessionTitle(messages),
    preview: clampText(seed.preview, 120),
    analysisFingerprint: asText(seed.analysisFingerprint || seed.analysis_fingerprint),
    updatedAt: asText(seed.updatedAt || nowIso),
    createdAt: asText(seed.createdAt || nowIso),
    pinnedAt: asText(seed.pinnedAt),
    status: asText(seed.status || 'idle'),
    stage: asText(seed.stage || turn.stage || 'gating'),
    input: String(seed.input || ''),
    output: cloneObject(turn.output),
    diagnostics: cloneObject(turn.diagnostics),
    contextSummary: cloneObject(turn.contextSummary),
    plan: cloneObject(turn.plan),
    cards: cloneArray(turn.output.cards),
    decision: normalizeAgentDecision(turn.output.decision),
    support: cloneArray(turn.output.support).map((item) => normalizeAgentDecisionEvidence(item)),
    counterpoints: cloneArray(turn.output.counterpoints).map((item) => normalizeAgentCounterpoint(item)),
    actions: cloneArray(turn.output.actions).map((item) => normalizeAgentAction(item)),
    boundary: cloneArray(turn.output.boundary).map((item) => normalizeAgentBoundaryItem(item)),
    executionTrace: cloneArray(turn.diagnostics.executionTrace),
    usedTools: cloneArray(turn.diagnostics.usedTools),
    citations: cloneArray(turn.diagnostics.citations),
    researchNotes: cloneArray(turn.diagnostics.researchNotes),
    auditIssues: cloneArray(turn.diagnostics.auditIssues),
    thinkingTimeline: cloneArray(turn.diagnostics.thinkingTimeline),
    nextSuggestions: cloneArray(turn.output.nextSuggestions),
    clarificationQuestion: String(turn.output.clarificationQuestion || ''),
    clarificationOptions: cloneArray(turn.output.clarificationOptions),
    riskPrompt: String(turn.output.riskPrompt || ''),
    error: String(turn.diagnostics.error || ''),
    riskConfirmations: cloneArray(seed.riskConfirmations || seed.risk_confirmations),
    panelPreloadNotes: normalizeAgentPanelPreloadNotes(seed.panelPreloadNotes),
    preloadedPanelKeys: cloneArray(seed.preloadedPanelKeys).map((item) => asText(item)).filter(Boolean),
    messages,
    panelPayloads: cloneObject(turn.output.panelPayloads),
    isPinned: !!seed.isPinned,
    persisted: !!seed.persisted,
    snapshotLoaded: !!seed.snapshotLoaded,
    titleSource,
  }
  if (!session.preview) {
    session.preview = deriveAgentSessionPreview(session)
  }
  if (!session.id) {
    session.id = `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
  return session
}

function createAgentSessionPlaceholderRecord(session = null) {
  const base = session && typeof session === 'object' ? session : {}
  return createAgentSessionRecord({
    ...base,
    input: '',
    cards: [],
    executionTrace: [],
    usedTools: [],
    citations: [],
    researchNotes: [],
    nextSuggestions: [],
    clarificationQuestion: '',
    clarificationOptions: [],
    riskPrompt: '',
    error: '',
    riskConfirmations: [],
    messages: [],
    output: {
      cards: [],
      clarificationQuestion: '',
      clarificationOptions: [],
      riskPrompt: '',
      nextSuggestions: [],
      panelPayloads: {},
      decision: { summary: '', mode: 'judgment', strength: 'weak', canAct: false },
      support: [],
      counterpoints: [],
      actions: [],
      boundary: [],
    },
    diagnostics: { executionTrace: [], usedTools: [], citations: [], researchNotes: [], auditIssues: [], thinkingTimeline: [], error: '' },
    contextSummary: {},
    plan: { steps: [], followupSteps: [], followupApplied: false, summary: '' },
    snapshotLoaded: false,
  })
}

function cloneAgentSessionRecord(session = null) {
  if (!session || typeof session !== 'object') return null
  return createAgentSessionRecord({
    ...session,
    cards: cloneArray(session.cards),
    executionTrace: cloneArray(session.executionTrace),
    usedTools: cloneArray(session.usedTools),
    citations: cloneArray(session.citations),
    researchNotes: cloneArray(session.researchNotes),
    thinkingTimeline: cloneArray(session.thinkingTimeline),
    nextSuggestions: cloneArray(session.nextSuggestions),
    riskConfirmations: cloneArray(session.riskConfirmations),
    panelPreloadNotes: normalizeAgentPanelPreloadNotes(session.panelPreloadNotes),
    preloadedPanelKeys: cloneArray(session.preloadedPanelKeys),
    messages: cloneArray(session.messages),
    panelPayloads: cloneObject(session.panelPayloads),
  })
}

function normalizeAgentSessionSummary(item = {}, existing = null) {
  const base = existing && typeof existing === 'object' ? existing : {}
  const session = createAgentSessionRecord({
    ...base,
    id: item.id,
    title: item.title,
    preview: item.preview,
    status: item.status || base.status || 'idle',
    createdAt: item.created_at || base.createdAt,
    updatedAt: item.updated_at || base.updatedAt,
    pinnedAt: item.pinned_at || '',
    isPinned: !!item.is_pinned,
    persisted: true,
    snapshotLoaded: !!base.snapshotLoaded,
    titleSource: item.title_source || base.titleSource || 'fallback',
    analysisFingerprint: item.analysis_fingerprint || base.analysisFingerprint || '',
  })
  return session
}

function createAgentRunState(seed = {}) {
  return {
    abortController: seed.abortController || null,
    loading: !!seed.loading,
    streamState: asText(seed.streamState || seed.stream_state || 'idle') || 'idle',
    startedAt: Number(seed.startedAt ?? seed.started_at ?? 0) || 0,
    elapsedTick: Number(seed.elapsedTick ?? seed.elapsed_tick ?? 0) || 0,
    elapsedTimer: seed.elapsedTimer || null,
    streamingMessageId: asText(seed.streamingMessageId || seed.streaming_message_id),
    reasoningBlocks: cloneArray(seed.reasoningBlocks).map((item) => ({
      id: asText(item && item.id) || 'agent-reasoning',
      phase: asText(item && item.phase),
      title: asText(item && item.title) || '模型思考',
      content: String((item && item.content) || ''),
      state: asText(item && item.state) || 'active',
    })),
    panelPreloadNotes: normalizeAgentPanelPreloadNotes(seed.panelPreloadNotes),
    preloadedPanelKeys: cloneArray(seed.preloadedPanelKeys).map((item) => asText(item)).filter(Boolean),
    pendingQuestion: String(seed.pendingQuestion || ''),
  }
}

function normalizeAgentToolSummary(item = {}) {
  return {
    name: asText(item.name),
    description: asText(item.description),
    category: asText(item.category),
    layer: asText(item.layer),
    uiTier: asText(item.uiTier || item.ui_tier || 'foundation') || 'foundation',
    dataDomain: asText(item.dataDomain || item.data_domain || 'general') || 'general',
    capabilityType: asText(item.capabilityType || item.capability_type || 'none') || 'none',
    sceneType: asText(item.sceneType || item.scene_type || 'general') || 'general',
    llmExposure: asText(item.llmExposure || item.llm_exposure || 'secondary') || 'secondary',
    toolkitId: asText(item.toolkitId || item.toolkit_id),
    defaultPolicyKey: asText(item.defaultPolicyKey || item.default_policy_key),
    evidenceContract: cloneArray(item.evidenceContract || item.evidence_contract).map((entry) => asText(entry)).filter(Boolean),
    applicableScenarios: cloneArray(item.applicableScenarios || item.applicable_scenarios).map((entry) => asText(entry)).filter(Boolean),
    cautions: cloneArray(item.cautions).map((entry) => asText(entry)).filter(Boolean),
    requires: cloneArray(item.requires).map((entry) => asText(entry)).filter(Boolean),
    produces: cloneArray(item.produces).map((entry) => asText(entry)).filter(Boolean),
    inputSchema: item && typeof item.inputSchema === 'object' ? item.inputSchema : (item.input_schema && typeof item.input_schema === 'object' ? item.input_schema : {}),
    outputSchema: item && typeof item.outputSchema === 'object' ? item.outputSchema : (item.output_schema && typeof item.output_schema === 'object' ? item.output_schema : {}),
    readonly: !!item.readonly,
    costLevel: asText(item.costLevel || item.cost_level || 'safe') || 'safe',
    riskLevel: asText(item.riskLevel || item.risk_level || 'safe') || 'safe',
    timeoutSec: Number(item.timeoutSec ?? item.timeout_sec ?? 0) || 0,
    cacheable: !!item.cacheable,
  }
}

function createAnalysisAgentInitialState() {
  return {
    agentWorkspaceView: 'chat',
    agentConversationId: '',
    agentInput: '',
    agentLoading: false,
    agentStatus: 'idle',
    agentStage: 'gating',
    agentCards: [],
    agentDecision: { summary: '', mode: 'judgment', strength: 'weak', canAct: false },
    agentSupport: [],
    agentCounterpoints: [],
    agentActions: [],
    agentBoundary: [],
    agentExecutionTrace: [],
    agentUsedTools: [],
    agentCitations: [],
    agentResearchNotes: [],
    agentAuditIssues: [],
    agentNextSuggestions: [],
    agentPanelPayloads: {},
    agentClarificationQuestion: '',
    agentClarificationOptions: [],
    agentClarificationDraft: '',
    agentClarificationSubmitting: false,
    agentRiskPrompt: '',
    agentError: '',
    agentContextSummary: {},
    agentPlan: { steps: [], followupSteps: [], followupApplied: false, summary: '' },
    agentPlanExpanded: true,
    agentPanelPreloadNotes: [],
    agentPreloadedPanelKeys: [],
    agentRiskConfirmations: [],
    agentMessages: [],
    agentThinkingTimeline: [],
    agentReasoningBlocks: [],
    agentStreamingMessageId: '',
    agentStreamState: 'idle',
    agentStreamStartedAt: 0,
    agentStreamElapsedTick: 0,
    agentStreamElapsedTimer: null,
    agentThinkingExpanded: false,
    agentSessions: [],
    activeAgentSessionId: '',
    agentSessionsLoaded: false,
    agentSessionsLoading: false,
    agentSessionHydrating: false,
    agentSessionDetailLoadingId: '',
    agentSessionDetailRequestToken: 0,
    agentTurnAbortController: null,
    agentRunRegistry: {},
    agentSessionMenuId: '',
    agentRenameDialogOpen: false,
    agentRenameSessionId: '',
    agentRenameInput: '',
    agentTools: [],
    agentToolsLoaded: false,
    agentToolsLoading: false,
    agentToolsError: '',
  }
}

function createAnalysisAgentSessionMethods() {
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
    getAgentRunState(sessionId = '') {
      const nextId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!nextId) return null
      const registry = cloneRecordMap(this.agentRunRegistry)
      const current = registry[nextId]
      return current ? createAgentRunState(current) : null
    },
    setAgentRunState(sessionId = '', patch = {}) {
      const nextId = asText(sessionId)
      if (!nextId) return null
      const registry = cloneRecordMap(this.agentRunRegistry)
      const current = registry[nextId] ? createAgentRunState(registry[nextId]) : createAgentRunState()
      const nextState = createAgentRunState({ ...current, ...patch })
      this.agentRunRegistry = {
        ...registry,
        [nextId]: nextState,
      }
      if (nextId === asText(this.activeAgentSessionId)) {
        this.syncActiveAgentRuntimeView(nextId)
      }
      return nextState
    },
    clearAgentRunState(sessionId = '', options = {}) {
      const nextId = asText(sessionId)
      if (!nextId) return
      const registry = cloneRecordMap(this.agentRunRegistry)
      const current = registry[nextId] ? createAgentRunState(registry[nextId]) : null
      if (current && current.elapsedTimer && typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
        window.clearInterval(current.elapsedTimer)
      }
      if (current && options.abort && current.abortController) {
        try {
          current.abortController.abort()
        } catch (_) {
          // Ignore abort errors from already-settled controllers.
        }
      }
      delete registry[nextId]
      this.agentRunRegistry = registry
      if (nextId === asText(this.activeAgentSessionId)) {
        this.syncActiveAgentRuntimeView(nextId)
      }
    },
    destroyAllAgentRuns() {
      Object.keys(cloneRecordMap(this.agentRunRegistry)).forEach((sessionId) => {
        this.clearAgentRunState(sessionId, { abort: true })
      })
      this.agentRunRegistry = {}
      this.agentTurnAbortController = null
    },
    isAgentSessionRunning(sessionId = '') {
      const runState = this.getAgentRunState(sessionId)
      return !!(runState && runState.loading)
    },
    getRunningAgentSessionCount() {
      return Object.values(cloneRecordMap(this.agentRunRegistry))
        .map((entry) => createAgentRunState(entry))
        .filter((entry) => entry.loading)
        .length
    },
    getAgentRunningBadgeText() {
      const count = this.getRunningAgentSessionCount()
      if (count <= 0) return ''
      return count > 1 ? String(count) : '运行中'
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
      this.agentClarificationQuestion = String(session.clarificationQuestion || '')
      this.agentClarificationOptions = cloneArray(session.clarificationOptions)
      this.agentClarificationDraft = ''
      this.agentClarificationSubmitting = false
      this.agentRiskPrompt = String(session.riskPrompt || '')
      this.agentError = String(session.error || '')
      this.agentContextSummary = cloneObject(session.contextSummary)
      this.agentPlan = normalizeAgentPlanEnvelope(session.plan)
      this.agentPlanExpanded = this.agentPlan.steps.length || this.agentPlan.followupSteps.length
        ? true
        : !!this.agentPlanExpanded
      this.agentRiskConfirmations = cloneArray(session.riskConfirmations)
      this.agentMessages = cloneArray(session.messages)
      this.agentThinkingTimeline = cloneArray(session.thinkingTimeline)
      this.agentLoading = false
      this.agentReasoningBlocks = []
      this.agentStreamingMessageId = ''
      this.agentStreamState = 'idle'
      this.agentStreamStartedAt = 0
      this.agentStreamElapsedTick = 0
      this.agentStreamElapsedTimer = null
      this.agentPanelPreloadNotes = normalizeAgentPanelPreloadNotes(session.panelPreloadNotes)
      this.agentPreloadedPanelKeys = cloneArray(session.preloadedPanelKeys)
      this.agentThinkingExpanded = ['failed', 'requires_risk_confirmation'].includes(this.agentStatus) && this.agentThinkingTimeline.length > 0
      if (!options.keepDetailLoadingId) {
        this.agentSessionDetailLoadingId = ''
      }
      this.closeAgentSessionMenu()
      this.syncActiveAgentRuntimeView(session.id)
    },
    syncActiveAgentRuntimeView(sessionId = '') {
      const nextId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!nextId) {
        this.agentLoading = false
        this.agentStreamState = 'idle'
        this.agentStreamStartedAt = 0
        this.agentStreamElapsedTick = 0
        this.agentStreamElapsedTimer = null
        this.agentStreamingMessageId = ''
        this.agentReasoningBlocks = []
        this.agentPanelPreloadNotes = []
        this.agentPreloadedPanelKeys = []
        this.agentPanelPayloads = {}
        this.agentTurnAbortController = null
        return
      }
      const runState = this.getAgentRunState(nextId)
      if (!runState) {
        const session = this.findAgentSession(nextId)
        const shouldPreserveElapsed = !!(
          session
          && ['answered', 'failed', 'requires_risk_confirmation'].includes(asText(session.status))
          && Number(this.agentStreamStartedAt || 0) > 0
        )
        const shouldPreserveReasoning = !!(
          session
          && ['answered', 'failed', 'requires_risk_confirmation'].includes(asText(session.status))
          && Array.isArray(this.agentReasoningBlocks)
          && this.agentReasoningBlocks.length > 0
        )
        this.agentLoading = false
        this.agentStreamState = 'idle'
        if (!shouldPreserveElapsed) {
          this.agentStreamStartedAt = 0
          this.agentStreamElapsedTick = 0
        }
        this.agentStreamElapsedTimer = null
        this.agentStreamingMessageId = ''
        if (!shouldPreserveReasoning) {
          this.agentReasoningBlocks = []
        }
      this.agentPanelPreloadNotes = normalizeAgentPanelPreloadNotes(session && session.panelPreloadNotes)
      this.agentPreloadedPanelKeys = cloneArray(session && session.preloadedPanelKeys)
      this.agentPanelPayloads = cloneObject(session && session.panelPayloads)
        this.agentTurnAbortController = null
        return
      }
      this.agentLoading = !!runState.loading
      this.agentStreamState = asText(runState.streamState || 'idle') || 'idle'
      this.agentStreamStartedAt = Number(runState.startedAt || 0) || 0
      this.agentStreamElapsedTick = Number(runState.elapsedTick || runState.startedAt || 0) || 0
      this.agentStreamElapsedTimer = runState.elapsedTimer || null
      this.agentStreamingMessageId = asText(runState.streamingMessageId)
      this.agentReasoningBlocks = cloneArray(runState.reasoningBlocks)
      this.agentPanelPreloadNotes = normalizeAgentPanelPreloadNotes(runState.panelPreloadNotes)
      this.agentPreloadedPanelKeys = cloneArray(runState.preloadedPanelKeys)
      this.agentTurnAbortController = runState.abortController || null
      if (runState.loading && (this.agentThinkingTimeline.length || this.agentReasoningBlocks.length)) {
        this.agentThinkingExpanded = true
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
      const existing = this.findAgentSession(activeId)
      const messages = cloneArray(this.agentMessages)
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
          panelPayloads: this.agentPanelPayloads,
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
        panelPreloadNotes: this.agentPanelPreloadNotes,
        preloadedPanelKeys: this.agentPreloadedPanelKeys,
        panelPayloads: this.agentPanelPayloads,
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
    getAgentSessionTitle(session = null) {
      if (!session || typeof session !== 'object') return '新聊天'
      return clampText(session.title, 60) || '新聊天'
    },
    getAgentSessionPreview(session = null) {
      if (!session || typeof session !== 'object') return '开始一段新的分析对话'
      return clampText(session.preview, 120) || '开始一段新的分析对话'
    },
    agentHasConversationContent() {
      return Boolean(
        (Array.isArray(this.agentMessages) && this.agentMessages.length)
        || (Array.isArray(this.agentCards) && this.agentCards.length)
        || this.agentError
        || this.agentClarificationQuestion
        || this.agentRiskPrompt,
      )
    },
    queueAgentPrompt(prompt = '') {
      const text = String(prompt || '').trim()
      this.openAgentPanel()
      this.agentWorkspaceView = 'chat'
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
        area_character: '区域调性',
        site_selection: '建店选址',
        vitality: '活力评估',
        tod: 'TOD/站城',
        livability: '居住适宜性',
        facility_gap: '公服缺口',
        renewal_priority: '更新优先级',
        primary: '主入口',
        secondary: '次级',
        hidden: '隐藏',
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
    resetAgentStreamingState(sessionId = '') {
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      this.stopAgentThinkingTimer(targetSessionId)
      if (!targetSessionId) {
        this.agentThinkingTimeline = []
        this.agentReasoningBlocks = []
        this.agentStreamingMessageId = ''
        this.agentStreamState = 'idle'
        this.agentStreamStartedAt = 0
        this.agentStreamElapsedTick = 0
        this.agentThinkingExpanded = false
        this.agentPlanExpanded = true
        this.agentPanelPreloadNotes = []
        this.agentPreloadedPanelKeys = []
        return
      }
      this.setAgentRunState(targetSessionId, {
        loading: false,
        streamState: 'idle',
        startedAt: 0,
        elapsedTick: 0,
        streamingMessageId: '',
        reasoningBlocks: [],
        panelPreloadNotes: [],
        preloadedPanelKeys: [],
        pendingQuestion: '',
      })
    },
    startAgentThinkingTimer(sessionId = '') {
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!targetSessionId) {
        this.agentStreamStartedAt = Date.now()
        this.agentStreamElapsedTick = this.agentStreamStartedAt
        if (typeof window === 'undefined' || typeof window.setInterval !== 'function') {
          return
        }
        this.agentStreamElapsedTimer = window.setInterval(() => {
          this.agentStreamElapsedTick = Date.now()
          this.updateAgentWaitingProcessFallback()
        }, 1000)
        return
      }
      this.stopAgentThinkingTimer(targetSessionId)
      const startedAt = Date.now()
      let timer = null
      if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
        timer = window.setInterval(() => {
          const nextTick = Date.now()
          this.setAgentRunState(targetSessionId, { elapsedTick: nextTick })
          this.updateAgentWaitingProcessFallback(targetSessionId)
        }, 1000)
      }
      this.setAgentRunState(targetSessionId, {
        startedAt,
        elapsedTick: startedAt,
        elapsedTimer: timer,
      })
    },
    stopAgentThinkingTimer(sessionId = '') {
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!targetSessionId) {
        const timer = this.agentStreamElapsedTimer
        if (timer && typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
          window.clearInterval(timer)
        }
        if (timer && this.agentStreamStartedAt) {
          this.agentStreamElapsedTick = Date.now()
        }
        this.agentStreamElapsedTimer = null
        return
      }
      const runState = this.getAgentRunState(targetSessionId)
      if (!runState) return
      const timer = runState.elapsedTimer
      if (timer && typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
        window.clearInterval(timer)
      }
      const nextElapsedTick = runState.startedAt ? Date.now() : Number(runState.elapsedTick || 0) || 0
      this.setAgentRunState(targetSessionId, {
        elapsedTimer: null,
        elapsedTick: nextElapsedTick,
      })
    },
    upsertAgentThinkingItem(seed = {}) {
      const item = normalizeAgentThinkingItem(seed)
      this.agentThinkingTimeline = upsertThinkingItemInList(this.agentThinkingTimeline, item)
      return item
    },
    upsertAgentTraceThinkingItem(seed = {}) {
      return this.upsertAgentThinkingItem(normalizeAgentTraceThinkingItem(seed))
    },
    upsertAgentReasoningDelta(seed = {}) {
      const item = normalizeAgentReasoningDelta(seed)
      this.agentReasoningBlocks = upsertReasoningDeltaInList(this.agentReasoningBlocks, item)
      return item
    },
    clearAgentReasoningBlocks() {
      this.agentReasoningBlocks = []
    },
    scrollAgentThreadToLatest() {
      const run = () => {
        const refs = this.$refs && typeof this.$refs === 'object' ? this.$refs : {}
        const target = refs.agentChatBody
        if (!target) return
        const el = Array.isArray(target) ? target[0] : target
        if (!el) return
        const nextTop = Number(el.scrollHeight || 0)
        if (typeof el.scrollTo === 'function') {
          el.scrollTo({ top: nextTop, behavior: 'smooth' })
        } else {
          el.scrollTop = nextTop
        }
      }
      if (typeof this.$nextTick === 'function') {
        this.$nextTick(run)
        return
      }
      run()
    },
    agentShouldRenderThinkingBlock() {
      return !!(
        this.agentLoading
        || (Array.isArray(this.agentThinkingTimeline) && this.agentThinkingTimeline.length)
        || (Array.isArray(this.agentReasoningBlocks) && this.agentReasoningBlocks.length)
      )
    },
    getAgentThinkingStatusLabel() {
      if (this.agentLoading) return '思考中...'
      if (this.agentStreamState === 'failed') return '思考失败'
      if (this.agentThinkingTimeline.length) return '已思考'
      if (this.getAgentVisibleReasoningBlocks().length) return '已思考'
      return '处理中'
    },
    getAgentVisibleProcessSteps() {
      const steps = cloneArray(this.agentThinkingTimeline)
        .map((item) => normalizeAgentThinkingItem(item))
        .filter((item) => item.id !== 'stream-connect')
      const hasBackendStep = steps.some((item) => item.id && !item.id.startsWith('frontend-'))
      if (!hasBackendStep) return steps
      return steps.filter((item) => !item.id.startsWith('frontend-wait-'))
    },
    getAgentVisibleReasoningBlocks() {
      return cloneArray(this.agentReasoningBlocks)
        .map((item) => ({
          id: asText(item && item.id) || 'agent-reasoning',
          phase: asText(item && item.phase),
          title: asText(item && item.title) || '模型思考',
          content: String((item && item.content) || ''),
          state: asText(item && item.state) || 'active',
        }))
        .filter((item) => item.content || item.state === 'active')
    },
    markAgentSubmitProcessReady() {
      if (!Array.isArray(this.agentThinkingTimeline) || !this.agentThinkingTimeline.length) return
      const hasSubmitStep = this.agentThinkingTimeline.some((item) => asText(item && item.id) === 'frontend-submit-request')
      if (!hasSubmitStep) return
      this.upsertAgentThinkingItem(normalizeAgentSubmitThinkingItem('completed'))
    },
    completeAgentActiveProcessSteps(excludeId = '') {
      this.agentThinkingTimeline = completeActiveThinkingItemsInList(this.agentThinkingTimeline, excludeId)
    },
    updateAgentWaitingProcessFallback(sessionId = '') {
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!targetSessionId) {
        if (!this.agentLoading || this.agentStreamState !== 'connecting') return
        const startedAt = Number(this.agentStreamStartedAt || 0)
        if (!startedAt) return
        const hasBackendStep = cloneArray(this.agentThinkingTimeline)
          .some((item) => {
            const id = asText(item && item.id)
            return id && id !== 'stream-connect' && !id.startsWith('frontend-')
          })
        if (hasBackendStep) return
        const elapsedSeconds = Math.floor((Number(this.agentStreamElapsedTick || Date.now()) - startedAt) / 1000)
        if (elapsedSeconds < 3) return
        this.markAgentSubmitProcessReady()
        const item = normalizeAgentWaitingThinkingItem(elapsedSeconds)
        this.completeAgentActiveProcessSteps(item.id)
        this.upsertAgentThinkingItem(item)
        return
      }
      const runState = this.getAgentRunState(targetSessionId)
      if (!runState || !runState.loading || runState.streamState !== 'connecting') return
      const startedAt = Number(runState.startedAt || 0)
      if (!startedAt) return
      const session = this.findAgentSession(targetSessionId)
      if (!session) return
      const hasBackendStep = cloneArray(session.thinkingTimeline)
        .some((item) => {
          const id = asText(item && item.id)
          return id && id !== 'stream-connect' && !id.startsWith('frontend-')
        })
      if (hasBackendStep) return
      const elapsedSeconds = Math.floor((Number(runState.elapsedTick || Date.now()) - startedAt) / 1000)
      if (elapsedSeconds < 3) return
      let nextTimeline = cloneArray(session.thinkingTimeline)
      const submitItem = normalizeAgentSubmitThinkingItem('completed')
      const hasSubmitStep = nextTimeline.some((item) => asText(item && item.id) === 'frontend-submit-request')
      if (hasSubmitStep) {
        nextTimeline = upsertThinkingItemInList(nextTimeline, submitItem)
      }
      const item = normalizeAgentWaitingThinkingItem(elapsedSeconds)
      nextTimeline = completeActiveThinkingItemsInList(nextTimeline, item.id)
      nextTimeline = upsertThinkingItemInList(nextTimeline, item)
      this.updateAgentSessionSnapshot(targetSessionId, (current) => ({
        ...current,
        thinkingTimeline: nextTimeline,
        status: 'running',
      }))
      if (targetSessionId === asText(this.activeAgentSessionId)) {
        this.scrollAgentThreadToLatest()
      }
    },
    getAgentThinkingElapsedLabel() {
      const startedAt = Number(this.agentStreamStartedAt || 0)
      if (!startedAt) return ''
      const tick = Number(this.agentStreamElapsedTick || Date.now())
      const seconds = Math.max(1, Math.floor((tick - startedAt) / 1000))
      return `${seconds}s`
    },
    toggleAgentThinkingExpanded() {
      this.agentThinkingExpanded = !this.agentThinkingExpanded
    },
    toggleAgentPlanExpanded() {
      this.agentPlanExpanded = !this.agentPlanExpanded
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
      const ready = typeof this.ensureH3ReadyForAgentTarget === 'function'
        ? await this.ensureH3ReadyForAgentTarget(this.getAgentActivePanelPayloads(), {
          allowCompute: true,
          targetCategory: asText((this.getAgentActivePanelPayloads().h3_result || {}).ui && (this.getAgentActivePanelPayloads().h3_result || {}).ui.target_category),
        })
        : false
      if (ready && typeof this.focusGridByH3Id === 'function') {
        this.focusGridByH3Id(h3Id)
      }
    },
    resolvePanelPreloadTarget(trace = {}) {
      const toolName = asText(trace.tool_name || trace.toolName)
      const artifacts = normalizeAgentProducedArtifacts(trace)
      const hasArtifact = (expected) => artifacts.includes(expected)
      if (
        toolName === 'fetch_pois_in_scope'
        || hasArtifact('current_pois')
        || hasArtifact('current_poi_summary')
      ) {
        return { key: 'poi', label: '已预加载 POI 面板内容' }
      }
      if (
        toolName === 'compute_h3_metrics_from_scope_and_pois'
        || toolName === 'read_h3_structure_analysis'
        || hasArtifact('current_h3_structure_analysis')
        || hasArtifact('current_h3_metrics')
      ) {
        return { key: 'h3', label: '已预加载 H3 面板内容' }
      }
      if (
        toolName === 'compute_population_overview_from_scope'
        || toolName === 'read_population_profile_analysis'
        || hasArtifact('current_population_profile_analysis')
        || hasArtifact('population_overview')
      ) {
        return { key: 'population', label: '已预加载人口面板数据' }
      }
      if (
        toolName === 'compute_nightlight_overview_from_scope'
        || toolName === 'read_nightlight_pattern_analysis'
        || hasArtifact('current_nightlight_pattern_analysis')
        || hasArtifact('nightlight_overview')
      ) {
        return { key: 'nightlight', label: '已预加载夜光面板数据' }
      }
      if (
        toolName === 'compute_road_syntax_from_scope'
        || toolName === 'read_road_pattern_analysis'
        || hasArtifact('current_road_pattern_analysis')
        || hasArtifact('road_syntax_summary')
      ) {
        return { key: 'syntax', label: '已预加载路网面板展示' }
      }
      return null
    },
    hasAgentPreloadedPanel(key = '', sessionId = '') {
      const targetKey = asText(key)
      if (!targetKey) return false
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!targetSessionId) return cloneArray(this.agentPreloadedPanelKeys).includes(targetKey)
      const runState = this.getAgentRunState(targetSessionId)
      if (!runState) return cloneArray(this.agentPreloadedPanelKeys).includes(targetKey)
      return cloneArray(runState.preloadedPanelKeys).includes(targetKey)
    },
    recordAgentPanelPreload(target = null, sessionId = '') {
      const key = asText(target && target.key)
      const label = asText(target && target.label)
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      if (!key || !label) return
      if (!targetSessionId) {
        if (this.hasAgentPreloadedPanel(key)) return
        this.agentPreloadedPanelKeys = [...cloneArray(this.agentPreloadedPanelKeys), key]
        this.agentPanelPreloadNotes = [
          ...normalizeAgentPanelPreloadNotes(this.agentPanelPreloadNotes),
          { key, label },
        ]
        return
      }
      if (this.hasAgentPreloadedPanel(key, targetSessionId)) return
      const runState = this.getAgentRunState(targetSessionId) || createAgentRunState()
      const nextPanelPreloadNotes = [
        ...normalizeAgentPanelPreloadNotes(runState.panelPreloadNotes),
        { key, label },
      ]
      const nextPreloadedPanelKeys = [...cloneArray(runState.preloadedPanelKeys), key]
      this.setAgentRunState(targetSessionId, {
        panelPreloadNotes: nextPanelPreloadNotes,
        preloadedPanelKeys: nextPreloadedPanelKeys,
      })
      this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
        ...session,
        panelPreloadNotes: nextPanelPreloadNotes,
        preloadedPanelKeys: nextPreloadedPanelKeys,
      }))
    },
    async preloadAgentPanelContent(target = null) {
      const key = asText(target && target.key)
      if (!key) return false
      if (key === 'poi') {
        if (typeof this.updatePoiCharts === 'function') {
          this.updatePoiCharts()
        }
        if (typeof this.resizePoiChart === 'function') {
          if (typeof this.$nextTick === 'function') {
            this.$nextTick(() => {
              this.resizePoiChart()
            })
          } else {
            this.resizePoiChart()
          }
        }
        return true
      }
      if (key === 'h3') {
        if (typeof this.ensureH3ReadyForAgentTarget === 'function') {
          const restored = await this.ensureH3ReadyForAgentTarget(this.getAgentActivePanelPayloads(), { allowCompute: false })
          if (!restored && typeof this.ensureH3PanelEntryState === 'function') {
            this.ensureH3PanelEntryState()
          }
        } else if (typeof this.ensureH3PanelEntryState === 'function') {
          this.ensureH3PanelEntryState()
        }
        if (typeof this.restoreH3GridDisplayOnEnter === 'function') {
          this.restoreH3GridDisplayOnEnter()
        }
        if (typeof this.updateH3Charts === 'function') {
          this.updateH3Charts()
        }
        if (typeof this.updateDecisionCards === 'function') {
          this.updateDecisionCards()
        }
        return true
      }
      if (key === 'population') {
        if (typeof this.ensurePopulationPanelEntryState === 'function') {
          await this.ensurePopulationPanelEntryState()
          return true
        }
        return false
      }
      if (key === 'nightlight') {
        if (typeof this.ensureNightlightPanelEntryState === 'function') {
          await this.ensureNightlightPanelEntryState()
          return true
        }
        return false
      }
      if (key === 'syntax') {
        if (!this.roadSyntaxSummary) return false
        const metricTabs = (typeof this.roadSyntaxMetricTabs === 'function')
          ? this.roadSyntaxMetricTabs().map((tab) => asText(tab && tab.value)).filter(Boolean)
          : ['connectivity', 'control', 'depth', 'choice', 'integration', 'intelligibility']
        const defaultMetric = typeof this.roadSyntaxDefaultMetric === 'function'
          ? asText(this.roadSyntaxDefaultMetric())
          : 'connectivity'
        const preferredMetric = asText(this.roadSyntaxLastMetricTab || this.roadSyntaxMetric || defaultMetric)
        const targetMetric = metricTabs.includes(preferredMetric) ? preferredMetric : defaultMetric
        if (typeof this.setRoadSyntaxMainTab === 'function') {
          this.setRoadSyntaxMainTab(targetMetric, { refresh: false, syncMetric: true })
        }
        if (typeof this.renderRoadSyntaxByMetric === 'function') {
          await this.renderRoadSyntaxByMetric(targetMetric)
        }
        return true
      }
      return false
    },
    async maybePreloadPanelForAgentTool(trace = {}, sessionId = '') {
      const targetSessionId = asText(sessionId || this.activeAgentSessionId || this.agentConversationId)
      const normalizedTrace = cloneObject(trace)
      const status = asText(normalizedTrace.status)
      if (status !== 'success') return false
      const target = this.resolvePanelPreloadTarget(normalizedTrace)
      if (!target) return false
      if (targetSessionId && this.hasAgentPreloadedPanel(target.key, targetSessionId)) return false
      if (!targetSessionId && this.hasAgentPreloadedPanel(target.key)) return false
      try {
        const didPreload = await this.preloadAgentPanelContent(target)
        if (!didPreload) return false
        this.recordAgentPanelPreload(target, targetSessionId)
        return true
      } catch (err) {
        console.warn(`Agent panel preload failed for ${target.key}`, err)
        return false
      }
    },
    buildAgentAnalysisFingerprint() {
      const scope = this.getIsochronePolygonPayload()
      const drawnScope = (typeof this.getDrawnScopePolygonPoints === 'function') ? this.getDrawnScopePolygonPoints() : []
      const scopeForFingerprint = Array.isArray(scope) && scope.length >= 3 ? scope : drawnScope
      if (!Array.isArray(scopeForFingerprint) || scopeForFingerprint.length < 3) return ''
      return `scope:${stableAgentHash(scopeForFingerprint)}`
    },
    buildAgentAnalysisSnapshot() {
      const pois = Array.isArray(this.allPoisDetails) ? this.allPoisDetails.slice(0, 500) : []
      const poiTotal = Array.isArray(this.allPoisDetails) ? this.allPoisDetails.length : 0
      const populationSummary = (this.populationOverview && this.populationOverview.summary) || {}
      const nightlightSummary = (this.nightlightOverview && this.nightlightOverview.summary) || {}
      const h3Summary = this.h3AnalysisSummary || {}
      const roadSummary = this.roadSyntaxSummary || {}
      const isochroneFeature = typeof this._normalizeIsochroneFeatureForExport === 'function'
        ? this._normalizeIsochroneFeatureForExport()
        : null
      const frontendAnalysis = typeof this._buildFrontendAnalysisForExport === 'function'
        ? this._buildFrontendAnalysisForExport()
        : {}
      return {
        context: {
          mode: this.transportMode || 'walking',
          time_min: Number(this.timeHorizon || 0) || 0,
          source: this.resultDataSource || this.poiDataSource || '',
          scope_source: this.scopeSource || '',
        },
        scope: {
          polygon: this.getIsochronePolygonPayload(),
          drawn_polygon: (typeof this.getDrawnScopePolygonPoints === 'function') ? this.getDrawnScopePolygonPoints() : [],
          isochrone_feature: isochroneFeature,
        },
        pois,
        poi_summary: {
          total: poiTotal,
          source: this.resultDataSource || this.poiDataSource || '',
        },
        h3: {
          summary: h3Summary,
          charts: this.h3AnalysisCharts || {},
          grid_count: Number(h3Summary.grid_count || this.h3GridCount || 0),
        },
        road: {
          summary: roadSummary,
          diagnostics: this.roadSyntaxDiagnostics || {},
        },
        population: {
          summary: populationSummary,
        },
        nightlight: {
          summary: nightlightSummary,
        },
        frontend_analysis: frontendAnalysis,
        active_panel: String(this.activeStep3Panel || ''),
        current_filters: {
          poi_source: this.poiDataSource || '',
          h3_resolution: Number(this.h3GridResolution || 0) || 0,
          h3_neighbor_ring: Number(this.h3NeighborRing || 0) || 0,
          road_metric: String(this.roadSyntaxMetric || ''),
          population_view: String(this.populationAnalysisView || ''),
          nightlight_view: String(this.nightlightAnalysisView || ''),
        },
      }
    },
    extractAgentRiskToolName(prompt = '') {
      const match = String(prompt || '').match(/`([^`]+)`/)
      return match ? String(match[1] || '').trim() : ''
    },
    buildAgentSessionRequestPayload(session = null, overrides = {}) {
      const current = session || this.syncCurrentAgentSession() || this.findAgentSession(this.activeAgentSessionId)
      const merged = {
        ...(current || {}),
        ...overrides,
      }
      const messages = cloneArray(merged.messages)
      const titleSource = asText(merged.titleSource) || 'fallback'
      const title = ['user', 'ai'].includes(titleSource)
        ? (clampText(merged.title, 60) || deriveAgentSessionTitle(messages))
        : (clampText(merged.title, 60) || deriveAgentSessionTitle(messages))
      return {
        title,
        analysis_fingerprint: asText(merged.analysisFingerprint) || this.getCurrentAgentAnalysisFingerprint(),
        preview: clampText(merged.preview, 120) || deriveAgentSessionPreview(merged),
        status: asText(merged.status || 'idle') || 'idle',
        stage: asText(merged.stage || 'gating') || 'gating',
        is_pinned: Object.prototype.hasOwnProperty.call(overrides || {}, 'isPinned')
          ? !!overrides.isPinned
          : !!merged.isPinned,
        input: String(merged.input || ''),
        messages: messages.map((item) => ({
          role: asText(item && item.role) || 'user',
          content: String((item && item.content) || ''),
        })),
        output: {
          cards: cloneArray(merged.cards),
          clarification_question: String(merged.clarificationQuestion || ''),
          clarification_options: cloneArray(merged.clarificationOptions).map((item) => asText(item)).filter(Boolean),
          risk_prompt: String(merged.riskPrompt || ''),
          next_suggestions: cloneArray(merged.nextSuggestions),
          panel_payloads: cloneObject(merged.panelPayloads),
          decision: {
            summary: asText(merged.decision && merged.decision.summary),
            mode: asText(merged.decision && merged.decision.mode) || 'judgment',
            strength: asText(merged.decision && merged.decision.strength) || 'weak',
            can_act: !!(merged.decision && merged.decision.canAct),
          },
          support: cloneArray(merged.support).map((item) => ({
            key: asText(item && item.key),
            metric: asText(item && item.metric),
            headline: asText(item && item.headline),
            value: item && Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : null,
            interpretation: asText(item && item.interpretation),
            source: asText(item && item.source),
            confidence: asText(item && item.confidence) || 'weak',
            limitation: asText(item && item.limitation),
            supports: cloneArray(item && item.supports).map((entry) => asText(entry)).filter(Boolean),
            is_key: !!(item && item.isKey),
          })),
          counterpoints: cloneArray(merged.counterpoints).map((item) => ({
            kind: asText(item && item.kind) || 'boundary',
            title: asText(item && item.title),
            detail: asText(item && item.detail),
          })),
          actions: cloneArray(merged.actions).map((item) => ({
            title: asText(item && item.title),
            detail: asText(item && item.detail),
            condition: asText(item && item.condition),
            target: asText(item && item.target),
            prompt: asText(item && item.prompt),
          })),
          boundary: cloneArray(merged.boundary).map((item) => ({
            title: asText(item && item.title),
            detail: asText(item && item.detail),
          })),
        },
        diagnostics: {
          execution_trace: cloneArray(merged.executionTrace),
          used_tools: cloneArray(merged.usedTools),
          citations: cloneArray(merged.citations),
          research_notes: cloneArray(merged.researchNotes),
          audit_issues: cloneArray(merged.auditIssues),
          planning_summary: String((merged.diagnostics && merged.diagnostics.planningSummary) || (merged.plan && merged.plan.summary) || ''),
          audit_summary: String((merged.diagnostics && merged.diagnostics.auditSummary) || ''),
          replan_count: Number((merged.diagnostics && merged.diagnostics.replanCount) || 0) || 0,
          thinking_timeline: cloneArray(merged.thinkingTimeline),
          error: String(merged.error || ''),
        },
        context_summary: cloneObject(merged.contextSummary),
        plan: {
          steps: cloneArray(merged.plan && merged.plan.steps),
          followup_steps: cloneArray(merged.plan && merged.plan.followupSteps),
          followup_applied: !!(merged.plan && merged.plan.followupApplied),
          summary: String((merged.plan && merged.plan.summary) || ''),
        },
        risk_confirmations: cloneArray(merged.riskConfirmations),
      }
    },
    async putAgentSession(sessionId = '', overrides = {}) {
      const nextId = asText(sessionId)
      if (!nextId) {
        throw new Error('missing agent session id')
      }
      const session = this.findAgentSession(nextId)
      const body = this.buildAgentSessionRequestPayload(session, overrides)
      const res = await fetch(`/api/v1/analysis/agent/sessions/${encodeURIComponent(nextId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(`/api/v1/analysis/agent/sessions/${nextId} PUT 失败(${res.status})`)
      }
      const detail = await res.json()
      return this.mergeAgentSessionDetail(detail)
    },
    async patchAgentSessionMetadata(sessionId = '', payload = {}) {
      const nextId = asText(sessionId)
      if (!nextId) {
        throw new Error('missing agent session id')
      }
      const res = await fetch(`/api/v1/analysis/agent/sessions/${encodeURIComponent(nextId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(`/api/v1/analysis/agent/sessions/${nextId} PATCH 失败(${res.status})`)
      }
      const detail = await res.json()
      return this.mergeAgentSessionDetail(detail)
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
    async submitAgentTurn(options = {}) {
      const question = String((options && options.prompt) || this.agentInput || '').trim()
      if (!question || this.agentSessionHydrating) return
      this.ensureAgentPanelReady()
      const currentSession = this.syncCurrentAgentSession() || this.findAgentSession(this.activeAgentSessionId)
      const targetSessionId = asText((currentSession && currentSession.id) || this.activeAgentSessionId || this.agentConversationId) || this.createAgentSession().id
      const wasPersisted = !!(currentSession && currentSession.persisted)
      const analysisFingerprint = this.getCurrentAgentAnalysisFingerprint()
      const requestAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null
      const requestRiskConfirmations = Array.isArray(options && options.riskConfirmations)
        ? options.riskConfirmations
        : this.agentRiskConfirmations
      const nextMessages = [
        ...cloneArray((currentSession && currentSession.messages) || this.agentMessages),
        { role: 'user', content: question },
      ]
      this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
        ...session,
        persisted: wasPersisted,
        snapshotLoaded: true,
        analysisFingerprint,
        input: '',
        messages: nextMessages,
        cards: [],
        executionTrace: [],
        usedTools: [],
        citations: [],
        researchNotes: [],
        auditIssues: [],
        nextSuggestions: [],
        clarificationQuestion: '',
        clarificationOptions: [],
        riskPrompt: '',
        error: '',
        contextSummary: {},
        plan: normalizeAgentPlanEnvelope(),
        riskConfirmations: cloneArray(requestRiskConfirmations),
        panelPreloadNotes: [],
        preloadedPanelKeys: [],
        status: 'running',
        stage: 'gating',
        thinkingTimeline: [normalizeAgentSubmitThinkingItem('active')],
      }))
      this.setAgentRunState(targetSessionId, {
        abortController: requestAbortController,
        loading: true,
        streamState: 'connecting',
        streamingMessageId: `agent-stream-${Date.now().toString(36)}`,
        reasoningBlocks: [],
        panelPreloadNotes: [],
        preloadedPanelKeys: [],
        pendingQuestion: question,
      })
      this.agentTurnAbortController = targetSessionId === asText(this.activeAgentSessionId) ? requestAbortController : null
      this.agentInput = ''
      this.agentClarificationDraft = ''
      this.agentClarificationSubmitting = false
      this.agentThinkingExpanded = true
      this.agentPlanExpanded = true
      this.startAgentThinkingTimer(targetSessionId)
      try {
        if (targetSessionId === asText(this.activeAgentSessionId)) {
          this.scrollAgentThreadToLatest()
        }

        const res = await fetch('/api/v1/analysis/agent/turn/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: requestAbortController ? requestAbortController.signal : undefined,
          body: JSON.stringify({
            conversation_id: targetSessionId,
            analysis_fingerprint: analysisFingerprint,
            governance_mode: 'auto',
            messages: nextMessages,
            analysis_snapshot: this.buildAgentAnalysisSnapshot(),
            risk_confirmations: requestRiskConfirmations,
          }),
        })
        if (!res.ok) {
          throw new Error(`/api/v1/analysis/agent/turn/stream 请求失败(${res.status})`)
        }
        let finalResponse = null
        await consumeSseStream(res, ({ type, payload }) => {
          const markStreamActive = () => {
            this.setAgentRunState(targetSessionId, { streamState: 'streaming' })
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.scrollAgentThreadToLatest()
            }
          }
          if (type === 'meta') {
            return
          }
          if (type === 'status') {
            const item = normalizeAgentStatusThinkingItem(payload)
            this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
              ...session,
              stage: asText(payload && payload.stage) || session.stage || 'gating',
              status: 'running',
              thinkingTimeline: upsertThinkingItemInList(
                completeActiveThinkingItemsInList(
                  upsertThinkingItemInList(session.thinkingTimeline, normalizeAgentSubmitThinkingItem('completed')),
                  item.id,
                ),
                item,
              ),
            }))
            markStreamActive()
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentThinkingExpanded = true
            }
            return
          }
          if (type === 'thinking') {
            const item = normalizeAgentThinkingItem(payload)
            this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
              ...session,
              status: 'running',
              thinkingTimeline: upsertThinkingItemInList(
                completeActiveThinkingItemsInList(
                  upsertThinkingItemInList(session.thinkingTimeline, normalizeAgentSubmitThinkingItem('completed')),
                  item.id,
                ),
                item,
              ),
            }))
            markStreamActive()
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentThinkingExpanded = true
            }
            return
          }
          if (type === 'plan') {
            const nextPlan = normalizeAgentPlanEnvelope(payload)
            const planItem = normalizeAgentPlanThinkingItem(payload)
            const currentSessionSnapshot = this.findAgentSession(targetSessionId)
            const hadPlan = !!(
              currentSessionSnapshot
              && currentSessionSnapshot.plan
              && (cloneArray(currentSessionSnapshot.plan.steps).length || cloneArray(currentSessionSnapshot.plan.followupSteps).length)
            )
            this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
              ...session,
              status: 'running',
              plan: nextPlan,
              thinkingTimeline: upsertThinkingItemInList(
                completeActiveThinkingItemsInList(session.thinkingTimeline, planItem.id),
                planItem,
              ),
            }))
            if (!hadPlan && (nextPlan.steps.length || nextPlan.followupSteps.length) && targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentPlanExpanded = true
            }
            markStreamActive()
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentThinkingExpanded = true
            }
            return
          }
          if (type === 'reasoning_delta') {
            const runState = this.getAgentRunState(targetSessionId) || createAgentRunState()
            this.setAgentRunState(targetSessionId, {
              reasoningBlocks: upsertReasoningDeltaInList(runState.reasoningBlocks, payload),
              streamState: 'streaming',
            })
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.scrollAgentThreadToLatest()
            }
            return
          }
          if (type === 'trace') {
            const item = normalizeAgentTraceThinkingItem(payload)
            this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
              ...session,
              status: 'running',
              thinkingTimeline: upsertThinkingItemInList(
                completeActiveThinkingItemsInList(
                  upsertThinkingItemInList(session.thinkingTimeline, normalizeAgentSubmitThinkingItem('completed')),
                  item.id,
                ),
                item,
              ),
              executionTrace: [...cloneArray(session.executionTrace), cloneObject(payload)],
            }))
            this.maybePreloadPanelForAgentTool(payload, targetSessionId).then((didPreload) => {
              if (didPreload) {
                if (targetSessionId === asText(this.activeAgentSessionId)) {
                  this.scrollAgentThreadToLatest()
                }
              }
            })
            markStreamActive()
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentThinkingExpanded = true
            }
            return
          }
          if (type === 'error') {
            const errorMessage = asText(payload && payload.message)
            const item = normalizeAgentStatusThinkingItem({
              stage: 'failed',
              message: errorMessage,
            })
            this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
              ...session,
              status: 'failed',
              stage: 'failed',
              error: errorMessage,
              thinkingTimeline: upsertThinkingItemInList(
                completeActiveThinkingItemsInList(session.thinkingTimeline, item.id),
                item,
              ),
            }))
            this.setAgentRunState(targetSessionId, { streamState: 'failed' })
            if (targetSessionId === asText(this.activeAgentSessionId)) {
              this.agentThinkingExpanded = true
            }
            return
          }
          if (type !== 'final') return

          const responsePayload = payload && typeof payload === 'object' ? payload.response || {} : {}
          finalResponse = responsePayload
          const turn = normalizeAgentTurnPayload(responsePayload)
          const nextStatus = asText(responsePayload.status || 'answered') || 'answered'
          const nextStage = asText(responsePayload.stage || turn.stage || 'answered') || 'answered'
          const currentSessionSnapshot = this.findAgentSession(targetSessionId) || {}
          let nextThinkingTimeline = mergeAgentThinkingTimeline(
            cloneArray(currentSessionSnapshot.thinkingTimeline),
            cloneArray(turn.diagnostics.thinkingTimeline),
          )
          if (['answered', 'failed'].includes(nextStatus)) {
            const finalStatusItem = normalizeAgentStatusThinkingItem({
              stage: nextStatus === 'answered' ? 'answered' : 'failed',
              message: turn.diagnostics.error,
            })
            nextThinkingTimeline = upsertThinkingItemInList(
              completeActiveThinkingItemsInList(nextThinkingTimeline, finalStatusItem.id),
              finalStatusItem,
            )
          }
          this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
            ...session,
            persisted: true,
            snapshotLoaded: true,
            status: nextStatus,
            stage: nextStage,
            cards: cloneArray(turn.output.cards),
            decision: normalizeAgentDecision(turn.output.decision),
            support: cloneArray(turn.output.support).map((item) => normalizeAgentDecisionEvidence(item)),
            counterpoints: cloneArray(turn.output.counterpoints).map((item) => normalizeAgentCounterpoint(item)),
            actions: cloneArray(turn.output.actions).map((item) => normalizeAgentAction(item)),
            boundary: cloneArray(turn.output.boundary).map((item) => normalizeAgentBoundaryItem(item)),
            executionTrace: cloneArray(turn.diagnostics.executionTrace),
            usedTools: cloneArray(turn.diagnostics.usedTools),
            citations: cloneArray(turn.diagnostics.citations),
            researchNotes: cloneArray(turn.diagnostics.researchNotes),
            auditIssues: cloneArray(turn.diagnostics.auditIssues),
            thinkingTimeline: nextThinkingTimeline,
            nextSuggestions: cloneArray(turn.output.nextSuggestions),
            clarificationQuestion: String(turn.output.clarificationQuestion || ''),
            clarificationOptions: cloneArray(turn.output.clarificationOptions),
            riskPrompt: String(turn.output.riskPrompt || ''),
            error: String(turn.diagnostics.error || ''),
            contextSummary: cloneObject(turn.contextSummary),
            plan: normalizeAgentPlanEnvelope(turn.plan),
            panelPayloads: cloneObject(turn.output.panelPayloads),
            messages: nextStatus === 'answered' ? cloneArray(nextMessages) : cloneArray(session.messages),
            riskConfirmations: nextStatus === 'answered' ? [] : cloneArray(requestRiskConfirmations),
          }))
          if (targetSessionId === asText(this.activeAgentSessionId) && turn.output.panelPayloads && turn.output.panelPayloads.h3_result) {
            this.preloadAgentPanelContent({ key: 'h3', label: '已预加载 H3 面板内容' }).catch((err) => {
              console.warn('Agent H3 hydrate after final failed', err)
            })
          }
          this.setAgentRunState(targetSessionId, {
            streamState: nextStatus === 'failed' ? 'failed' : 'completed',
          })
          if (targetSessionId === asText(this.activeAgentSessionId)) {
            this.agentClarificationDraft = ''
            this.agentClarificationSubmitting = false
            if (['failed', 'requires_risk_confirmation'].includes(nextStatus)) {
              this.agentThinkingExpanded = Array.isArray(nextThinkingTimeline) && nextThinkingTimeline.length > 0
            }
            this.scrollAgentThreadToLatest()
          }
        })
        if (!finalResponse) {
          throw new Error('Agent 流式执行未返回最终结果')
        }
        this.stopAgentThinkingTimer(targetSessionId)
        if (!wasPersisted && String(finalResponse.status || '') === 'answered') {
          try {
            await this.loadAgentSessionDetail(targetSessionId)
          } catch (detailErr) {
            console.warn('Agent session detail load failed after first streamed turn', detailErr)
          }
        }
      } catch (err) {
        if (err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'))) {
          this.stopAgentThinkingTimer(targetSessionId)
          this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
            ...session,
            input: question,
            status: 'idle',
            stage: 'gating',
            cards: [],
            executionTrace: [],
            usedTools: [],
            citations: [],
            researchNotes: [],
            auditIssues: [],
            nextSuggestions: [],
            clarificationQuestion: '',
            clarificationOptions: [],
            riskPrompt: '',
            error: '',
            contextSummary: cloneObject(session.contextSummary),
            plan: normalizeAgentPlanEnvelope(),
            thinkingTimeline: [],
          }))
          if (targetSessionId === asText(this.activeAgentSessionId)) {
            this.agentInput = question
            this.agentClarificationDraft = ''
            this.agentClarificationSubmitting = false
          }
          return
        }
        console.error(err)
        const item = normalizeAgentStatusThinkingItem({
          stage: 'failed',
          message: 'Agent 执行失败: ' + (err && err.message ? err.message : String(err)),
        })
        this.updateAgentSessionSnapshot(targetSessionId, (session) => ({
          ...session,
          status: 'failed',
          stage: 'failed',
          error: 'Agent 执行失败: ' + (err && err.message ? err.message : String(err)),
          thinkingTimeline: upsertThinkingItemInList(
            completeActiveThinkingItemsInList(session.thinkingTimeline, item.id),
            item,
          ),
        }))
        this.setAgentRunState(targetSessionId, { streamState: 'failed' })
        if (targetSessionId === asText(this.activeAgentSessionId)) {
          this.agentClarificationSubmitting = false
          this.agentThinkingExpanded = true
        }
      } finally {
        this.stopAgentThinkingTimer(targetSessionId)
        const runState = this.getAgentRunState(targetSessionId)
        if (runState && runState.abortController === requestAbortController) {
          this.clearAgentRunState(targetSessionId)
        }
        if (targetSessionId === asText(this.activeAgentSessionId)) {
          this.agentClarificationSubmitting = false
          this.syncActiveAgentRuntimeView(targetSessionId)
        }
      }
    },
    cancelAgentTurn(sessionId = '') {
      const runState = this.getAgentRunState(sessionId || this.activeAgentSessionId || this.agentConversationId)
      const controller = runState && runState.abortController
      if (!controller) return
      try {
        controller.abort()
      } catch (_) {
        // Ignore abort errors from already-settled controllers.
      }
    },
    async confirmAgentRiskAndRetry() {
      const toolName = this.extractAgentRiskToolName(this.agentRiskPrompt)
      if (!toolName) return
      this.agentRiskConfirmations = [toolName]
      await this.submitAgentTurn({
        prompt: this.agentInput || (this.agentMessages.length ? this.agentMessages[this.agentMessages.length - 1].content : ''),
        riskConfirmations: [toolName],
      })
    },
  }
}

export {
  createAnalysisAgentInitialState,
  createAnalysisAgentSessionMethods,
  deriveAgentSessionPreview,
  deriveAgentSessionTitle,
  normalizeAgentTurnPayload,
  normalizeAgentSessionSummary,
  normalizeAgentToolSummary,
  sortAgentSessions,
}
