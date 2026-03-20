import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listing_address, important_places } = await req.json();

    if (!listing_address || !important_places?.length) {
      return Response.json({ error: 'Missing listing_address or important_places' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Singapore travel time estimator. Given a property address and a list of important places (by postal code or label), estimate the average commute time from the property to each place by public transport in Singapore.

Property address: "${listing_address}"

Important places:
${important_places.map((p, i) => `${i + 1}. ${p.label || 'Place'} - Postal code: ${p.postal_code} - Mode: ${p.mode || 'commute'}`).join('\n')}

For each place, estimate a realistic travel time in minutes based on the specified mode (walk, commute by MRT/bus, or drive) in Singapore. Consider typical distances between Singapore postal code districts. Be realistic - Singapore is small, most trips are 5-45 min.

Return ONLY a JSON object with this exact structure:
{
  "places": [
    { "label": "place label", "postal_code": "postal code", "minutes": number }
  ],
  "average_minutes": number
}`,
      response_json_schema: {
        type: "object",
        properties: {
          places: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                postal_code: { type: "string" },
                minutes: { type: "number" }
              }
            }
          },
          average_minutes: { type: "number" }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});