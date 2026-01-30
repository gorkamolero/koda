import { atom } from 'jotai'

/**
 * Interview question types
 */
export type QuestionType = 'text' | 'multiple-choice'

/**
 * A single interview question
 */
export interface InterviewQuestion {
  id: string
  type: QuestionType
  question: string
  description?: string
  placeholder?: string
  choices?: string[]
  required?: boolean
}

/**
 * Answer to an interview question
 */
export interface InterviewAnswer {
  questionId: string
  value: string
  selectedChoices?: string[]
}

/**
 * Interview session state
 */
export interface InterviewSession {
  workspaceId: string
  questions: InterviewQuestion[]
  answers: Map<string, InterviewAnswer>
  currentQuestionIndex: number
  isComplete: boolean
  generatedSpec: string | null
  generatedFixPlan: string | null
}

/**
 * Workspace type options
 */
export type WorkspaceType = 'standard' | 'spec-driven' | 'ralph' | 'openprose'

export interface WorkspaceTypeOption {
  id: WorkspaceType
  name: string
  description: string
}

export const WORKSPACE_TYPES: WorkspaceTypeOption[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Regular workspace for ad-hoc development',
  },
  {
    id: 'spec-driven',
    name: 'Spec-Driven',
    description: 'Start with a feature spec before coding',
  },
  {
    id: 'ralph',
    name: 'Ralph',
    description: 'Autonomous agent with spec and fix plan',
  },
  {
    id: 'openprose',
    name: 'OpenProse',
    description: 'Natural language programming mode',
  },
]

/**
 * Default interview questions for feature spec generation
 */
export const DEFAULT_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'feature-name',
    type: 'text',
    question: 'What feature are you building?',
    description:
      'Provide a brief name or description of the feature you want to build.',
    placeholder: 'e.g., User authentication system',
    required: true,
  },
  {
    id: 'complexity',
    type: 'multiple-choice',
    question: 'How complex is this feature?',
    description: 'Estimate the complexity to help scope the work.',
    choices: ['Simple (1-2 hours)', 'Medium (half day)', 'Complex (1+ days)'],
    required: true,
  },
  {
    id: 'dependencies',
    type: 'multiple-choice',
    question: 'What dependencies does this feature have?',
    description: 'Select all that apply.',
    choices: ['Database changes', 'External APIs', 'UI components'],
  },
  {
    id: 'acceptance-criteria',
    type: 'text',
    question: 'What are the acceptance criteria?',
    description: 'Describe how you will know when this feature is complete.',
    placeholder: 'e.g., Users can log in with email and password',
    required: true,
  },
]

/**
 * Create initial interview session
 */
function createInitialSession(
  workspaceId: string,
  questions: InterviewQuestion[] = DEFAULT_INTERVIEW_QUESTIONS
): InterviewSession {
  return {
    workspaceId,
    questions,
    answers: new Map(),
    currentQuestionIndex: 0,
    isComplete: false,
    generatedSpec: null,
    generatedFixPlan: null,
  }
}

/**
 * Map of workspace ID to interview session
 */
const interviewSessionsAtom = atom<Map<string, InterviewSession>>(new Map())

/**
 * Current workspace ID for interview (shared with chat)
 */
export const currentInterviewWorkspaceIdAtom = atom<string | null>(null)

/**
 * Current interview session atom (derived)
 */
export const currentInterviewSessionAtom = atom(
  (get) => {
    const workspaceId = get(currentInterviewWorkspaceIdAtom)
    if (!workspaceId) return null

    const sessions = get(interviewSessionsAtom)
    return sessions.get(workspaceId) ?? createInitialSession(workspaceId)
  },
  (get, set, update: Partial<InterviewSession>) => {
    const workspaceId = get(currentInterviewWorkspaceIdAtom)
    if (!workspaceId) return

    const sessions = get(interviewSessionsAtom)
    const currentSession =
      sessions.get(workspaceId) ?? createInitialSession(workspaceId)

    const newSession = { ...currentSession, ...update }
    const newSessions = new Map(sessions)
    newSessions.set(workspaceId, newSession)

    set(interviewSessionsAtom, newSessions)
  }
)

