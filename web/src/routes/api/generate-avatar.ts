import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Extract Key (Nitro/Cloudflare compatible)
        const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
        if (!key) return new Response("Missing GEMINI_API_KEY in environment.", { status: 500 });

        // 2. Parse and Sanitize Request
        let body: { prompt?: string } = {};
        try {
          body = await request.json() as { prompt?: string };
        } catch {
          return new Response("Invalid JSON payload.", { status: 400 });
        }

        const rawPrompt = (body.prompt ?? "").toString().trim().slice(0, 500);
        if (!rawPrompt) return new Response("Prompt is required.", { status: 400 });

        // Tactical aesthetic enforcement
        const tacticalPrompt = `Profile avatar portrait, centered subject, square 1:1 framing. Clean solid background. High-contrast, vibrant, highly detailed stylized digital illustration. Subject: ${rawPrompt}`;

        // 3. Execute the Google AI Studio verified fetch
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

        try {
          const upstream = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: tacticalPrompt }
                  ]
                }
              ],
              generationConfig: {
                // CRITICAL: Forces the conversational model to draw
                responseModalities: ["IMAGE"]
              }
            }),
          });

          // 4. Upstream Error Handling (Sanitized for the frontend)
          if (!upstream.ok) {
            const errorText = await upstream.text().catch(() => "");
            console.error("[GEMINI API CRASH]", upstream.status, errorText);
            return new Response("The image generation server is currently unavailable.", { status: 502 });
          }

          const json: any = await upstream.json();

          // 5. The Google AI Studio Parsing Logic
          const parts = json.candidates?.[0]?.content?.parts;

          if (!parts || !Array.isArray(parts)) {
            console.error("[GEMINI INVALID STRUCTURE]", JSON.stringify(json).slice(0, 300));
            return new Response("Invalid structure returned from the image model.", { status: 502 });
          }

          // Hunt down the specific Base64 image part
          const imagePart = parts.find((part: any) => 
            part.inlineData && part.inlineData.mimeType?.startsWith("image/")
          );

          // 6. The Safety Trap
          // If the prompt triggered Google's safety filters (NSFW/Violence), 
          // it returns text instead of an image. We trap that here.
          if (!imagePart) {
            const textPart = parts.find((part: any) => part.text);
            const refusalReason = textPart?.text || "Safety filter tripped or generation refused.";
            console.error("[GEMINI REFUSAL]", refusalReason);
            return new Response(`Model refused: ${refusalReason}`, { status: 422 });
          }

          // 7. Deliver to the client in the format your frontend expects
          const b64 = imagePart.inlineData.data;
          const mime = imagePart.inlineData.mimeType;

          return new Response(JSON.stringify({ b64, mime }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });

        } catch (error: any) {
          console.error("[AVATAR ENGINE EXCEPTION]", error);
          return new Response("Internal server error during image generation.", { status: 500 });
        }
      },
    },
  },
});
