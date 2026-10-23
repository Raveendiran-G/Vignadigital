# New Desi Tadka feature implementation

This project update adds AI menu generation, separate order location fields, server-saved orders with 5% tax, and admin order printing.

## Before running
1. Back up your current Supabase project.
2. Run `orders-schema.sql` in Supabase SQL Editor. This migration only adds columns to the existing `restaurant_orders` table.
3. Configure environment variables using `.env.example` as a guide. Do not commit `.env`. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` for AI menu generation.
4. Install dependencies with `npm install`, then run `npm start`.
5. Sign in at `/admin`, use **AI Menu** to generate and review items, and **Orders / Print Bills** to print saved orders.

## Important behavior
- AI-generated menu entries are previews until the admin saves them. Each saved item uses the existing protected `/api/menu` endpoint and can be edited through the existing menu editor.
- Customer orders are stored through `/api/restaurants/new-desi-tadka/orders`. The backend validates item names and uses database prices rather than trusting browser prices.
- Tax is calculated at 5% on the server and added to the order total. Confirm this tax rate and any applicable local tax/invoicing requirements before using the bill for official accounting.
- Admin order history requires the existing Google-admin login session.
- Vercel serverless deployment can have filesystem/runtime constraints; verify the existing `vercel.json` configuration and Supabase environment variables in Vercel before deployment.

## Testing checklist
- Test Dine In with a table number.
- Test Room Service with a room number.
- Test Delivery with address, city and six-digit PIN code.
- Confirm missing required fields are rejected.
- Confirm the order appears in the admin Orders view.
- Print one bill and choose a physical printer or Save as PDF.
- Generate AI items, edit their names/prices/descriptions before saving, then refresh the menu to verify persistence.