/**
 * Current question atom (derived)
 */
export const currentQuestionAtom = atom((get) => {
  const session = get(currentInterviewSessionAtom)
  if (!session) return null

  const { questions, currentQuestionIndex } = session
  return questions[currentQuestionIndex] ?? null
})

/**
 * Progress atom (derived) - returns current step and total
 */
export const interviewProgressAtom = atom((get) => {
  const session = get(currentInterviewSessionAtom)
  if (!session) return { current: 0, total: 0, percent: 0 }

  const { questions, currentQuestionIndex, isComplete } = session
  const current = isComplete ? questions.length : currentQuestionIndex + 1
  const total = questions.length
  const percent = Math.round((current / total) * 100)

  return { current, total, percent }
})

/**
 * Answers atom (derived)
 */
export const interviewAnswersAtom = atom(
  (get) => {
    const session = get(currentInterviewSessionAtom)
    return session?.answers ?? new Map<string, InterviewAnswer>()
  },
  (get, set, questionId: string, answer: InterviewAnswer) => {
    const session = get(currentInterviewSessionAtom)
    if (!session) return

    const newAnswers = new Map(session.answers)
    newAnswers.set(questionId, answer)

    set(currentInterviewSessionAtom, { answers: newAnswers })
  }
)

/**
 * Is complete atom (derived)
 */
export const isInterviewCompleteAtom = atom((get) => {
  const session = get(currentInterviewSessionAtom)
  return session?.isComplete ?? false
})

/**
 * Generated spec atom (derived)
 */
export const generatedSpecAtom = atom(
  (get) => {
    const session = get(currentInterviewSessionAtom)
    return session?.generatedSpec ?? null
  },
  (_get, set, spec: string | null) => {
    set(currentInterviewSessionAtom, { generatedSpec: spec })
  }
)

/**
 * Generated fix plan atom (derived)
 */
export const generatedFixPlanAtom = atom(
  (get) => {
    const session = get(currentInterviewSessionAtom)
    return session?.generatedFixPlan ?? null
  },
  (_get, set, fixPlan: string | null) => {
    set(currentInterviewSessionAtom, { generatedFixPlan: fixPlan })
  }
)

/**
 * Actions
 */

/**
 * Set answer for current question
 */
export const setAnswerAtom = atom(
  null,
  (get, set, value: string, selectedChoices?: string[]) => {
    const question = get(currentQuestionAtom)
    if (!question) return

    const answer: InterviewAnswer = {
      questionId: question.id,
      value,
      selectedChoices,
    }

    const session = get(currentInterviewSessionAtom)
    if (!session) return

    const newAnswers = new Map(session.answers)
    newAnswers.set(question.id, answer)

    set(currentInterviewSessionAtom, { answers: newAnswers })
  }
)

/**
 * Go to next question
 */
export const nextQuestionAtom = atom(null, (get, set) => {
  const session = get(currentInterviewSessionAtom)
  if (!session) return

  const { questions, currentQuestionIndex } = session

  if (currentQuestionIndex < questions.length - 1) {
    set(currentInterviewSessionAtom, {
      currentQuestionIndex: currentQuestionIndex + 1,
    })
  } else {
    // Complete the interview
    set(currentInterviewSessionAtom, { isComplete: true })

    // Generate the spec
    const spec = generateSpecFromAnswers(session.answers, session.questions)
    set(currentInterviewSessionAtom, { generatedSpec: spec })

    // Generate fix plan
    const fixPlan = generateFixPlanFromSpec(spec)
    set(currentInterviewSessionAtom, { generatedFixPlan: fixPlan })
  }
})

/**
 * Go to previous question
 */
