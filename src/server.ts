import { createApp } from "./app.ts";
import { startRenewalJob } from "./jobs/renewals.ts";
import { mailerFromEnv } from "./providers/email.ts";
import { paymentProviderFromEnv } from "./providers/payment.ts";

const port = Number(process.env.PORT ?? 4000);
const mailer = mailerFromEnv();
createApp(mailer).listen(port, () => console.log(`api listening on :${port}`));
startRenewalJob(paymentProviderFromEnv, mailer);
