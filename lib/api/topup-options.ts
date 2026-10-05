export interface StudioCardShopOption {
  amount: number;
  url: string;
}

interface BackendCardShopOption {
  amount?: unknown;
  id?: unknown;
  label?: unknown;
  url?: unknown;
}

function parseLegacyCardShopAmount(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/(?:^|[^\d.])(\d+)(?![\d.])/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

/** Match New's card-shop option normalization, including its legacy id/label shape. */
export function normalizeStudioCardShopOptions(
  enableRedemption: unknown,
  rawOptions: unknown,
): StudioCardShopOption[] {
  if (enableRedemption === false || !Array.isArray(rawOptions)) return [];

  const options: StudioCardShopOption[] = [];
  for (const rawOption of rawOptions) {
    if (
      typeof rawOption !== "object" ||
      rawOption === null ||
      Array.isArray(rawOption)
    ) {
      continue;
    }

    const option = rawOption as BackendCardShopOption;
    let amount: unknown;
    if ("amount" in option) {
      amount = option.amount;
    } else {
      amount =
        parseLegacyCardShopAmount(option.label) ??
        parseLegacyCardShopAmount(option.id);
    }

    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      typeof option.url !== "string"
    ) {
      continue;
    }

    try {
      const url = new URL(option.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      options.push({ amount, url: url.href });
    } catch {
      // Ignore incomplete or invalid card-shop links, as New's wallet does.
    }
  }

  return options;
}
