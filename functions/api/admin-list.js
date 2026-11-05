export async function onRequestGet(context) {
    try {
        const { env } = context;
        const { results } = await env.DB.prepare(`
            SELECT * FROM permit_applications ORDER BY id DESC
        `).all();

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
    }
}