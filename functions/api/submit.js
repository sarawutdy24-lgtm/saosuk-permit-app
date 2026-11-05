export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();

        // สุ่มสร้างเลขที่คำขอ REQ-2569-XXXX
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const app_no = `REQ-2569-${randomNum}`;

        const stmt = env.DB.prepare(`
            INSERT INTO permit_applications 
            (app_no, app_type, old_license_no, applicant_name, id_card, phone, email, business_name, business_type, location_address, doc_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.bind(
            app_no,
            body.app_type,
            body.old_license_no || null,
            body.applicant_name,
            body.id_card,
            body.phone,
            body.email || null,
            body.business_name,
            body.business_type,
            body.location_address,
            body.doc_url || null
        ).run();

        return new Response(JSON.stringify({ success: true, app_no }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}