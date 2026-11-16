import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useEffect, useState } from 'react'
import styles from './index.module.css'
import Header from './Header'
import Main from './Main'
import Navigation from './Navigation'
import Container from '../atoms/Container'
import Stepper from './Stepper'
import DownloadMetamask from './Steps/DownloadMetamask'
import ConnectAccount from './Steps/ConnectAccount'
import ImportCustomTokens from './Steps/ImportCustomTokens'
import Ready from './Steps/Ready/Ready'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useUserPreferences } from '@context/UserPreferences'
import useBalance from '@hooks/useBalance'
import Faucet from './Steps/Faucet/Faucet'
import SSI from './Steps/SSI/Ssi'
import { getSupportedChainIds } from 'chains.config.cjs'
import { getRuntimeConfig } from '@utils/runtimeConfig'

export interface OnboardingStep {
  title: string
  subtitle: string
  body: string
  image?: string
  buttonLabel?: string
  buttonSuccess?: string
}
const isMainnetChain = (chainId: number | undefined): boolean => {
  if (!chainId) return false
  const mainnetChains = [1, 10, 56, 137, 43114, 42161, 8453, 100]
  return mainnetChains.includes(chainId)
}

export enum NavigationDirections {
  PREV = 'prev',
  NEXT = 'next'
}

export default function OnboardingSection(): ReactElement {
  useLingui()

  const { address: accountId } = useAccount()
  const { balance } = useBalance()
  const web3Provider = usePublicClient()
  const chainId = useChainId()
  const { onboardingStep, setOnboardingStep } = useUserPreferences()
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [navigationDirection, setNavigationDirection] =
    useState<NavigationDirections>()
  const isSSIEnabled = getRuntimeConfig().NEXT_PUBLIC_SSI_ENABLED === 'true'
  const faucetStepLabel = isMainnetChain(chainId)
    ? i18n._('Funds')
    : i18n._('Faucet')

  const steps = [
    { shortLabel: i18n._('MetaMask'), component: <DownloadMetamask /> },
    { shortLabel: i18n._('Connect'), component: <ConnectAccount /> },
    { shortLabel: i18n._('Tokens'), component: <ImportCustomTokens /> },
    { shortLabel: faucetStepLabel, component: <Faucet /> },

    ...((isSSIEnabled ? [{ shortLabel: 'SSI', component: <SSI /> }] : []) as {
      shortLabel: string
      component: ReactElement
    }[]),

    { shortLabel: i18n._('Ready'), component: <Ready /> }
  ]

  const stepLabels = steps.map((step) => step.shortLabel)

  useEffect(() => {
    if (onboardingStep > steps.length) setOnboardingStep(0)
  }, [onboardingStep, setOnboardingStep, steps.length])

  useEffect(() => {
    if (accountId && web3Provider && getSupportedChainIds().includes(chainId)) {
      setOnboardingCompleted(true)
    }
  }, [accountId, balance, chainId, web3Provider])

  return (
    <div className={styles.wrapper}>
      <Header />
      <Container className={styles.cardWrapper}>
        <div className={styles.cardContainer}>
          <Stepper
            stepLabels={stepLabels}
            currentStep={onboardingStep}
            onboardingCompleted={onboardingCompleted}
            setCurrentStep={setOnboardingStep}
            setNavigationDirection={setNavigationDirection}
          />
          <Main
            currentStep={onboardingStep}
            navigationDirection={navigationDirection}
            steps={steps}
          />
          <Navigation
            currentStep={onboardingStep}
            onboardingCompleted={onboardingCompleted}
            setCurrentStep={setOnboardingStep}
            setNavigationDirection={setNavigationDirection}
            totalStepsCount={steps.length}
          />
        </div>
      </Container>
    </div>
  )
}
