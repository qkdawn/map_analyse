import ANALYSIS_SIDEBAR_TEMPLATE from './components/sidebar.html?raw'
import ANALYSIS_MAIN_TEMPLATE from './components/main.html?raw'
import AGENT_THINKING_HEADER_TEMPLATE from './components/agent/thinking-header.html?raw'
import AGENT_REASONING_PANEL_TEMPLATE from './components/agent/reasoning-panel.html?raw'
import AGENT_CLARIFICATION_CARD_TEMPLATE from './components/agent/clarification-card.html?raw'

const AGENT_MAIN_TEMPLATE = ANALYSIS_MAIN_TEMPLATE
  .replace('__AGENT_THINKING_HEADER__', AGENT_THINKING_HEADER_TEMPLATE)
  .replace('__AGENT_REASONING_PANEL__', AGENT_REASONING_PANEL_TEMPLATE)
  .replace('__AGENT_CLARIFICATION_CARD__', AGENT_CLARIFICATION_CARD_TEMPLATE)

export const ANALYSIS_TEMPLATE = `${ANALYSIS_SIDEBAR_TEMPLATE}${AGENT_MAIN_TEMPLATE}`
