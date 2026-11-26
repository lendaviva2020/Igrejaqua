"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setNotificationPreferenceAction } from "@/modules/notifications/actions";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABEL, NOTIFICATION_CHANNEL_LABEL, type ChannelPreferences, type NotificationCategory, type NotificationChannel } from "@/modules/notifications/preferences";

interface Props { readonly initial: ChannelPreferences; readonly channels: readonly NotificationChannel[] }

export function PreferenceToggles({ initial, channels }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<ChannelPreferences>(initial);
  const [error, setError] = useState<string | null>(null);
  const toggle = (channel: NotificationChannel, category: NotificationCategory, enabled: boolean) => {
    const previous = values[channel][category];
    setError(null);
    setValues((v) => ({ ...v, [channel]: { ...v[channel], [category]: enabled } }));
    start(async () => {
      const r = await setNotificationPreferenceAction({ category, channel, enabled });
      if (r.ok) router.refresh();
      else { setValues((v) => ({ ...v, [channel]: { ...v[channel], [category]: previous } })); setError(r.error.message); }
    });
  };
  return (
    <div className="flex flex-col gap-6">
      {channels.map((channel) => (
        <fieldset key={channel}>
          <legend className="mb-2 text-sm font-semibold text-texto-2">{NOTIFICATION_CHANNEL_LABEL[channel]}</legend>
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <li key={c}>
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
                  <span><span className="block font-medium">{NOTIFICATION_CATEGORY_LABEL[c].title}</span><span className="block text-sm text-texto-2">{NOTIFICATION_CATEGORY_LABEL[c].hint}</span></span>
                  <input type="checkbox" role="switch" className="size-6 accent-ambar" checked={values[channel][c]} disabled={pending} onChange={(e) => toggle(channel, c, e.target.checked)} />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
