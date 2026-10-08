import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const CapabilitySchema = z.object({
  version: z.literal(1),
  roomId: z.string().startsWith('workspace:'),
  worktreeId: z.string().uuid(),
  hostMachineId: z.string(),
  permission: z.enum(['view', 'control']),
  nonce: z.string().uuid(),
})
export type Capability = z.infer<typeof CapabilitySchema>

export function signCapability(capability: Capability, secret: string): string {
  const body = Buffer.from(JSON.stringify(capability)).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

export function verifyCapability(token: string, secret: string): Capability {
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra) throw new Error('Invalid workspace invitation')
  const actual = Buffer.from(signature, 'base64url')
  const expected = createHmac('sha256', secret).update(body).digest()
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid workspace invitation signature')
  }
  const capability = CapabilitySchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')))
  if (capability.roomId !== `workspace:${capability.worktreeId}`) throw new Error('Invitation workspace mismatch')
  return capability
}

/** The receiver, not the requesting UI, is the authority to execute a turn. */
export function authorizeRelay(
  capability: Capability,
  context: { roomId: string; hostMachineId: string; worktreeId: string; collaborative: boolean },
): void {
  if (capability.permission !== 'control') throw new Error('View permission cannot send messages')
  if (!context.collaborative) throw new Error('Workspace sharing is disabled')
  if (capability.roomId !== context.roomId || capability.worktreeId !== context.worktreeId ||
      capability.hostMachineId !== context.hostMachineId) {
    throw new Error('Invitation does not authorize this session')
  }
}

export type RelayCommand = { type: 'relay'; roomId: string; grantId: string; requestId: string; sessionId: string; content: string; authorName?: string; authorMachineId?: string; signature: string }
function relayBody(command: Omit<RelayCommand, 'signature'>): string {
  return JSON.stringify([command.roomId, command.grantId, command.requestId, command.sessionId, command.content, command.authorName ?? null, command.authorMachineId ?? null])
}
export function signRelay(command: Omit<RelayCommand, 'signature'>, invitation: string): RelayCommand {
  return { ...command, signature: createHmac('sha256', invitation).update(relayBody(command)).digest('base64url') }
}
export function verifyRelay(command: RelayCommand, invitation: string): void {
  const actual = Buffer.from(command.signature, 'base64url')
  const expected = Buffer.from(signRelay(command, invitation).signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid relay signature')
}
