import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nProvider'
import { systemSettingsApi, getSlipUrl } from '../../lib/api'
import { PageShell, Card, CardHeader, CardBody } from '../../components/ui'
import { toast } from 'sonner'

const bankSchema = z.object({
  bank_name: z.string().min(1, 'Required'),
  account_number: z.string().min(1, 'Required'),
  account_holder: z.string().min(1, 'Required'),
  qr_image_url: z.string().nullable().optional(),
})

type BankFormValues = z.infer<typeof bankSchema>

export default function SuperSettings() {
  const { user } = useAuth()
  const { t } = useI18n()
  const token = user?.accessToken ?? null
  const [loading, setLoading] = useState(true)
  const [qrUploading, setQrUploading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bank_name: '',
      account_number: '',
      account_holder: '',
      qr_image_url: null,
    },
  })

  const qrImageUrl = watch('qr_image_url')

  useEffect(() => {
    systemSettingsApi
      .get()
      .then((r) => {
        if (r.bank) {
          setValue('bank_name', r.bank.bank_name)
          setValue('account_number', r.bank.account_number)
          setValue('account_holder', r.bank.account_holder)
          setValue('qr_image_url', r.bank.qr_image_url ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setValue])

  const onQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setQrUploading(true)
    try {
      const { qr_image_url } = await systemSettingsApi.uploadQr(token, file)
      setValue('qr_image_url', qr_image_url)
      toast.success('QR image uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setQrUploading(false)
    }
  }

  const onSubmit = async (data: BankFormValues) => {
    if (!token) return
    try {
      await systemSettingsApi.patch(token, {
        bank: {
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_holder: data.account_holder,
          qr_image_url: data.qr_image_url ?? null,
        },
      })
      toast.success(t('common.save') + ' — OK')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  if (loading) {
    return (
      <PageShell title={t('admin.settings')} description="System settings">
        <p className="text-[var(--armai-text-muted)]">{t('common.loading')}</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={t('admin.settings')}
      description="Subscription bank account (shown on Pricing)"
    >
      <Card className="max-w-xl">
        <CardHeader title={t('pricing.bankDetails')} />
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--armai-text)] mb-1">
                Bank name
              </label>
              <input
                {...register('bank_name')}
                className="w-full rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] px-3 py-2 text-[var(--armai-text)]"
                placeholder="e.g. BCEL"
              />
              {errors.bank_name && (
                <p className="mt-1 text-xs text-red-500">{errors.bank_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--armai-text)] mb-1">
                Account number
              </label>
              <input
                {...register('account_number')}
                className="w-full rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] px-3 py-2 text-[var(--armai-text)]"
                placeholder="1234567890"
              />
              {errors.account_number && (
                <p className="mt-1 text-xs text-red-500">{errors.account_number.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--armai-text)] mb-1">
                Account holder
              </label>
              <input
                {...register('account_holder')}
                className="w-full rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] px-3 py-2 text-[var(--armai-text)]"
                placeholder="ArmAI Subscription"
              />
              {errors.account_holder && (
                <p className="mt-1 text-xs text-red-500">{errors.account_holder.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--armai-text)] mb-1">
                QR image (upload to R2)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onQrFileChange}
                disabled={!token || qrUploading}
                className="block w-full text-sm text-[var(--armai-text-secondary)]"
              />
              {qrImageUrl && (
                <div className="mt-2">
                  <img
                    src={getSlipUrl(qrImageUrl)}
                    alt="QR"
                    className="h-24 w-24 object-contain border border-[var(--armai-border)] rounded"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-[var(--armai-primary)] px-4 py-2 text-white font-medium disabled:opacity-50"
              >
                {isSubmitting ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>
    </PageShell>
  )
}
