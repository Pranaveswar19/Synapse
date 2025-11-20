import { Request, Response } from "express";
import { sendOfferEmail } from "../services/email.service";

export async function handleSendEmail(req: Request, res: Response) {
  const { name, email, position, salary } = req.body;

  if (!name || !email || !position) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sendOfferEmail(email, name, position, salary || "Competitive");

    res.json({
      success: true,
      message: `Offer email sent to ${email}`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message });
  }
}
