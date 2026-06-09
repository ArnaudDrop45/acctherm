import type { APIRoute } from "astro";
import { Resend } from "resend";
import { z } from "zod";

export const prerender = false;

const resend = new Resend(process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY);

const contactSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  phone: z.string().min(1, "Le téléphone est obligatoire"),
  email: z.string().email("Format d'email invalide"),
  service: z.string().min(1, "Veuillez sélectionner un service"),
  message: z.string().optional(),
  website: z.string().optional() // Honeypot
});

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    const parsed = contactSchema.safeParse(data);

    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        errors: parsed.error.flatten().fieldErrors
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { name, phone, email, service, message, website } = parsed.data;

    // Honeypot check
    if (website && website.trim() !== "") {
      console.warn("Spam détecté via le piège Honeypot.");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Determine recipient: contact.drop45@gmail.com in dev, Pierre & Tom in prod
    const recipient = import.meta.env.DEV
      ? "contact.drop45@gmail.com"
      : (process.env.CONTACT_EMAIL_RECIPIENT || import.meta.env.CONTACT_EMAIL_RECIPIENT || "pierre@acctherm.com, tom@acctherm.com");

    // Use Resend's default domain in dev to allow immediate local testing
    const fromEmail = import.meta.env.DEV
      ? "Acctherm Test <onboarding@resend.dev>"
      : "Contact ACCTHERM <contact@acctherm.com>";

    // Échapper les entrées utilisateur pour empêcher l'injection de code HTML / XSS dans le client mail
    const escapedName = escapeHtml(name);
    const escapedPhone = escapeHtml(phone);
    const escapedEmail = escapeHtml(email);
    const escapedService = escapeHtml(service);
    const escapedMessage = message ? escapeHtml(message) : "Aucun détail supplémentaire fourni.";

    const { data: emailData, error } = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      replyTo: escapedEmail,
      subject: `[DEVIS WEB] ${escapedService} - ${escapedName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #0f2c59; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #ea580c; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Nouvelle demande de devis</h2>
          <p style="margin: 15px 0;"><strong>Nom / Entreprise :</strong> ${escapedName}</p>
          <p style="margin: 15px 0;"><strong>Téléphone :</strong> ${escapedPhone}</p>
          <p style="margin: 15px 0;"><strong>Adresse Email :</strong> <a href="mailto:${escapedEmail}">${escapedEmail}</a></p>
          <p style="margin: 15px 0;"><strong>Prestation demandée :</strong> ${escapedService}</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #ea580c;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #64748b;">Détails du projet :</p>
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.5;">${escapedMessage}</p>
          </div>
          
          <p style="font-size: 11px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
            Cet e-mail a été généré de manière sécurisée par le formulaire de contact ACCTHERM.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Erreur API Resend:", error);
      return new Response(JSON.stringify({
        success: false,
        message: "Une erreur est survenue lors de l'envoi de l'email : " + error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Votre demande a bien été envoyée ! Tom ou Pierre vous recontactera sous 24h."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Erreur API Contact:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Une erreur est survenue lors de l'envoi."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
