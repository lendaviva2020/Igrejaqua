"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setNotificationPreferenceAction } from "@/modules/notifications/actions";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABEL, type NotificationCategory } from "@/modules/notifications/preferences";

export function PreferenceToggles({ initial }: { initial: Readonly<Record<NotificationCategory, boolean>> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<NotificationCategory, boolean>>({ ...initial });
  const [error, setError] = useState<string | null>(null);
  const toggle = (category: NotificationCategory, enabled: boolean) => {
    const previous = values[category];
    setError(null);
    setValues({ ...values, [category]: enabled });
    start(async () => {
      const r = await setNotificationPreferenceAction({ category, enabled });
      if (r.ok) router.refresh();
      else { setValues((v) => ({ ...v, [category]: previous })); setError(r.error.message); }
    });
  };
  return (
    <div>
      <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
        {NOTIFICATION_CATEGORIES.map((c) => (
          <li key={c}>
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
              <span><span className="block font-medium">{NOTIFICATION_CATEGORY_LABEL[c].title}</span><span className="block text-sm text-texto-2">{NOTIFICATION_CATEGORY_LABEL[c].hint}</span></span>
              <input type="checkbox" role="switch" className="size-6 accent-ambar" checked={values[c]} disabled={pending} onChange={(e) => toggle(c, e.target.checked)} />
            </label>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
