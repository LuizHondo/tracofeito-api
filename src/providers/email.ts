export type Email = { to: string; subject: string; text: string };
export interface Mailer {
	send(email: Email): Promise<void>;
}

export class ResendMailer implements Mailer {
	constructor(
		private apiKey: string,
		private from: string,
	) {}
	async send({ to, subject, text }: Email) {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				authorization: `Bearer ${this.apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ from: this.from, to, subject, text }),
		});
		if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
	}
}

export class ConsoleMailer implements Mailer {
	async send(email: Email) {
		console.log(
			`[email] to=${email.to} subject=${email.subject}\n${email.text}`,
		);
	}
}

export function mailerFromEnv(): Mailer {
	const { RESEND_API_KEY, EMAIL_FROM } = process.env;
	return RESEND_API_KEY && EMAIL_FROM
		? new ResendMailer(RESEND_API_KEY, EMAIL_FROM)
		: new ConsoleMailer();
}
