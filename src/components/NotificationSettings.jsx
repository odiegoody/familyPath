import { useState, useEffect } from "react";
import { formatRupiah } from "../utils/format";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  scheduleDailyReminder,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../utils/notifications";
import { Bell, BellOff, Volume2, VolumeX, Vibrate, VibrateOff, Clock, Calendar } from "lucide-react";

/**
 * Notification Settings Component
 * Can be used as a modal or standalone page
 */
export default function NotificationSettings({ onClose }) {
  const [settings, setSettings] = useState(() => getNotificationSettings());
  const [permission, setPermission] = useState("default");

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);

    // Reschedule reminder if time/days changed
    if (key === "reminderTime" || key === "reminderDays") {
      scheduleDailyReminder();
    }
  };

  const handlePermissionRequest = async () => {
    const result = await requestNotificationPermission();
    setPermission(Notification.permission);
    if (result.granted) {
      updateSetting("enabled", true);
    }
  };

  const toggleDay = (day) => {
    const newDays = settings.reminderDays.includes(day)
      ? settings.reminderDays.filter(d => d !== day)
      : [...settings.reminderDays, day];
    updateSetting("reminderDays", newDays);
  };

  return (
    <div className="space-y-6">
      {/* Permission Status */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-on-surface">Status Notifikasi</h3>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            permission === "granted" ? "bg-green-100 text-green-800" :
            permission === "denied" ? "bg-red-100 text-red-800" :
            "bg-amber-100 text-amber-800"
          }`}>
            {permission === "granted" && <Bell className="h-3.5 w-3.5" />}
            {permission === "denied" && <BellOff className="h-3.5 w-3.5" />}
            {permission === "granted" ? "Diizinkan" : permission === "denied" ? "Ditolak" : "Belum ditanya"}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">
          {permission === "granted"
            ? "Notifikasi aktif. Browser akan menampilkan notifikasi sesuai pengaturan."
            : permission === "denied"
            ? "Notifikasi diblokir. Aktifkan di pengaturan browser (ikon gembok di address bar)."
            : "Browser belum menanyakan izin. Klik tombol di bawah untuk meminta izin."}
        </p>
        {permission !== "granted" && (
          <button
            onClick={handlePermissionRequest}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary"
          >
            Minta Izin Notifikasi
          </button>
        )}
      </div>

      {/* Master Toggle */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-medium text-on-surface">Aktifkan Semua Notifikasi</p>
            <p className="text-xs text-on-surface-variant">Mati/nyalakan semua notifikasi sekaligus</p>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e => updateSetting("enabled", e.target.checked)}
            className="h-6 w-6 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      {/* Notification Types */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">Jenis Notifikasi</h4>
        {[
          { key: "dailyLimitAlert", label: "Limit Harian Tercapai", desc: "Notifikasi saat pengeluaran harian melebihi limit aman", icon: "⚠️", color: "#c14f3d" },
          { key: "dailyLimitWarning", label: "Peringatan Dini (80%)", desc: "Notifikasi saat pengeluaran mencapai 80% limit harian", icon: "⚡", color: "#e0a72c" },
          { key: "budgetExceeded", label: "Budget Kategori Habis", desc: "Notifikasi saat budget kategori tertentu tercapai 100%", icon: "💸", color: "#c14f3d" },
          { key: "budgetWarning", label: "Peringatan Budget (90%)", desc: "Notifikasi saat budget kategori mencapai 90%", icon: "⚠️", color: "#e0a72c" },
          { key: "monthlySummary", label: "Ringkasan Bulanan", desc: "Notifikasi ringkasan keuangan setiap tanggal 1", icon: "📊", color: "#2f8f4e" },
        ].map(({ key, label, desc, icon, color }) => (
          <label
            key={key}
            className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 cursor-pointer disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl" style={{ backgroundColor: `${color}15` }}>
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface">{label}</p>
              <p className="text-xs text-on-surface-variant">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={settings[key] && settings.enabled}
              onChange={e => updateSetting(key, e.target.checked)}
              disabled={!settings.enabled}
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        ))}
      </div>

      {/* Sound & Vibration */}
      <div className="space-y-3 pt-2 border-t border-outline-variant">
        <h4 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">Suara & Getaran</h4>
        {[
          { key: "soundEnabled", label: "Suara Notifikasi", desc: "Mainkan suara notifikasi (beep singkat)", icon: Volume2, iconOff: VolumeX },
          { key: "vibrationEnabled", label: "Getaran (Mobile)", desc: "Getaran perangkat saat notifikasi muncul", icon: Vibrate, iconOff: VibrateOff },
        ].map(({ key, label, desc, icon, iconOff }) => (
          <label
            key={key}
            className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 cursor-pointer disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {settings[key] ? <icon className="h-5 w-5" /> : <iconOff className="h-5 w-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface">{label}</p>
              <p className="text-xs text-on-surface-variant">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={settings[key] && settings.enabled}
              onChange={e => updateSetting(key, e.target.checked)}
              disabled={!settings.enabled}
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        ))}
      </div>

      {/* Reminder Time */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
        <h4 className="mb-3 font-display text-sm font-semibold text-on-surface flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Pengingat Harian
        </h4>
        <p className="text-xs text-on-surface-variant mb-4">Waktu notifikasi pengingat untuk mencatat transaksi harian</p>

        <label className="flex items-center gap-3">
          <input
            type="time"
            value={settings.reminderTime}
            onChange={e => updateSetting("reminderTime", e.target.value)}
            disabled={!settings.enabled}
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
          />
        </label>

        <p className="mt-3 text-xs text-on-surface-variant">Hari aktif pengingat:</p>
        <div className="mt-2 flex gap-2 flex-wrap">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day, i) => (
            <label key={day} className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50">
              <input
                type="checkbox"
                checked={settings.reminderDays.includes(i)}
                onChange={e => toggleDay(i)}
                disabled={!settings.enabled}
                className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20"
              />
              {day}
            </label>
          ))}
        </div>
      </div>

      {/* Reset to defaults */}
      <button
        onClick={() => {
          if (confirm("Reset semua pengaturan notifikasi ke default?")) {
            saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
            setSettings(DEFAULT_NOTIFICATION_SETTINGS);
            scheduleDailyReminder();
          }
        }}
        className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
      >
        Reset ke Default
      </button>

      {onClose && (
        <button onClick={onClose} className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-semibold text-on-surface">
          Tutup
        </button>
      )}
    </div>
  );
}

function updateSetting(key, value) {
  // This is a placeholder - actual update happens via props
  // The real update is handled by the parent component
  console.log("updateSetting called:", key, value);
}

function toggleDay(day) {
  // Placeholder
  console.log("toggleDay called:", day);
}