import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// For now, all emails are sent from Resend's onboarding test sender. This works
// without a verified domain. Once a domain is verified, switch this back to
// `process.env.RESEND_FROM_EMAIL`.
const FROM_EMAIL = "onboarding@resend.dev"

// Resend's test sender (onboarding@resend.dev) can ONLY deliver to the Resend
// account owner's own email address. To let emails go out during this testing
// phase, set RESEND_TEST_RECIPIENT to that address: every email is then
// redirected there, with the intended recipient noted in the body.
const TEST_RECIPIENT = process.env.RESEND_TEST_RECIPIENT?.trim() || null

type SendResult = { ok: true } | { ok: false; error: string }

type EmailAttachment = { filename: string; content: Buffer }

/**
 * Sends an email via Resend. While using the onboarding test sender, all mail
 * is redirected to RESEND_TEST_RECIPIENT (if configured) because Resend rejects
 * any other recipient with a 403 until a domain is verified.
 */
async function sendEmail(payload: {
  to: string
  subject: string
  html: string
  text: string
  attachments?: EmailAttachment[]
}): Promise<SendResult> {
  if (!resend) {
    return { ok: false, error: "Service d'email non configuré (RESEND_API_KEY manquante)." }
  }

  // Redirect to the test inbox when configured, keeping the real target visible.
  const realRecipient = payload.to
  const redirected = TEST_RECIPIENT && TEST_RECIPIENT.toLowerCase() !== realRecipient.toLowerCase()
  const toAddress = TEST_RECIPIENT || realRecipient
  const subject = redirected ? `[Test → ${realRecipient}] ${payload.subject}` : payload.subject
  const notice = redirected
    ? `<p style="font-size:12px;color:#71717a;margin:0 0 16px;">Email de test redirigé. Destinataire prévu : <strong>${escapeHtml(
        realRecipient,
      )}</strong>.</p>`
    : ""
  const textNotice = redirected ? `[Email de test redirigé. Destinataire prévu : ${realRecipient}]\n\n` : ""

  try {
    const { error } = await resend.emails.send({
      from: `Administration <${FROM_EMAIL}>`,
      to: toAddress,
      subject,
      html: notice + payload.html,
      text: textNotice + payload.text,
      attachments: payload.attachments,
    })

    if (!error) return { ok: true }

    // Surface Resend's real message (e.g. the testing-recipient restriction) so
    // the cause is actionable instead of a generic failure.
    return { ok: false, error: error.message }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de l'envoi de l'email"
    return { ok: false, error: message }
  }
}

/**
 * Sends a newly reset temporary password to the user.
 */
export async function sendPasswordResetEmail(input: {
  to: string
  name: string
  password: string
}): Promise<SendResult> {
  const { to, name, password } = input
  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe",
    html: buildHtml({ name, password }),
    text: buildText({ name, password }),
  })
}

/**
 * Sends the credentials of a freshly created account to the new user.
 */
export async function sendWelcomeEmail(input: {
  to: string
  name: string
  password: string
}): Promise<SendResult> {
  const { to, name, password } = input
  return sendEmail({
    to,
    subject: "Votre compte a été créé",
    html: buildWelcomeHtml({ name, email: to, password }),
    text: buildWelcomeText({ name, email: to, password }),
  })
}

/**
 * Sends a purchase order PDF to a counterparty contact as an attachment.
 */
export async function sendPurchaseOrderEmail(input: {
  to: string
  name: string
  reference: string
  pdf: Buffer
  filename: string
}): Promise<SendResult> {
  const { to, name, reference, pdf, filename } = input
  return sendEmail({
    to,
    subject: `Bon de commande ${reference}`,
    html: buildPurchaseOrderHtml({ name, reference }),
    text: buildPurchaseOrderText({ name, reference }),
    attachments: [{ filename, content: pdf }],
  })
}

/**
 * Notifies a BCC agent that the counterparty has responded (accepted,
 * negotiated or declined) to a purchase order.
 */
