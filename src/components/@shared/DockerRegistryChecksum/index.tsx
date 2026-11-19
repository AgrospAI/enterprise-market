import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ChangeEvent, ReactElement, useEffect, useState } from 'react'
import Input from '@shared/FormInput'
import Button from '@shared/atoms/Button'
import { getContainerChecksum } from '@utils/docker'
import { toast } from 'react-toastify'
import styles from './index.module.css'

interface DockerRegistryChecksumProps {
  image: string
  tag: string
  onChecksumResolved: (checksum: string) => void | Promise<void>
}

export default function DockerRegistryChecksum({
  image,
  tag,
  onChecksumResolved
}: DockerRegistryChecksumProps): ReactElement {
  useLingui()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isResolving, setIsResolving] = useState(false)

  useEffect(() => {
    setUsername('')
    setPassword('')
    setIsResolving(false)
  }, [image, tag])

  async function handleResolve() {
    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      toast.error(i18n._('Docker Hub username and access token are required.'))
      return
    }

    setIsResolving(true)
    const containerInfo = await getContainerChecksum(image.trim(), tag.trim(), {
      username: normalizedUsername,
      password
    })
    setIsResolving(false)

    if (!containerInfo.checksum) return

    setPassword('')
    await onChecksumResolved(containerInfo.checksum)
    toast.success(i18n._('Docker image checksum resolved.'))
  }

  return (
    <section className={styles.container} aria-live="polite">
      <h4>
        <Trans id="Private Docker Hub image" />
      </h4>
      <p>
        <Trans id="Enter a Docker Hub username and a read-only access token to calculate the Linux/amd64 checksum. The credentials are not added to the asset metadata." />{' '}
      </p>
      <div className={styles.fields}>
        <Input
          name="dockerChecksumUsername"
          label={i18n._('Docker Hub username')}
          type="text"
          value={username}
          autoComplete="username"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setUsername(event.target.value)
          }
          required
        />
        <Input
          name="dockerChecksumToken"
          label={i18n._('Docker Hub access token')}
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
        />
      </div>
      <Button
        type="button"
        style="outlined"
        disabled={
          !image.trim() ||
          !tag.trim() ||
          !username.trim() ||
          !password ||
          isResolving
        }
        onClick={handleResolve}
      >
        {isResolving ? i18n._('Calculating...') : i18n._('Calculate checksum')}
      </Button>
    </section>
  )
}
