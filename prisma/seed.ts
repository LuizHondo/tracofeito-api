// Demo data. Re-runnable: wipes the @demo.test users and their courses first.
// Every demo account logs in with password "senha123".
import { db } from "../src/db.ts";
import { hashPassword } from "../src/modules/auth/password.ts";

// Deploys set SEED_IF_EMPTY so existing data survives; plain `npm run seed` always resets the demo users.
if (process.env.SEED_IF_EMPTY && (await db.user.count()) > 0) {
	console.log("Database already has data, skipping seed.");
	await db.$disconnect();
	process.exit(0);
}

const PASSWORD = "senha123";
const DAY = 86_400_000;

await db.course.deleteMany({ where: { owner: { email: { endsWith: "@demo.test" } } } });
await db.user.deleteMany({ where: { email: { endsWith: "@demo.test" } } });

const passwordHash = await hashPassword(PASSWORD);
const user = (username: string, role: "user" | "creator" | "admin", bio = "") =>
	db.user.create({
		data: { email: `${username}@demo.test`, username, role, bio, passwordHash, emailVerified: true },
	});

await user("admin", "admin");
const [marina, caio, bia] = await Promise.all([
	user("marina.tracos", "creator", "Ilustradora e quadrinista. Ensino desenho do zero ao personagem."),
	user("caio.pixel", "creator", "Pixel artist e animador 2D há 10 anos."),
	user("bia.aquarela", "creator", "Aquarelista urbana. Sketchbook sempre à mão."),
]);
const students = await Promise.all(["ana", "joao", "lu"].map((n) => user(n, "user")));

const lessons = (n: number) => [
	{ title: "Boas-vindas", md: "Nesta aula vamos ver o que você vai construir ao longo do curso e quais materiais usar." },
	{ title: "Fundamentos", md: "## Fundamentos\n\nTodo bom desenho começa com **formas simples**. Pratique 15 minutos por dia." },
	{ title: "Mão na massa", md: "Hora de praticar! Siga o exercício abaixo e compartilhe no canal da turma." },
].slice(0, n);

type Seed = {
	owner: { id: string };
	title: string;
	description: string;
	cents: number;
	featured?: boolean;
	published?: boolean;
	lifetime?: number;
};
const catalog: Seed[] = [
	{ owner: marina, title: "Desenho de Personagens do Zero", description: "Do rabisco ao personagem completo: anatomia simplificada, expressões e poses.", cents: 4900, featured: true, lifetime: 59000 },
	{ owner: caio, title: "Pixel Art para Jogos", description: "Crie sprites, tilesets e animações prontas para usar na sua engine favorita.", cents: 3900, featured: true, lifetime: 39000 },
	{ owner: bia, title: "Aquarela Urbana", description: "Pinte a cidade em movimento: luz, reflexos e composição no sketchbook.", cents: 2900 },
	{ owner: marina, title: "Quadrinhos em 30 Dias", description: "Roteiro, storyboard e arte-final de uma HQ curta, passo a passo.", cents: 3500 },
	{ owner: caio, title: "Animação 2D Frame a Frame", description: "Princípios da animação aplicados em ciclos de caminhada, corrida e golpes.", cents: 4500 },
	{ owner: bia, title: "Sketchbook Diário", description: "Crie o hábito de desenhar todo dia com desafios curtos e leves.", cents: 1900 },
	{ owner: caio, title: "Curso em rascunho", description: "Ainda não publicado.", cents: 2500, published: false },
];

const courses = [];
for (const s of catalog) {
	const course = await db.course.create({
		data: {
			ownerId: s.owner.id,
			title: s.title,
			description: s.description,
			baseMonthlyCents: s.cents,
			published: s.published ?? true,
			featured: s.featured ?? false,
		},
	});
	const plans = [
		{ months: 1, discountPercent: 0 },
		{ months: 3, discountPercent: 10 },
		{ months: 12, discountPercent: 25 },
	];
	for (const p of plans) await db.plan.create({ data: { courseId: course.id, ...p } });
	if (s.lifetime) await db.plan.create({ data: { courseId: course.id, months: null, lifetimeCents: s.lifetime } });

	await db.block.createMany({
		data: [
			{ type: "title", config: { text: s.title } },
			{ type: "text", config: { markdown: `${s.description}\n\n- Aulas curtas e práticas\n- Acesso à comunidade\n- Material de apoio` } },
		].map((b, position) => ({ courseId: course.id, position, ...b })),
	});

	const pages = [];
	for (const [i, l] of lessons(3).entries()) {
		const page = await db.page.create({
			data: { courseId: course.id, title: l.title, slug: l.title.toLowerCase().replace(/\W+/g, "-"), position: i },
		});
		const blocks: { type: string; config: object }[] = [
			{ type: "title", config: { text: l.title } },
			{ type: "text", config: { markdown: l.md } },
		];
		if (i === 2) blocks.push({ type: "url", config: { url: "https://example.com/material.pdf", label: "Baixar material de apoio" } });
		await db.block.createMany({
			data: blocks.map((b, position) => ({ courseId: course.id, pageId: page.id, position, ...b })),
		});
		pages.push(page);
	}
	courses.push({ course, pages, plans: await db.plan.findMany({ where: { courseId: course.id } }) });
}

// Students: ana has 3 courses (one expiring soon), joao 1 lifetime, lu 1 canceled.
const buy = async (
	who: (typeof students)[number],
	i: number,
	months: number | null,
	daysLeft: number | null,
	opts: { canceled?: boolean; done?: number } = {},
) => {
	const { course, pages, plans } = courses[i];
	const plan = plans.find((p) => p.months === months) ?? plans[0];
	const amountCents = months === null ? (plan.lifetimeCents ?? 0) : Math.round(course.baseMonthlyCents * months * (1 - plan.discountPercent / 100));
	const sub = await db.subscription.create({
		data: {
			userId: who.id,
			courseId: course.id,
			planId: plan.id,
			expiresAt: daysLeft === null ? null : new Date(Date.now() + daysLeft * DAY),
			canceledAt: opts.canceled ? new Date() : null,
		},
	});
	await db.charge.create({
		data: {
			userId: who.id,
			courseId: course.id,
			planId: plan.id,
			subscriptionId: sub.id,
			amountCents,
			months,
			netCents: Math.round(amountCents * 0.97),
			providerId: `demo_${who.username}_${i}`,
			status: "paid",
			dueAt: new Date(Date.now() - 20 * DAY),
			paidAt: new Date(Date.now() - 20 * DAY),
		},
	});
	for (const p of pages.slice(0, opts.done ?? 0))
		await db.pageProgress.create({ data: { userId: who.id, pageId: p.id } });
};
await buy(students[0], 0, 12, 300, { done: 2 });
await buy(students[0], 1, 1, 3, { done: 1 });
await buy(students[0], 2, 3, 60);
await buy(students[1], 0, null, null, { done: 3 });
await buy(students[2], 3, 1, 10, { canceled: true, done: 1 });

console.log(`Seeded ${courses.length} courses. Logins: admin|marina.tracos|caio.pixel|bia.aquarela|ana|joao|lu @demo.test / ${PASSWORD}`);
await db.$disconnect();
