import express, { Request, Response } from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import bodyParser from "body-parser";

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3003;

// Ensure required env vars exist
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey || !stripePriceId || !stripeWebhookSecret) {
  throw new Error("Missing Stripe environment variables");
}

// Initialize Stripe client
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2022-08-01",
});

// Parse JSON bodies for all endpoints except webhook
app.use("/api/webhook", bodyParser.raw({ type: "application/json" }));
app.use(express.json());

// Create a new Stripe Checkout Session
app.post(
  "/api/create-checkout-session",
  async (req: Request, res: Response) => {
    const { successUrl, cancelUrl } = req.body;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      res.json({ sessionId: session.id });
    } catch (err) {
      const error = err as Error;
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post("/api/webhook", (req: Request, res: Response): void => {
  const sig = req.headers["stripe-signature"] as string | undefined;

  if (!sig) {
    res.status(400).send("Missing Stripe signature header");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("✅ Checkout session completed:", session.id);
      // TODO: mark this customer/session as premium in your datastore
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("⚠️ Invoice payment failed:", invoice.id);
      // TODO: handle failed payment (e.g. downgrade user)
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
