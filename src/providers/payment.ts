export type PayoutAccount = {
	accountId: string;
	walletId: string;
	apiKey: string;
};

export type CreatorInfo = {
	name: string;
	email: string;
	cpfCnpj: string;
	mobilePhone: string;
	postalCode: string;
	addressNumber: string;
	incomeValueCents: number;
	birthDate?: string; // required for individuals (CPF)
};

export type Buyer = { name: string; email: string; cpfCnpj: string };

export type PaymentEvent = {
	/** Provider event id; unique, used for idempotency. */
	eventId: string;
	type: "paid" | "refunded";
	chargeId: string;
	/** Amount received after provider costs, when the event carries it. */
	netCents?: number;
};

export interface PaymentProvider {
	/** Starts payout onboarding with a provider sub-account. */
	createPayoutAccount(creator: CreatorInfo): Promise<PayoutAccount>;
	isPayoutEnabled(account: PayoutAccount): Promise<boolean>;
	/** One-off charge whose full proceeds go to `walletId`; the buyer picks Pix, boleto or card. */
	createCharge(input: {
		buyer: Buyer;
		amountCents: number;
		dueAt: Date;
		description: string;
		reference: string;
		walletId: string;
	}): Promise<{ chargeId: string; url: string }>;
	refund(chargeId: string): Promise<void>;
	/** Event from a provider webhook, or null if unauthentic or not one we act on. */
	parseWebhook(
		headers: Record<string, string | string[] | undefined>,
		body: unknown,
	): PaymentEvent | null;
}

const ASAAS_PAID = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
const ASAAS_REFUNDED = ["PAYMENT_REFUNDED"];

const reais = (cents: number) => Number((cents / 100).toFixed(2));
const day = (d: Date) => d.toISOString().slice(0, 10);

export class AsaasPaymentProvider implements PaymentProvider {
	constructor(
		private apiKey: string,
		private webhookToken: string,
		private baseUrl = "https://api-sandbox.asaas.com/v3",
	) {}

	private async call<T>(
		method: string,
		path: string,
		body?: unknown,
		key = this.apiKey,
	): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: { access_token: key, "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`asaas ${res.status}: ${await res.text()}`);
		return (await res.json()) as T;
	}

	async createPayoutAccount(c: CreatorInfo) {
		const { id, walletId, apiKey } = await this.call<{
			id: string;
			walletId: string;
			apiKey: string;
		}>("POST", "/accounts", {
			name: c.name,
			email: c.email,
			cpfCnpj: c.cpfCnpj,
			mobilePhone: c.mobilePhone,
			postalCode: c.postalCode,
			addressNumber: c.addressNumber,
			incomeValue: reais(c.incomeValueCents),
			birthDate: c.birthDate,
		});
		return { accountId: id, walletId, apiKey };
	}

	async isPayoutEnabled(account: PayoutAccount) {
		const s = await this.call<{
			commercialInfo: string;
			bankAccountInfo: string;
			documentation: string;
			general: string;
		}>("GET", "/myAccount/status", undefined, account.apiKey);
		return s.general === "APPROVED";
	}

	async createCharge(i: Parameters<PaymentProvider["createCharge"]>[0]) {
		const { id: customer } = await this.call<{ id: string }>(
			"POST",
			"/customers",
			{ name: i.buyer.name, email: i.buyer.email, cpfCnpj: i.buyer.cpfCnpj },
		);
		const { id, invoiceUrl } = await this.call<{
			id: string;
			invoiceUrl: string;
		}>("POST", "/payments", {
			customer,
			billingType: "UNDEFINED",
			value: reais(i.amountCents),
			dueDate: day(i.dueAt),
			description: i.description,
			externalReference: i.reference,
			split: [{ walletId: i.walletId, percentualValue: 100 }],
		});
		return { chargeId: id, url: invoiceUrl };
	}

	async refund(chargeId: string) {
		await this.call("POST", `/payments/${chargeId}/refund`, {});
	}

	parseWebhook(
		headers: Record<string, string | string[] | undefined>,
		body: unknown,
	): PaymentEvent | null {
		if (headers["asaas-access-token"] !== this.webhookToken) return null;
		const b = body as {
			id?: unknown;
			event?: unknown;
			payment?: { id?: unknown; netValue?: unknown };
		};
		if (
			typeof b?.id !== "string" ||
			typeof b.event !== "string" ||
			typeof b.payment?.id !== "string"
		)
			return null;
		const type = ASAAS_PAID.includes(b.event)
			? "paid"
			: ASAAS_REFUNDED.includes(b.event)
				? "refunded"
				: null;
		if (!type) return null;
		const { netValue } = b.payment;
		return {
			eventId: b.id,
			type,
			chargeId: b.payment.id,
			netCents:
				typeof netValue === "number" ? Math.round(netValue * 100) : undefined,
		};
	}
}

export function paymentProviderFromEnv(): PaymentProvider {
	const { ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, ASAAS_BASE_URL } = process.env;
	if (!ASAAS_API_KEY || !ASAAS_WEBHOOK_TOKEN)
		throw new Error("ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN required");
	return new AsaasPaymentProvider(
		ASAAS_API_KEY,
		ASAAS_WEBHOOK_TOKEN,
		ASAAS_BASE_URL,
	);
}
