import NotificationBadge from '@components/AccessRequests/NotificationBadge'
import { useRouter } from 'next/router'
import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import AccessRequests from '@components/AccessRequests'
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import Tabs from '@shared/atoms/Tabs'
import PublishedList from './PublishedList'
import Downloads from './Downloads'
import ComputeJobs from './ComputeJobs'
import styles from './index.module.css'
import { getAllComputeJobs } from '@utils/compute'
import { useUserPreferences } from '@context/UserPreferences'
import { useCancelToken } from '@hooks/useCancelToken'
import { LoggerInstance } from '@oceanprotocol/lib'
import { useAccount } from 'wagmi'
import { useEthersSigner } from '@hooks/useEthersSigner'
import HistoryData from './HistoryData'

interface HistoryTab {
  title: string
  content: JSX.Element
  badge?: JSX.Element
}

function getTabs(
  accountId: string,
  userAccountId: string,
  jobs: ComputeJobMetaData[],
  isLoadingJobs: boolean,
  refetchJobs: boolean,
  setRefetchJobs: any
): HistoryTab[] {
  const defaultTabs: HistoryTab[] = [
    {
      title: i18n._('Published'),
      content: <PublishedList accountId={accountId} />
    },
    {
      title: i18n._('Downloads'),
      content: <Downloads accountId={accountId} />
    }
  ]
  const computeTab: HistoryTab = {
    title: i18n._('Compute Jobs'),
    content: (
      <ComputeJobs
        jobs={jobs}
        isLoading={isLoadingJobs}
        refetchJobs={() => setRefetchJobs(!refetchJobs)}
      />
    )
  }
  if (accountId?.toLowerCase() === userAccountId?.toLowerCase()) {
    defaultTabs.push(computeTab)
  }

  const history: HistoryTab = {
    title: i18n._('History'),
    content: <HistoryData accountId={accountId} />
  }
  if (accountId?.toLowerCase() === userAccountId?.toLowerCase()) {
    defaultTabs.push(history)
  }

  if (accountId?.toLowerCase() === userAccountId?.toLowerCase()) {
    defaultTabs.push({
      title: i18n._('Access requests'),
      badge: <NotificationBadge />,
      content: <AccessRequests />
    })
  }

  return defaultTabs
}

const tabsIndexList = {
  published: 0,
  downloads: 1,
  computeJobs: 2,
  history: 3,
  accessRequests: 4
}

const computeJobsTabIndex = tabsIndexList.computeJobs

export default function HistoryPage({
  accountIdentifier
}: {
  accountIdentifier: string
}): ReactElement {
  useLingui()

  const router = useRouter()
  const { address: accountId } = useAccount()
  const signer = useEthersSigner()
  const { chainIds } = useUserPreferences()
  const newCancelToken = useCancelToken()

  const [refetchJobs, setRefetchJobs] = useState(false)
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [jobs, setJobs] = useState<ComputeJobMetaData[]>([])
  const [tabIndex, setTabIndex] = useState<number>()
  const isFetchingJobsRef = useRef(false)

  const fetchJobs = useCallback(
    async (type: string) => {
      if (!chainIds || chainIds.length === 0 || !accountId || !signer) {
        return
      }
      if (isFetchingJobsRef.current) {
        return
      }

      try {
        isFetchingJobsRef.current = true
        if (type === 'init') {
          setIsLoadingJobs(true)
        }

        const computeJobs = await getAllComputeJobs(
          accountId,
          signer,
          newCancelToken(),
          chainIds
        )
        setJobs(computeJobs?.computeJobs)
        setIsLoadingJobs(!computeJobs.isLoaded)
      } catch (error) {
        LoggerInstance.error(error.message)
        setIsLoadingJobs(false)
      } finally {
        isFetchingJobsRef.current = false
      }
    },
    [accountId, chainIds, newCancelToken, signer]
  )

  useEffect(() => {
    if (tabIndex !== computeJobsTabIndex) return

    fetchJobs('init')
  }, [accountId, refetchJobs, tabIndex, fetchJobs])

  const getDefaultIndex = useCallback((): number => {
    const url = new URL(location.href)
    const defaultTabString = url.searchParams.get('defaultTab')
    const defaultTabIndex = tabsIndexList?.[defaultTabString]

    if (!defaultTabIndex) return 0
    if (
      defaultTabIndex >= tabsIndexList.computeJobs &&
      accountId?.toLowerCase() !== accountIdentifier?.toLowerCase()
    )
      return 0

    return defaultTabIndex
  }, [accountId, accountIdentifier])

  useEffect(() => {
    setTabIndex(getDefaultIndex())
  }, [getDefaultIndex, router.asPath])

  const tabs = getTabs(
    accountIdentifier,
    accountId,
    jobs,
    isLoadingJobs,
    refetchJobs,
    setRefetchJobs
  )

  return (
    <Tabs
      items={tabs}
      className={styles.tabs}
      selectedIndex={tabIndex || 0}
      onIndexSelected={setTabIndex}
    />
  )
}
