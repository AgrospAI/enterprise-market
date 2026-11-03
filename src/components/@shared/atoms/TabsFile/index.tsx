import Markdown from '@shared/Markdown'
import { useFormikContext } from 'formik'
import { ReactElement, ReactNode, useState, useEffect } from 'react'
import { Tab, Tabs as ReactTabs, TabList, TabPanel } from 'react-tabs'
import { FormPublishData } from 'src/components/Publish/_types'
import { ServiceEditForm } from 'src/components/Asset/Edit/_types'
import Tooltip from '../Tooltip'
import styles from './index.module.css'

import IconUrl from '@images/url.svg'
import IconIpfs from '@images/ipfs.svg'
import IconArweave from '@images/arweave.svg'
import IconS3Storage from '@images/s3_storage.svg'
import IconFtp from '@images/ftp.svg'
import IconEdc from '@images/edc.svg'

interface TabsField {
  value: string
  label: string
  required?: boolean
  help?: string
  computeHelp?: string
  prominentHelp?: boolean
}

interface TabsItemProps {
  name: string
}

interface TabsItem {
  field: TabsField
  title: string
  content: ReactNode
  disabled?: boolean
  props: TabsItemProps
}

interface TabsProps {
  items: TabsItem[]
  className?: string
  activeFileType?: string
  existingFilePlaceholder?: string
  showExistingFileNotice?: boolean
}

const iconMap = {
  URL: IconUrl,
  IPFS: IconIpfs,
  ARWEAVE: IconArweave,
  S3: IconS3Storage,
  'FTP/FTPS': IconFtp,
  EDC: IconEdc
}

export default function TabsFile({
  items,
  className,
  activeFileType,
  existingFilePlaceholder,
  showExistingFileNotice
}: TabsProps): ReactElement {
  const { values, setFieldValue } = useFormikContext<
    FormPublishData | ServiceEditForm
  >()

  const getCurrentFileType = () => {
    if ((values as FormPublishData)?.services) {
      return (values as FormPublishData).services[0]?.files?.[0]?.type
    }
    if ((values as ServiceEditForm)?.files) {
      return (values as ServiceEditForm).files?.[0]?.type
    }
    return undefined
  }

  const initialState = () => {
    const formType = getCurrentFileType()
    const currentType =
      formType && formType !== 'hidden' ? formType : activeFileType
    const index = items.findIndex((tab: TabsItem) => {
      return tab.field.value === currentType
    })

    return index < 0 ? 0 : index
  }

  const [tabIndex, setTabIndex] = useState(initialState)
  const currentFormType = getCurrentFileType()
  const resolvedCurrentType =
    currentFormType && currentFormType !== 'hidden'
      ? currentFormType
      : activeFileType

  useEffect(() => {
    if (showExistingFileNotice && currentFormType === 'hidden') {
      return
    }

    const newIndex = items.findIndex((tab: TabsItem) => {
      return tab.field.value === resolvedCurrentType
    })
    if (newIndex >= 0) {
      setTabIndex((prevIndex) => {
        if (newIndex !== prevIndex) {
          return newIndex
        }
        return prevIndex
      })
    }
  }, [currentFormType, items, resolvedCurrentType, showExistingFileNotice])

  const setIndex = (index: number) => {
    if (index < 0 || index >= items.length) return

    if (showExistingFileNotice && currentFormType === 'hidden') {
      return
    }

    setTabIndex(index)
    setFieldValue(`${items[index].props.name}[0]`, {
      url: '',
      type: items[index].field.value
    })
  }

  const handleTabChange = (index: number) => {
    setIndex(index)
  }

  let textToolTip = false
  if ((values as FormPublishData)?.services) {
    textToolTip = (values as FormPublishData).services[0].access === 'compute'
  }

  const activeTabName =
    items[tabIndex]?.props?.name ?? items[0]?.props?.name ?? 'files'

  return (
    <ReactTabs
      className={`${className || ''}`}
      selectedIndex={tabIndex}
      onSelect={(index) => {
        if (index !== undefined && index !== tabIndex) {
          setTabIndex(index)
        }
      }}
    >
      <div className={styles.tabListContainer}>
        <TabList className={styles.tabList}>
          {items.map((item, index) => {
            const IconComponent = iconMap[item.title.toUpperCase()]
            return (
              <Tab
                className={styles.tab}
                key={`tab_${activeTabName}_${index}`}
                onClick={handleTabChange ? () => handleTabChange(index) : null}
                disabled={item.disabled}
              >
                <div className={styles.tabInner}>
                  {IconComponent && (
                    <IconComponent className={styles.tabIcon} />
                  )}
                  <span>{item.title}</span>
                </div>
              </Tab>
            )
          })}
        </TabList>
      </div>
      <div className={styles.tabContent}>
        {items.map((item, index) => {
          return (
            <TabPanel
              key={`tabpanel_${activeTabName}_${index}`}
              className={styles.tabPanel}
            >
              {existingFilePlaceholder &&
                showExistingFileNotice &&
                item.field.value === activeFileType &&
                index === tabIndex && (
                  <div className={styles.existingFileNotice}>
                    {existingFilePlaceholder}
                  </div>
                )}
              <label className={styles.tabLabel}>
                {item.field.label}
                {item.field.required && (
                  <span title="Required" className={styles.required}>
                    *
                  </span>
                )}
                {item.field.help && item.field.prominentHelp && (
                  <Tooltip
                    content={
                      <Markdown
                        text={`${item.field.help} ${
                          textToolTip ? item.field.computeHelp : ''
                        }`}
                      />
                    }
                  />
                )}
              </label>
              {item.content}
            </TabPanel>
          )
        })}
      </div>
    </ReactTabs>
  )
}
