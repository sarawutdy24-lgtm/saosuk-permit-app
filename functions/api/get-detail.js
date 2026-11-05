export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return new Response(JSON.stringify({ success: false, message: 'Missing ID' }), { status: 400 });
        }

        const stmt = env.DB.prepare(`SELECT * FROM permit_applications WHERE id = ?`);
        const detail = await stmt.bind(id).first();

        return new Response(JSON.stringify({ success: true, detail }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
    }
}