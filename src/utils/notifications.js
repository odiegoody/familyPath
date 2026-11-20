import { useState, useEffect } from "react";
import { formatRupiah } from "./format";

/**
 * Daily Notification System for FamilyPath
 * Handles browser notifications for daily spending limits, budget alerts, etc.
 */

const NOTIFICATION_SETTINGS_KEY = "familypath_notification_settings";

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  dailyLimitAlert: true,           // Alert when daily safe spend exceeded
  dailyLimitWarning: true,         // Warning at 80% of daily limit
  budgetExceeded: true,            // Alert when category budget exceeded
  budgetWarning: true,             // Warning at 90% of category budget
  monthlySummary: true,            // Monthly summary notification
  reminderTime: "20:00",           // Daily reminder time (HH:mm)
  reminderDays: [1,2,3,4,5,6,0],   // Days to show reminder (0=Sunday)
  soundEnabled: true,              // Play notification sound
  vibrationEnabled: true,          // Vibrate on mobile
};

/**
 * Get notification settings from localStorage
 */
export function getNotificationSettings() {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to parse notification settings:", e);
  }
  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

/**
 * Save notification settings to localStorage
 */
export function saveNotificationSettings(settings) {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save notification settings:", e);
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return { granted: false, reason: "not_supported" };
  }

  if (Notification.permission === "granted") {
    return { granted: true };
  }

  if (Notification.permission === "denied") {
    return { granted: false, reason: "denied" };
  }

  const permission = await Notification.requestPermission();
  return { granted: permission === "granted" };
}

/**
 * Check if notifications are supported and permitted
 */
export function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Show a local notification
 */
export function showNotification(title, options = {}) {
  if (!canNotify()) return null;

  const settings = getNotificationSettings();
  if (!settings.enabled) return null;

  const notification = new Notification(title, {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: options.tag || "familypath-notification",
    requireInteraction: options.requireInteraction || false,
    silent: !settings.soundEnabled,
    vibrate: settings.vibrationEnabled ? [200, 100, 200] : undefined,
    ...options,
  });

  // Auto-close after 10 seconds unless requireInteraction
  if (!options.requireInteraction) {
    setTimeout(() => notification.close(), 10000);
  }

  return notification;
}

/**
 * Play notification sound (optional)
 */
export function playNotificationSound() {
  const settings = getNotificationSettings();
  if (!settings.soundEnabled) return;

  // Create a simple beep using Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.debug("Could not play notification sound:", e);
  }
}

/**
 * Check daily safe spend limit and show notification if needed
 */
export async function checkDailyLimitNotification(db, analytics) {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.dailyLimitAlert) return;

  const safeSpend = await analytics.calculateDailySafeSpend({ useCategoryFilter: true });

  if (!safeSpend || safeSpend.dailySafeSpend <= 0) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

  const todayTxs = await db.transactions
    .where("date").between(todayStart, todayEnd, true, true)
    .and(t => t.type === "expense" && !t.deleted)
    .toArray();

  const spentToday = todayTxs.reduce((s, t) => s + t.amount, 0);
  const dailyLimit = safeSpend.dailySafeSpend;
  const percentage = (spentToday / dailyLimit) * 100;

  // Check if already notified today
  const notifiedKey = `daily_limit_notified_${now.toISOString().slice(0, 10)}`;
  const alreadyNotified = localStorage.getItem(notifiedKey);

  if (percentage >= 100 && !alreadyNotified) {
    showNotification("⚠️ Limit Harian Tercapai!", {
      body: `Kamu sudah mengeluarkan ${formatRupiah(spentToday)} hari ini (limit: ${formatRupiah(dailyLimit)}/hari). Pertimbangkan untuk menahan belanja non-esensial.`,
      tag: "daily-limit-exceeded",
      requireInteraction: true,
    });
    playNotificationSound();
    localStorage.setItem(notifiedKey, "exceeded");
  } else if (percentage >= 80 && percentage < 100 && settings.dailyLimitWarning && !alreadyNotified) {
    showNotification("⚡ Peringatan Limit Harian", {
      body: `Kamu sudah menggunakan ${percentage.toFixed(0)}% limit harian (${formatRupiah(spentToday)} dari ${formatRupiah(dailyLimit)}). Sisa: ${formatRupiah(dailyLimit - spentToday)}.`,
      tag: "daily-limit-warning",
    });
    playNotificationSound();
    localStorage.setItem(notifiedKey, "warning");
  }
}

/**
 * Check category budgets and show notification if exceeded
 */
