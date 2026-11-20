/**
 * Daily Safe Spend Limit - Category Settings
 * Allows users to select which expense categories count toward the daily limit
 */

const STORAGE_KEY = "familypath_daily_limit_categories";

/**
 * Get enabled category IDs for daily limit calculation
 * @returns {string[]} Array of category IDs that are included in daily limit
 */
export function getDailyLimitCategories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse daily limit categories:", e);
  }
  // Default: all expense categories included
  return "all";
}

/**
 * Set enabled category IDs for daily limit calculation
 * @param {string[]|"all"} categoryIds - Array of category IDs, or "all" for all categories
 */
export function setDailyLimitCategories(categoryIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categoryIds));
  } catch (e) {
    console.warn("Failed to save daily limit categories:", e);
  }
}

/**
 * Toggle a category in the daily limit
 * @param {string} categoryId - Category ID to toggle
 */
export function toggleDailyLimitCategory(categoryId) {
  const current = getDailyLimitCategories();
  if (current === "all") {
    // If currently "all", start with all expense categories except the toggled one
    // We'll need to fetch categories to get the full list
    return { action: "needs_categories", categoryId };
  }
  const updated = current.includes(categoryId)
    ? current.filter(id => id !== categoryId)
    : [...current, categoryId];
  setDailyLimitCategories(updated.length === 0 ? "all" : updated);
  return updated;
}

/**
 * Check if a category is included in daily limit
 * @param {string} categoryId - Category ID to check
 * @returns {boolean}
 */
export function isCategoryInDailyLimit(categoryId) {
  const current = getDailyLimitCategories();
  if (current === "all") return true;
  return current.includes(categoryId);
}

/**
 * Get default daily limit config (all expense categories)
 */
export function getDefaultDailyLimitConfig(categories) {
  return categories
    .filter(c => c.type === "expense" && !c.deleted)
    .map(c => c.id);
}

/**
 * Filter transactions for daily limit calculation based on settings
 * @param {Array} transactions - All transactions
 * @param {Array} categories - All categories (for name lookup)
 * @returns {Array} Filtered transactions
 */
export function filterTransactionsForDailyLimit(transactions, categories) {
  const enabledCategories = getDailyLimitCategories();
  if (enabledCategories === "all") return transactions;

  const enabledSet = new Set(enabledCategories);
  return transactions.filter(t =>
    t.type === "expense" && enabledSet.has(t.categoryId)
  );
}

/**
 * Get daily limit settings summary for UI
 * @param {Array} categories - All categories
 * @returns {Object} Summary with enabled/disabled counts and category details
 */
export function getDailyLimitSummary(categories) {
  const expenseCategories = categories.filter(c => c.type === "expense" && !c.deleted);
  const enabledCategories = getDailyLimitCategories();

  if (enabledCategories === "all") {
    return {
      mode: "all",
      total: expenseCategories.length,
      enabled: expenseCategories.length,
      disabled: 0,
      categories: expenseCategories.map(c => ({ ...c, enabled: true })),
    };
  }

  const enabledSet = new Set(enabledCategories);
  return {
    mode: "custom",
    total: expenseCategories.length,
    enabled: enabledCategories.length,
    disabled: expenseCategories.length - enabledCategories.length,
    categories: expenseCategories.map(c => ({
      ...c,
      enabled: enabledSet.has(c.id),
    })),
  };
}