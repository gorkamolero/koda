import { useAtom } from 'jotai'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@koda/ui'
import { selectedModelAtom, AGENT_MODELS, type AgentModel } from '@/store/chat'

/** Legacy model picker retains the application selection store. */
export function ModelSelector(): React.ReactElement {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom)
  const currentModel = AGENT_MODELS.find(model => model.id === selectedModel)
  return <Select value={selectedModel} onValueChange={value => setSelectedModel(value as AgentModel)}>
    <SelectTrigger data-testid="model-selector" aria-label="Model" className="h-auto w-auto rounded-none border-dashed px-2 py-1 font-code text-xs text-text-muted hover:text-text-accent hover:border-text-accent"><span><span className="text-text-faint">[</span><span className="text-text-accent">MODEL:</span><span className="uppercase">{currentModel?.name ?? 'SELECT'}</span><span className="text-text-faint">]</span></span></SelectTrigger>
    <SelectContent data-testid="model-selector-dropdown" className="w-72 rounded-none border-dashed border-border-strong">
      <div className="px-3 py-1.5 border-b border-dashed border-border-subtle text-xs"><span className="text-text-faint">┌─ </span><span className="text-text-accent">SELECT MODEL</span><span className="text-text-faint"> {'─'.repeat(14)}┐</span></div>
      {AGENT_MODELS.map(model => <SelectItem key={model.id} value={model.id} data-testid={`model-option-${model.id}`} className="rounded-none px-3 py-2 text-xs"><span className="flex items-center gap-2"><span className="text-text-faint">{model.id === selectedModel ? '[●]' : '[ ]'}</span><span className="text-text-primary uppercase">{model.name}</span><span className="text-text-dim">{formatContextLimit(model.contextLimit)}</span></span><span className="block text-xs text-text-faint mt-1 ml-6">{model.description}</span></SelectItem>)}
      <div className="px-3 py-1 text-xs text-text-faint">└{'─'.repeat(32)}┘</div>
    </SelectContent>
  </Select>
}
function formatContextLimit(limit: number): string { return limit >= 1000000 ? `${(limit / 1000000).toFixed(1)}M` : `${(limit / 1000).toFixed(0)}K` }
