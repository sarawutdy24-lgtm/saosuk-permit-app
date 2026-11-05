export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        const url = new URL(request.url);
        const q = url.searchParams.get('q');

        if (!q) {
            return new Response(JSON.stringify({ success: false, message: 'กรุณาระบุคำค้นหา' }), { status: 400 });
        }

        const stmt = env.DB.prepare(`
            SELECT app_no, app_type, applicant_name, business_name, business_type, status, officer_remark, created_at
            FROM permit_applications
            WHERE app_no LIKE ? OR phone LIKE ? OR id_card LIKE ?
            ORDER BY id DESC
        `);

        const { results } = await stmt.bind(`%${q}%`, `%${q}%`, `%${q}%`).all();

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
    }
}