import { describe, expect, it } from 'vitest'
import { authorizeRelay, signCapability, verifyCapability, type Capability } from './capabilities.js'

const capability: Capability = { version: 1, roomId: 'workspace:12345678-1234-4234-8234-123456789abc', worktreeId: '12345678-1234-4234-8234-123456789abc', hostMachineId: 'host-a', permission: 'control', nonce: '12345678-1234-4234-8234-123456789def' }
const context = { roomId: capability.roomId, worktreeId: capability.worktreeId, hostMachineId: capability.hostMachineId, collaborative: true }

describe('authoritative collaboration permissions', () => {
  it('accepts a signed control grant only for the matching host and workspace', () => {
    const verified = verifyCapability(signCapability(capability, 'test-project-key'), 'test-project-key')
    expect(() => authorizeRelay(verified, context)).not.toThrow()
    expect(() => authorizeRelay(verified, { ...context, worktreeId: 'another-workspace' })).toThrow('does not authorize')
    expect(() => authorizeRelay(verified, { ...context, hostMachineId: 'another-host' })).toThrow('does not authorize')
  })
  it('rejects view permission at the receiver regardless of UI state', () => {
    const view = verifyCapability(signCapability({ ...capability, permission: 'view' }, 'test-project-key'), 'test-project-key')
    expect(() => authorizeRelay(view, context)).toThrow('View permission')
  })
  it('rejects forged permission elevation and invitations from another project', () => {
    const signed = signCapability({ ...capability, permission: 'view' }, 'test-project-key')
    const [, signature] = signed.split('.')
    const elevated = Buffer.from(JSON.stringify(capability)).toString('base64url') + '.' + signature
    expect(() => verifyCapability(elevated, 'test-project-key')).toThrow('signature')
    expect(() => verifyCapability(signed, 'other-project-key')).toThrow('signature')
  })
  it('rejects revoked sharing and a different room', () => {
    expect(() => authorizeRelay(capability, { ...context, collaborative: false })).toThrow('disabled')
    expect(() => authorizeRelay(capability, { ...context, roomId: 'workspace:other' })).toThrow('does not authorize')
  })
})

import { signRelay, verifyRelay } from './capabilities.js'
describe('private relay credentials', () => {
  it('broadcasts a scoped signature without leaking the bearer invitation', () => {
    const invitation = signCapability(capability, 'test-project-key')
    const command = signRelay({ type: 'relay', roomId: capability.roomId, grantId: capability.nonce, requestId: 'request-1', sessionId: 'session-1', content: 'do work' }, invitation)
    expect(JSON.stringify(command)).not.toContain(invitation)
    expect(() => verifyRelay(command, invitation)).not.toThrow()
    expect(() => verifyRelay({ ...command, content: 'different work' }, invitation)).toThrow('signature')
    expect(() => verifyRelay({ ...command, requestId: 'request-2' }, invitation)).toThrow('signature')
    expect(() => verifyRelay({ ...command, sessionId: 'other-session' }, invitation)).toThrow('signature')
    expect(() => verifyRelay({ ...command, roomId: 'another-room' }, invitation)).toThrow('signature')
  })
  it('does not allow a view invitation to sign a command using an observed control grant', () => {
    const controlInvitation = signCapability(capability, 'test-project-key')
    const viewInvitation = signCapability({ ...capability, permission: 'view' }, 'test-project-key')
    const forged = signRelay({ type: 'relay', roomId: capability.roomId, grantId: capability.nonce, requestId: 'new-request', sessionId: 'session-1', content: 'elevated work' }, viewInvitation)
    expect(() => verifyRelay(forged, controlInvitation)).toThrow('signature')
  })
})
