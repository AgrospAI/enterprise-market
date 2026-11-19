import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import AssetViewSelector from '@shared/AssetList/AssetViewSelector'
import Label from '@shared/FormInput/Label'
import Tooltip from '@shared/atoms/Tooltip'
import Markdown from '@shared/Markdown'
import styles from './AssetView.module.css'

export default function AssetView(): ReactElement {
  useLingui()

  const { assetView, setAssetView } = useUserPreferences()

  return (
    <div>
      <Label>
        <Trans id="Asset view layout type" />{' '}
        <Tooltip
          content={
            <Markdown
              text={i18n._(
                'Switch between grid and list layout for asset results.'
              )}
            />
          }
        />
      </Label>
      <AssetViewSelector
        activeView={assetView}
        onViewChange={setAssetView}
        className={styles.selector}
      />
    </div>
  )
}
