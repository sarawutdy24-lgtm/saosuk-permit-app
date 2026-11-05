export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();

        const stmt = env.DB.prepare(`
            UPDATE permit_applications 
            SET status = ?, officer_remark = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        await stmt.bind(body.status, body.officer_remark || null, body.id).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
    }
}