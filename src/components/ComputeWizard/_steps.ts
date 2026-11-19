import { i18n } from '../../i18n/index'
import React from 'react'
import { ComputeFlow, FormComputeData, StepContent } from './_types'
import { initialValues } from './_constants'

export const LAST_TRACKED_COMPLETION_STEP = 7

type ComputeWizardStepTitle =
  | 'User Parameters'
  | 'Select C2D Environment'
  | 'C2D Environment Configuration'
  | 'Job Results Storage'
  | 'Review'

export function createInitialValues(flow: ComputeFlow): FormComputeData {
  const clonedValues = JSON.parse(
    JSON.stringify(initialValues)
  ) as FormComputeData
  return {
    ...clonedValues,
    flow
  }
}

function createStep(step: number, title: string): StepContent {
  return { step, title, component: React.createElement('div') }
}

export function getDatasetSteps(
  hasUserParamsStep: boolean,
  withoutDataset: boolean
): StepContent[] {
  const steps: StepContent[] = [createStep(1, 'Select Datasets')]

  if (withoutDataset) {
    let stepCounter = 2

    if (hasUserParamsStep) {
      steps.push(createStep(stepCounter++, 'User Parameters'))
    }

    steps.push(
      createStep(stepCounter++, 'Select C2D Environment'),
      createStep(stepCounter++, 'C2D Environment Configuration'),
      createStep(stepCounter++, 'Job Results Storage'),
      createStep(stepCounter, 'Review')
    )

    return steps
  }

  steps.push(
    createStep(2, 'Select Services'),
    createStep(3, 'Preview Selected Datasets & Services')
  )

  if (hasUserParamsStep) {
    steps.push(
      createStep(4, 'User Parameters'),
      createStep(5, 'Select C2D Environment'),
      createStep(6, 'C2D Environment Configuration'),
      createStep(7, 'Job Results Storage'),
      createStep(8, 'Review')
    )
  } else {
    steps.push(
      createStep(4, 'Select C2D Environment'),
      createStep(5, 'C2D Environment Configuration'),
      createStep(6, 'Job Results Storage'),
      createStep(7, 'Review')
    )
  }

  return steps
}

function getRequiredStepNumber(
  steps: StepContent[],
  title: Exclude<ComputeWizardStepTitle, 'User Parameters'>
): number {
  const step = steps.find((item) => item.title === title)

  if (!step) {
    throw new Error(i18n._('Missing compute wizard step: {title}', { title }))
  }

  return step.step
}

export function getComputeWizardStepNumbers(
  hasUserParamsStep: boolean,
  withoutDataset: boolean
): {
  userParameters?: number
  selectEnvironment: number
  configureEnvironment: number
  jobResultsStorage: number
  review: number
} {
  const steps = getDatasetSteps(hasUserParamsStep, withoutDataset)

  return {
    userParameters: steps.find((item) => item.title === 'User Parameters')
      ?.step,
    selectEnvironment: getRequiredStepNumber(steps, 'Select C2D Environment'),
    configureEnvironment: getRequiredStepNumber(
      steps,
      'C2D Environment Configuration'
    ),
    jobResultsStorage: getRequiredStepNumber(steps, 'Job Results Storage'),
    review: getRequiredStepNumber(steps, 'Review')
  }
}
