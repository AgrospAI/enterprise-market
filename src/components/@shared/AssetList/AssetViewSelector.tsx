import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import GridIcon from '@images/grid-view-icon.svg'
import ListIcon from '@images/list-view-icon.svg'
import styles from './AssetViewSelector.module.css'
import { AssetViewOptions } from 'src/@types/AssetView'

export default function AssetViewSelector({
  activeView,
  onViewChange,
  className
}: {
  activeView: AssetViewOptions
  onViewChange: (view: AssetViewOptions) => void
  className?: string
}): ReactElement {
  useLingui()

  return (
    <div className={`${styles.viewSelectorContainer} ${className || ''}`}>
      <button
        type="button"
        className={`${styles.viewSelector} ${
          activeView === AssetViewOptions.Grid ? styles.selected : ''
        }`}
        onClick={() => onViewChange(AssetViewOptions.Grid)}
        title={i18n._('Grid view')}
        aria-label={i18n._('Grid view')}
        aria-pressed={activeView === AssetViewOptions.Grid}
      >
        <GridIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`${styles.viewSelector} ${
          activeView === AssetViewOptions.List ? styles.selected : ''
        }`}
        onClick={() => onViewChange(AssetViewOptions.List)}
        title={i18n._('List view')}
        aria-label={i18n._('List view')}
        aria-pressed={activeView === AssetViewOptions.List}
      >
        <ListIcon aria-hidden="true" />
      </button>
    </div>
  )
}