export async function checkBudgetNotifications(db) {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.budgetExceeded) return;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const budgets = await db.budgets
    .where("month").equals(monthKey)
    .and(b => !b.deleted)
    .toArray();

  const categories = await db.categories.filter(c => !c.deleted).toArray();
  const categoryMap = {};
  categories.forEach(c => categoryMap[c.id] = c);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

  const txs = await db.transactions
    .where("date").between(monthStart, monthEnd, true, true)
    .and(t => t.type === "expense" && !t.deleted)
    .toArray();

  const spentMap = {};
  txs.forEach(t => {
    spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amount;
  });

  for (const budget of budgets) {
    const cat = categoryMap[budget.categoryId];
    if (!cat) continue;

    const spent = spentMap[budget.categoryId] || 0;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    const notifiedKey = `budget_notified_${budget.categoryId}_${monthKey}`;
    const alreadyNotified = localStorage.getItem(notifiedKey);

    if (percentage >= 100 && !alreadyNotified) {
      showNotification(`💸 Budget ${cat.name} Tercapai!`, {
        body: `Pengeluaran ${cat.name} sudah ${formatRupiah(spent)} dari budget ${formatRupiah(budget.amount)} (${percentage.toFixed(0)}%).`,
        tag: `budget-exceeded-${budget.categoryId}`,
        requireInteraction: true,
      });
      playNotificationSound();
      localStorage.setItem(notifiedKey, "exceeded");
    } else if (percentage >= 90 && percentage < 100 && settings.budgetWarning && !alreadyNotified) {
      showNotification(`⚠️ Budget ${cat.name} Hampir Habis`, {
        body: `Sudah terpakai ${percentage.toFixed(0)}% (${formatRupiah(spent)} dari ${formatRupiah(budget.amount)}). Sisa: ${formatRupiah(budget.amount - spent)}.`,
        tag: `budget-warning-${budget.categoryId}`,
      });
      playNotificationSound();
      localStorage.setItem(notifiedKey, "warning");
    }
  }
}

/**
 * Show monthly summary notification
 */
export async function showMonthlySummaryNotification(db) {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.monthlySummary) return;

  const now = new Date();
  // Only show on 1st of month
  if (now.getDate() !== 1) return;

  const notifiedKey = `monthly_summary_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (localStorage.getItem(notifiedKey)) return;

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = lastMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).getTime();
  const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1).getTime() - 1;

  const txs = await db.transactions
    .where("date").between(monthStart, monthEnd, true, true)
    .and(t => !t.deleted)
    .toArray();

  const totalIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  showNotification(`📊 Ringkasan Bulan ${monthLabel}`, {
    body: `Pemasukan: ${formatRupiah(totalIncome)} | Pengeluaran: ${formatRupiah(totalExpense)} | ${net >= 0 ? 'Surplus' : 'Defisit'}: ${formatRupiah(Math.abs(net))}`,
    tag: "monthly-summary",
    requireInteraction: true,
  });
  playNotificationSound();
  localStorage.setItem(notifiedKey, "shown");
}

/**
 * Schedule daily reminder notification
 */
export function scheduleDailyReminder() {
  const settings = getNotificationSettings();
  if (!settings.enabled) return;

  const now = new Date();
  const [hours, minutes] = settings.reminderTime.split(":").map(Number);
  const today = settings.reminderDays.includes(now.getDay());

  if (!today) return;

  const reminderTime = new Date(now);
  reminderTime.setHours(hours, minutes, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
    // Find next valid day
    while (!settings.reminderDays.includes(reminderTime.getDay())) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
  }

  const delay = reminderTime.getTime() - now.getTime();

  // Clear existing timeout
  if (window.__familypath_reminder_timeout) {
    clearTimeout(window.__familypath_reminder_timeout);
  }

  window.__familypath_reminder_timeout = setTimeout(() => {
    showNotification("📝 Waktu Catat Transaksi", {
      body: "Jangan lupa catat pengeluaran hari ini agar laporan keuangan tetap akurat!",
      tag: "daily-reminder",
      requireInteraction: true,
    });
    playNotificationSound();

    // Schedule next reminder
    scheduleDailyReminder();
  }, delay);
}

/**
 * Initialize notification system (call on app startup)
 */
export async function initNotifications(db, analytics) {
  // Request permission if not already granted
  if (Notification.permission === "default") {
    // Delay request to avoid blocking UI
    setTimeout(() => requestNotificationPermission(), 5000);
  }

  // Schedule daily reminder
  scheduleDailyReminder();

  // Check notifications periodically (every 30 minutes)
  setInterval(async () => {
    await checkDailyLimitNotification(db, analytics);
    await checkBudgetNotifications(db);
    await showMonthlySummaryNotification(db);
  }, 30 * 60 * 1000);

  // Initial check
  await checkDailyLimitNotification(db, analytics);
  await checkBudgetNotifications(db);
  await showMonthlySummaryNotification(db);
}