export async function sendCounterpartyResponseEmail(input: {
  to: string
  agentName?: string
  counterpartyName?: string
  reference: string
  decision: "accept" | "negotiate" | "decline"
  comment?: string | null
  link: string
}): Promise<SendResult> {
  const decisionLabel =
    input.decision === "accept" ? "acceptée" : input.decision === "negotiate" ? "négociée" : "déclinée"
  const action =
    input.decision === "accept"
      ? "Vous pouvez maintenant passer à l'étape d'expédition."
      : input.decision === "negotiate"
        ? "Vous pouvez modifier le bon de commande et le re-soumettre après une nouvelle double approbation."
        : "Le lot est désormais fermé."
  const color =
    input.decision === "accept" ? "#16a34a" : input.decision === "decline" ? "#dc2626" : "#d97706"
  const cp = input.counterpartyName || "La contrepartie"
  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 8px;">Réponse à la demande ${escapeHtml(input.reference)}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">Bonjour ${escapeHtml(input.agentName || "")},</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      La contrepartie <strong>${escapeHtml(cp)}</strong> vous a transmis une réponse pour la demande d'achat <strong>${escapeHtml(input.reference)}</strong>.
      Vous pouvez l'examiner — elle a <strong style="color:${color};">${decisionLabel}</strong> l'offre. ${escapeHtml(action)}
    </p>
    ${
      input.comment
        ? `<blockquote style="border-left:3px solid #e4e4e7;margin:0 0 16px;padding:8px 12px;color:#52525b;font-size:13px;">${escapeHtml(
            input.comment,
          )}</blockquote>`
        : ""
    }
    <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      Voir le bon de commande
    </a>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">Banque Centrale — GAC Sourcing</p>
  </div>`
  const text = [
    `Bonjour ${input.agentName || ""},`,
    "",
    `La contrepartie ${cp} vous a transmis une réponse pour la demande d'achat ${input.reference}.`,
    `Vous pouvez l'examiner — elle a ${decisionLabel} l'offre. ${action}`,
    input.comment ? `\nCommentaire : ${input.comment}` : "",
    "",
    `Voir le bon de commande : ${input.link}`,
    "",
    "Banque Centrale — GAC Sourcing",
  ].join("\n")
  return sendEmail({
    to: input.to,
    subject: `Demande ${input.reference} — ${decisionLabel} par la contrepartie`,
    html,
    text,
  })
}

/**
 * Notifies the assigned agent and Banque Centrale admins that a counterparty
 * has submitted their shipping manifest.
 *
 * The greeting and action line are tailored to the recipient's role so each
 * person sees relevant context (agent vs. central bank administration).
 */
export async function sendManifestSubmissionEmail(input: {
  to: string
  recipientName?: string
  recipientRole?: string
  counterpartyName: string
  reference: string
  attemptNumber: number
  totalBars: number
  totalFineOz: number
  variancePercent: number
  link: string
}): Promise<SendResult> {
  const inTolerance = Math.abs(input.variancePercent) <= 0.5
  const varianceColor = inTolerance ? "#16a34a" : "#d97706"
  const varianceLabel = `${input.variancePercent >= 0 ? "+" : ""}${input.variancePercent.toFixed(3)} %`
  const isAdmin = input.recipientRole === "admin"

  const actionLine = isAdmin
    ? "En tant qu'administrateur de la Banque Centrale, vous pouvez examiner et valider ce manifeste."
    : "En tant qu'agent responsable du dossier, vous pouvez examiner ce manifeste et le soumettre à la validation."

  const greeting = input.recipientName ? `Bonjour ${escapeHtml(input.recipientName)},` : "Bonjour,"

  const resubNote =
    input.attemptNumber > 1
      ? `<p style="font-size:13px;color:#d97706;margin:0 0 12px;">⚠ Il s'agit de la <strong>tentative n°${input.attemptNumber}</strong> de soumission pour ce bon de commande.</p>`
      : ""

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 8px;">Manifeste d'expédition soumis — ${escapeHtml(input.reference)}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${greeting}</p>
    ${resubNote}
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      La contrepartie <strong>${escapeHtml(input.counterpartyName)}</strong> a soumis le manifeste
      d'expédition pour la demande d'achat <strong>${escapeHtml(input.reference)}</strong>.
      ${escapeHtml(actionLine)}
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;margin:0 0 20px;">
      <tbody style="display:block;padding:8px 16px;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#71717a;">Nombre de lingots</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;color:#18181b;">${input.totalBars}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#71717a;">Poids fin total (manifeste)</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;font-family:monospace;color:#18181b;">${input.totalFineOz.toFixed(3)} oz</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#71717a;">Variance vs BCC</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;font-family:monospace;color:${varianceColor};">${varianceLabel}${inTolerance ? " ✓" : " ⚠ hors tolérance"}</td>
        </tr>
      </tbody>
    </table>
    <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      Examiner le manifeste
    </a>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">Banque Centrale — GAC Sourcing</p>
  </div>`

  const text = [
    greeting,
    "",
    `La contrepartie ${input.counterpartyName} a soumis le manifeste d'expédition pour ${input.reference}${input.attemptNumber > 1 ? ` (tentative n°${input.attemptNumber})` : ""}.`,
    actionLine,
    "",
    `Lingots : ${input.totalBars}`,
    `Poids fin total : ${input.totalFineOz.toFixed(3)} oz`,
    `Variance : ${varianceLabel}${inTolerance ? " (dans la tolérance)" : " ⚠ hors tolérance — vérification requise"}`,
    "",
    `Examiner le manifeste : ${input.link}`,
    "",
    "Banque Centrale — GAC Sourcing",
  ].join("\n")

  return sendEmail({
    to: input.to,
    subject: `Manifeste soumis — ${input.reference}${input.attemptNumber > 1 ? ` (tentative ${input.attemptNumber})` : ""}`,
    html,
    text,
  })
}

