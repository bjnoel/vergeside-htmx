/**
 * Public endpoint: GET /api/area/:id/map
 *
 * Serves area map images from Supabase Storage.
 * Referenced by weekly email template at:
 *   supabase/functions/send-weekly-emails/index.ts:168
 */
export async function onRequest(context) {
    const { params, env } = context;
    const areaId = params.id;

    if (!areaId || !/^\d+$/.test(areaId)) {
        return new Response('Invalid area ID', { status: 400 });
    }

    const supabaseUrl = env.SUPABASE_URL;
    if (!supabaseUrl) {
        return new Response('Server configuration error', { status: 500 });
    }

    const imageUrl = `${supabaseUrl}/storage/v1/object/public/area-maps/${areaId}.png`;

    // Proxy the image instead of redirecting — some email clients
    // don't follow redirects for <img> tags.
    const response = await fetch(imageUrl);

    if (!response.ok) {
        return new Response('Map image not found', { status: 404 });
    }

    return new Response(response.body, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
        }
    });
}