export const previousQuestionAtom = atom(null, (get, set) => {
  const session = get(currentInterviewSessionAtom)
  if (!session) return

  const { currentQuestionIndex, isComplete } = session

  if (isComplete) {
    // Go back from complete state
    set(currentInterviewSessionAtom, { isComplete: false })
  } else if (currentQuestionIndex > 0) {
    set(currentInterviewSessionAtom, {
      currentQuestionIndex: currentQuestionIndex - 1,
    })
  }
})

/**
 * Reset interview session
 */
export const resetInterviewAtom = atom(null, (get, set) => {
  const workspaceId = get(currentInterviewWorkspaceIdAtom)
  if (!workspaceId) return

  const sessions = get(interviewSessionsAtom)
  const newSessions = new Map(sessions)
  newSessions.set(workspaceId, createInitialSession(workspaceId))

  set(interviewSessionsAtom, newSessions)
})

/**
 * Get answer for a specific question
 */
export const getAnswerForQuestionAtom = atom(
  (get) => (questionId: string): InterviewAnswer | undefined => {
    const session = get(currentInterviewSessionAtom)
    return session?.answers.get(questionId)
  }
)

/**
 * Check if current question has a valid answer
 */
export const hasValidAnswerAtom = atom((get) => {
  const question = get(currentQuestionAtom)
  const session = get(currentInterviewSessionAtom)

  if (!question || !session) return false

  const answer = session.answers.get(question.id)

  if (!answer) return !question.required

  if (question.type === 'text') {
    return answer.value.trim().length > 0
  }

  if (question.type === 'multiple-choice') {
    return (
      answer.selectedChoices !== undefined &&
      answer.selectedChoices.length > 0
    )
  }

  return false
})

/**
 * Generate feature spec from interview answers
 */
export function generateSpecFromAnswers(
  answers: Map<string, InterviewAnswer>,
  _questions: InterviewQuestion[]
): string {
  const featureName = answers.get('feature-name')?.value ?? 'Untitled Feature'
  const complexity =
    answers.get('complexity')?.selectedChoices?.[0] ?? 'Unknown'
  const dependencies = answers.get('dependencies')?.selectedChoices ?? []
  const acceptanceCriteria =
    answers.get('acceptance-criteria')?.value ?? 'No criteria specified'

  const dependenciesText =
    dependencies.length > 0
      ? dependencies.map((d) => `- ${d}`).join('\n')
      : '- None specified'

  return `# Feature Specification: ${featureName}

## Overview
${featureName}

## Complexity
${complexity}

## Dependencies
${dependenciesText}

## Acceptance Criteria
${acceptanceCriteria}

## Implementation Notes
- Generated from interview on ${new Date().toLocaleDateString()}
- Ready for agent implementation
`
}

/**
 * Generate fix plan from spec
 */
export function generateFixPlanFromSpec(spec: string): string {
  // Parse the spec to extract key information
  const featureNameMatch = spec.match(/# Feature Specification: (.+)/)
  const featureName = featureNameMatch?.[1] ?? 'Feature'

  const complexityMatch = spec.match(/## Complexity\n(.+)/)
  const complexity = complexityMatch?.[1]?.trim() ?? 'Medium'

  // Generate tasks based on complexity
  const baseTasks = [
    `[ ] Analyze requirements for ${featureName}`,
    `[ ] Set up necessary file structure`,
    `[ ] Implement core functionality`,
    `[ ] Add error handling`,
    `[ ] Write tests`,
    `[ ] Document changes`,
  ]

  // Add more tasks for complex features
  const additionalTasks =
    complexity.includes('Complex')
      ? [
          `[ ] Design system architecture`,
          `[ ] Create data models`,
          `[ ] Implement integration layer`,
          `[ ] Performance optimization`,
        ]
      : []

  const allTasks = [...additionalTasks, ...baseTasks]

  return `# Fix Plan: ${featureName}

## Status
In Progress

## Tasks
${allTasks.join('\n')}

## Notes
- Generated automatically from feature spec
- Tasks can be modified as needed
- Check off tasks as they are completed
`
}

/**
 * Workspace type atom for current workspace
 */
export const workspaceTypeAtom = atom<WorkspaceType>('standard')