/**
 * Notifies a counterparty that their submitted manifest has been validated or returned.
 */
export async function sendManifestReviewEmail(input: {
  to: string
  recipientName?: string
  counterpartyName: string
  reference: string
  action: "validate" | "return"
  reviewNotes?: string | null
  link: string
}): Promise<SendResult> {
  const validated = input.action === "validate"
  const greeting = input.recipientName ? `Bonjour ${escapeHtml(input.recipientName)},` : "Bonjour,"

  const statusLine = validated
    ? `Votre manifeste d'expédition pour la demande d'achat <strong>${escapeHtml(input.reference)}</strong> a été <span style="color:#16a34a;font-weight:700;">validé</span> par la Banque Centrale.`
    : `Votre manifeste d'expédition pour la demande d'achat <strong>${escapeHtml(input.reference)}</strong> a été <span style="color:#d97706;font-weight:700;">retourné</span> par la Banque Centrale.`

  const notesBlock = !validated && input.reviewNotes
    ? `<div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
        <p style="font-size:13px;font-weight:600;color:#92400e;margin:0 0 4px;">Motif du retour :</p>
        <p style="font-size:13px;color:#78350f;margin:0;">${escapeHtml(input.reviewNotes)}</p>
      </div>`
    : ""

  const actionLabel = validated ? "Voir le bon de commande" : "Corriger et resoumettre"

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 8px;">
      Manifeste ${validated ? "validé" : "retourné"} — ${escapeHtml(input.reference)}
    </h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${greeting}</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${statusLine}</p>
    ${notesBlock}
    ${validated ? '<p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #16a34a;">La suite du processus sera coordonnée par votre agent dédié.</p>' : '<p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">Veuillez corriger les points mentionnés et resoumettre votre manifeste depuis votre portail.</p>'}
    <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      ${actionLabel}
    </a>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">Banque Centrale — GAC Sourcing</p>
  </div>`

  const text = [
    greeting,
    "",
    validated
      ? `Votre manifeste d'expédition pour ${input.reference} a été validé par la Banque Centrale.`
      : `Votre manifeste d'expédition pour ${input.reference} a été retourné par la Banque Centrale.`,
    !validated && input.reviewNotes ? `\nMotif du retour : ${input.reviewNotes}` : "",
    "",
    validated
      ? "La suite du processus sera coordonnée par votre agent dédié."
      : "Veuillez corriger les points mentionnés et resoumettre votre manifeste depuis votre portail.",
    "",
    `${actionLabel} : ${input.link}`,
    "",
    "Banque Centrale — GAC Sourcing",
  ]
    .filter((l) => l !== "")
    .join("\n")

  return sendEmail({
    to: input.to,
    subject: `Manifeste ${validated ? "validé" : "retourné"} — ${input.reference}`,
    html,
    text,
  })
}

/**
 * Notifies a counterparty that a purchase order has been submitted to them and
 * invites them to accept, negotiate or decline it via the response portal.
 */
export async function sendCounterpartyOrderEmail(input: {
  to: string
  name: string
  reference: string
  respondUrl: string
  goldType?: string
  estimatedWeight?: number
  assayRange?: string
  incoterms?: string
  totalValue?: number
  currency?: string
  pdf?: Buffer
  filename?: string
}): Promise<SendResult> {
  const { to, pdf, filename } = input
  return sendEmail({
    to,
    subject: `Demande d'achat ${input.reference} — réponse attendue`,
    html: buildCounterpartyOrderHtml(input),
    text: buildCounterpartyOrderText(input),
    attachments: pdf && filename ? [{ filename, content: pdf }] : undefined,
  })
}

function formatMoney(value?: number, currency?: string) {
  if (value == null) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency || "USD"}`
}

function buildCounterpartyOrderText(input: {
  name: string
  reference: string
  respondUrl: string
  goldType?: string
  estimatedWeight?: number
  assayRange?: string
  incoterms?: string
  totalValue?: number
  currency?: string
}) {
  return [
    `Bonjour ${input.name},`,
    "",
    `La Banque Centrale vous a transmis la demande d'achat ${input.reference}.`,
    "",
    "Détails de l'offre :",
    `- Type d'or : ${input.goldType || "—"}`,
    `- Quantité cible : ${input.estimatedWeight != null ? `${input.estimatedWeight} kg` : "—"}`,
    `- Pureté demandée : ${input.assayRange || "—"}`,
    `- Incoterm : ${input.incoterms || "—"}`,
    `- Montant indicatif : ${formatMoney(input.totalValue, input.currency)}`,
    "",
    "Vous pouvez accepter, négocier ou décliner cette offre depuis votre portail :",
    input.respondUrl,
    "",
    "Cordialement,",
    "Banque Centrale — GAC Sourcing",
  ].join("\n")
}

