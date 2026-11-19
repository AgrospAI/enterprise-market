import { enUS, es, de } from 'date-fns/locale'
import { useLingui } from '@lingui/react'
import { ReactElement, useEffect, useState } from 'react'
import { format, formatDistance } from 'date-fns'

interface TimeProps {
  date: string
  relative?: boolean
  isUnix?: boolean
  displayFormat?: string
  className?: string
}

export default function Time({
  date,
  relative,
  isUnix,
  displayFormat,
  className
}: TimeProps): ReactElement {
  const { i18n } = useLingui()
  const locale = { en: enUS, es, de }[i18n.locale] || enUS

  const [dateIso, setDateIso] = useState<string>()
  const [dateNew, setDateNew] = useState<Date>()

  useEffect(() => {
    if (!date) return
    const dateNew = isUnix ? new Date(Number(date)) : new Date(date)
    setDateIso(dateNew.toISOString())
    setDateNew(dateNew)
  }, [date, isUnix])

  return !dateIso || !dateNew ? (
    <></>
  ) : (
    <time
      title={format(dateNew, displayFormat || 'PPppp', { locale })}
      dateTime={dateIso}
      className={className || undefined}
    >
      {relative
        ? formatDistance(dateNew, Date.now(), { addSuffix: true, locale })
        : format(dateNew, displayFormat || 'PP', { locale })}
    </time>
  )
}
