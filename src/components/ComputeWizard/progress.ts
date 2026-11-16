import { i18n } from '../../i18n/index'
export type ComputeStartProgressPhase =
  | 'escrow'
  | `dataset:${number}`
  | 'algorithm'
  | 'create'

export type ComputeStartProgressStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'error'

export type ComputeStartProgressStep = {
  id: ComputeStartProgressPhase
  label: string
  shortLabel: string
  status: ComputeStartProgressStatus
}

type ComputeStartProgressAssets = {
  datasets?: Array<{ name?: string }>
  algorithm?: { name?: string }
}

function capitalizeFirstLetter(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function getDatasetProgressPhase(
  index: number
): ComputeStartProgressPhase {
  return `dataset:${index}`
}

export function createComputeStartProgress({
  datasets = [],
  algorithm
}: ComputeStartProgressAssets = {}): ComputeStartProgressStep[] {
  return [
    {
      id: 'escrow',
      label: i18n._('Approve and deposit funds in escrow if necessary'),
      shortLabel: i18n._('Escrow'),
      status: 'pending'
    },
    ...datasets.map(({ name }, index) => ({
      id: getDatasetProgressPhase(index),
      label: i18n._('Approve and buy dataset{value0}', {
        value0: name ? `: ${name}` : ` ${index + 1}`
      }),
      shortLabel: capitalizeFirstLetter(
        name || i18n._('Dataset {value0}', { value0: index + 1 })
      ),
      status: 'pending' as const
    })),
    ...(algorithm
      ? [
          {
            id: 'algorithm' as const,
            label: i18n._('Approve and buy algorithm{value0}', {
              value0: algorithm.name ? `: ${algorithm.name}` : ''
            }),
            shortLabel: capitalizeFirstLetter(algorithm.name || 'Algorithm'),
            status: 'pending' as const
          }
        ]
      : []),
    {
      id: 'create',
      label: i18n._('Creating job in progress'),
      shortLabel: i18n._('Create job'),
      status: 'pending'
    }
  ]
}