function buildCounterpartyOrderHtml(input: {
  name: string
  reference: string
  respondUrl: string
  goldType?: string
  estimatedWeight?: number
  assayRange?: string
  incoterms?: string
  totalValue?: number
  currency?: string
}) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#71717a;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;color:#18181b;">${escapeHtml(value)}</td></tr>`
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 8px;">Demande d'achat ${escapeHtml(input.reference)}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">Bonjour ${escapeHtml(input.name)},</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      La Banque Centrale vous a transmis une demande d'achat. Vous pouvez l'examiner puis
      <strong>accepter</strong>, <strong>négocier</strong> ou <strong>décliner</strong> l'offre.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:0 0 20px;">
      <tbody style="display:block;padding:8px 16px;">
        ${row("Type d'or", input.goldType || "—")}
        ${row("Quantité cible", input.estimatedWeight != null ? `${input.estimatedWeight} kg` : "—")}
        ${row("Pureté demandée", input.assayRange || "—")}
        ${row("Incoterm", input.incoterms || "—")}
        ${row("Montant indicatif", formatMoney(input.totalValue, input.currency))}
      </tbody>
    </table>
    <a href="${escapeHtml(input.respondUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      Examiner et répondre
    </a>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">
      Connectez-vous à votre portail pour répondre. Cordialement,<br />Banque Centrale — GAC Sourcing
    </p>
  </div>`
}

function buildPurchaseOrderText({ name, reference }: { name: string; reference: string }) {
  return [
    `Bonjour ${name},`,
    "",
    `Veuillez trouver ci-joint le bon de commande ${reference}.`,
    "",
    "Le document PDF est joint à cet email.",
    "",
    "Cordialement,",
    "GAC Sourcing",
  ].join("\n")
}

function buildPurchaseOrderHtml({ name, reference }: { name: string; reference: string }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Bon de commande ${escapeHtml(reference)}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">Bonjour ${escapeHtml(name)},</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Veuillez trouver ci-joint le bon de commande <strong>${escapeHtml(reference)}</strong> au format PDF.
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">
      Cordialement,<br />GAC Sourcing
    </p>
  </div>`
}

function buildText({ name, password }: { name: string; password: string }) {
  return [
    `Bonjour ${name},`,
    "",
    "Votre mot de passe a été réinitialisé par un administrateur.",
    "",
    `Mot de passe temporaire : ${password}`,
    "",
    "Pour des raisons de sécurité, connectez-vous puis changez ce mot de passe dès que possible.",
    "",
    "Si vous n'êtes pas à l'origine de cette demande, contactez votre administrateur.",
  ].join("\n")
}

function buildHtml({ name, password }: { name: string; password: string }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Réinitialisation de votre mot de passe</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">Bonjour ${escapeHtml(name)},</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Votre mot de passe a été réinitialisé par un administrateur. Voici votre mot de passe temporaire :
    </p>
    <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 16px;">
      <code style="font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">${escapeHtml(password)}</code>
    </div>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Pour des raisons de sécurité, connectez-vous puis changez ce mot de passe dès que possible.
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">
      Si vous n'êtes pas à l'origine de cette demande, contactez votre administrateur.
    </p>
  </div>`
}

function buildWelcomeText({ name, email, password }: { name: string; email: string; password: string }) {
  return [
    `Bonjour ${name},`,
    "",
    "Un compte a été créé pour vous par un administrateur.",
    "",
    "Voici vos identifiants de connexion :",
    `Email : ${email}`,
    `Mot de passe temporaire : ${password}`,
    "",
    "Pour des raisons de sécurité, connectez-vous puis changez ce mot de passe dès que possible.",
    "",
    "Si vous n'attendiez pas cette invitation, contactez votre administrateur.",
  ].join("\n")
}

function buildWelcomeHtml({ name, email, password }: { name: string; email: string; password: string }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Bienvenue, votre compte a été créé</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">Bonjour ${escapeHtml(name)},</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Un compte a été créé pour vous par un administrateur. Voici vos identifiants de connexion :
    </p>
    <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
      <p style="font-size: 14px; margin: 0 0 8px;"><strong>Email :</strong> ${escapeHtml(email)}</p>
      <p style="font-size: 14px; margin: 0;"><strong>Mot de passe temporaire :</strong>
        <code style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">${escapeHtml(password)}</code>
      </p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Pour des raisons de sécurité, connectez-vous puis changez ce mot de passe dès que possible.
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0;">
      Si vous n'attendiez pas cette invitation, contactez votre administrateur.
    </p>
  </div>`
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
