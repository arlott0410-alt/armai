import { useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { PageShell } from '../../components/ui'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import MerchantTelegram from './MerchantTelegram'
import MerchantFacebook from './MerchantFacebook'
import MerchantWhatsApp from './MerchantWhatsApp'

type TabValue = 'facebook' | 'whatsapp' | 'telegram'

export default function ChannelsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabValue>('whatsapp')

  const tabItems = [
    {
      value: 'facebook' as const,
      label: t('tabs.facebook'),
      description: t('channels.facebook.description'),
    },
    {
      value: 'whatsapp' as const,
      label: t('tabs.whatsapp'),
      description: t('channels.whatsapp.description'),
    },
    {
      value: 'telegram' as const,
      label: t('tabs.telegram'),
      description: t('channels.telegram.description'),
    },
  ]

  return (
    <PageShell title={t('page.channels.title')} description={t('nav.channels')}>
      <Tabs tabsId="channels" value={tab} onChange={setTab} items={tabItems} />
      <TabPanel>
        {tab === 'facebook' && (
          <div className="mt-4">
            <MerchantFacebook />
          </div>
        )}
        {tab === 'whatsapp' && (
          <div className="mt-4">
            <MerchantWhatsApp />
          </div>
        )}
        {tab === 'telegram' && (
          <div className="mt-4">
            <MerchantTelegram />
          </div>
        )}
      </TabPanel>
    </PageShell>
  )
}
