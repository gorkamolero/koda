/**
 * Machine ID Utility
 *
 * Generates and persists a unique identifier for this machine.
 * Used to track which machine hosts which agent sessions in collaborative workspaces.
 */

const MACHINE_ID_KEY = 'koda:machineId'
const MACHINE_NAME_KEY = 'koda:machineName'

/**
 * Generate a random machine ID (UUID v4 format)
 */
function generateMachineId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get or create a persistent machine ID
 * Stored in localStorage to persist across sessions
 */
export function getMachineId(): string {
  // Check localStorage first
  const stored = localStorage.getItem(MACHINE_ID_KEY)
  if (stored) {
    return stored
  }

  // Generate and store a new ID
  const newId = generateMachineId()
  localStorage.setItem(MACHINE_ID_KEY, newId)
  return newId
}

/**
 * Get a short version of the machine ID for display
 * Returns first 8 characters
 */
export function getShortMachineId(): string {
  return getMachineId().slice(0, 8)
}

/**
 * Get the machine name (user-friendly identifier)
 * Defaults to first 6 chars of machine ID if not set
 */
export function getMachineName(): string {
  const stored = localStorage.getItem(MACHINE_NAME_KEY)
  if (stored) {
    return stored
  }
  return getMachineId().slice(0, 6)
}

/**
 * Set a custom machine name
 */
export function setMachineName(name: string): void {
  localStorage.setItem(MACHINE_NAME_KEY, name)
}

/**
 * Check if the given machine ID is the local machine
 */
export function isLocalMachine(machineId: string): boolean {
  return machineId === getMachineId()
}

/**
 * Generate a random color for user presence
 * Returns a hex color that's visually distinct
 */
export function getRandomColor(): string {
  const colors = [
    '#EF4444', // red
    '#F97316', // orange
    '#EAB308', // yellow
    '#22C55E', // green
    '#14B8A6', // teal
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#6366F1', // indigo
    '#06B6D4', // cyan
  ] as const
  return colors[Math.floor(Math.random() * colors.length)] ?? '#3B82F6'
}

/**
 * Get or create a persistent user color
 */
const USER_COLOR_KEY = 'koda:userColor'

export function getUserColor(): string {
  const stored = localStorage.getItem(USER_COLOR_KEY)
  if (stored) {
    return stored
  }

  const newColor = getRandomColor()
  localStorage.setItem(USER_COLOR_KEY, newColor)
  return newColor
}
