const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const https = require('https');

const LOGO_URL = process.env.LOGO_URL;
const CLIENT_URL = process.env.CLIENT_URL;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
const EMAIL_FROM = process.env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
        },
});

let cachedLogoBuffer = null;
let logoFetchPromise = null;

const LOGO_FETCH_TIMEOUT_MS = 10_000;

const fetchLogoBuffer = async () => {
    if (cachedLogoBuffer) return cachedLogoBuffer;
    if (logoFetchPromise) return logoFetchPromise;

    logoFetchPromise = new Promise((resolve) => {
        const req = https.get(LOGO_URL, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                resolve(null);
                return;
            }

            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        });

        req.on('error', () => resolve(null));
        req.setTimeout(LOGO_FETCH_TIMEOUT_MS, () => {
            req.destroy();
            resolve(null);
        });
    }).then((buffer) => {
        cachedLogoBuffer = buffer || null;
        return cachedLogoBuffer;
    }).finally(() => {
        logoFetchPromise = null;
    });

    return logoFetchPromise;
};

const escapeHtml = (value) => {
    const str = String(value ?? '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const toSafeFileName = (value) => String(value || '').replace(/[^a-z0-9_-]+/gi, '_');

const formatCurrency = (amount) => {
        const numericAmount = Number(amount || 0);
        if (Number.isNaN(numericAmount)) return 'Rp0';

        return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
        }).format(numericAmount);
};

const formatDateTime = (value) => {
        if (!value) return '-';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('id-ID');
};

const buildEmailTemplate = ({ title, preheader, bodyHtml, cta }) => `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f2f5ff;font-family:Arial,sans-serif;color:#1f2a44;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
            ${escapeHtml(preheader || '')}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5ff;padding:32px 16px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
                        <tr>
                            <td style="padding:28px 32px 16px;border-bottom:1px solid #e0e6ff;">
                                <img src="${LOGO_URL}" width="140" alt="Vocafit" style="display:block;border:0;">
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:28px 32px 8px;">
                                <h1 style="margin:0 0 8px;font-size:22px;line-height:1.4;color:#060771;">${escapeHtml(title)}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 32px 8px;font-size:14px;line-height:1.7;color:#2f3a6f;">
                                ${bodyHtml}
                            </td>
                        </tr>
                        ${cta ? `
                        <tr>
                            <td style="padding:12px 32px 24px;">
                                <a href="${cta.href}" style="display:inline-block;background:#0D0E85;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(cta.label)}</a>
                            </td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding:20px 32px 28px;border-top:1px solid #e0e6ff;font-size:12px;line-height:1.6;color:#5a658f;">
                                <p style="margin:0 0 6px;">Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#FF6C0C;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
                                <p style="margin:0;">Vocafit, Surabaya, Indonesia</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
`;

const sendVerificationEmail = async (to, name, token) => {
        const safeName = escapeHtml(name);
        const link = `${CLIENT_URL}/verify-email/${encodeURIComponent(token)}`;
        const html = buildEmailTemplate({
                title: 'Verify Your Vocafit Account',
                preheader: 'Confirm your email to activate your Vocafit account.',
                bodyHtml: `
                        <p>Hi ${safeName},</p>
                        <p>Thanks for joining Vocafit. Please verify your email to activate your account.</p>
                        <p>This verification link expires in 30 minutes.</p>
                `,
                cta: { href: link, label: 'Verify Email' },
        });

        try {
                await transporter.sendMail({
                        from: EMAIL_FROM,
                        to,
                        subject: 'Verify Your Vocafit Account',
                        html,
                        text: `Hi ${name},\n\nVerify your Vocafit account: ${link}\n\nThis link expires in 30 minutes.\n`,
                });
        } catch (error) {
                console.error('Failed to send verification email:', error.message || error);
                throw error;
        }
};

const sendPasswordResetOtpEmail = async (to, name, otp) => {
        const safeName = escapeHtml(name);
        const safeOtp = escapeHtml(otp);
        const html = buildEmailTemplate({
                title: 'Your Password Reset Code',
                preheader: 'Use this OTP to reset your Vocafit password.',
                bodyHtml: `
                        <p>Hi ${safeName},</p>
                        <p>Your password reset OTP is:</p>
                        <p style="font-size:20px;font-weight:700;letter-spacing:2px;color:#0f172a;">${safeOtp}</p>
                        <p>This code expires in 30 minutes. If you did not request this, you can ignore this email.</p>
                `,
        });

        try {
                await transporter.sendMail({
                        from: EMAIL_FROM,
                        to,
                        subject: 'Your Vocafit Password Reset OTP',
                        html,
                        text: `Hi ${name},\n\nYour password reset OTP is ${otp}.\nThis code expires in 30 minutes. If you did not request this, ignore this email.\n`,
                });
        } catch (error) {
                console.error('Failed to send password reset OTP email:', error.message || error);
                throw error;
        }
};

const sendOrderInvoiceEmail = async ({ to, name, orderId, paymentMethod, amount, penaltyAmount, itemName, expireAt, paymentUrl }) => {
        const totalAmount = Number(amount || 0) + Number(penaltyAmount || 0);
        const penaltyValue = Number(penaltyAmount || 0);
        const paymentMethodLabel = paymentMethod === 'QRIS' ? 'QRIS' : 'Cash';
    let pdfBuffer = null;

    try {
        pdfBuffer = await buildInvoicePdf({
            name,
            orderId,
            paymentMethod,
            amount,
            penaltyAmount,
            itemName,
            expireAt,
            paymentUrl,
        });
    } catch (error) {
        console.error('Failed to generate invoice PDF:', error.message || error);
    }

        const safeName = escapeHtml(name);
        const safeOrderId = escapeHtml(orderId);
        const safeItemName = escapeHtml(itemName);

    const invoiceFileName = `invoice_${toSafeFileName(orderId)}.pdf`;
        const html = buildEmailTemplate({
                title: 'Your Vocafit Order Invoice',
                preheader: `Invoice for order ${orderId}.`,
                bodyHtml: `
                        <p>Hi ${safeName},</p>
                        <p>Thanks for your order. Here is your invoice summary:</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Order ID</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${safeOrderId}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Item</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${safeItemName}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Payment Method</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${paymentMethodLabel}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Penalty</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${formatCurrency(penaltyValue)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;font-weight:600;">Total</td>
                                <td style="padding:8px 0;text-align:right;font-weight:600;">${formatCurrency(totalAmount)}</td>
                            </tr>
                        </table>
                        <p style="margin-top:4px;font-size:11px;color:#8892b0;">Amounts shown are exclusive of applicable taxes.</p>
                        <p style="margin-top:12px;">Invoice created on ${formatDateTime(new Date())}.${expireAt ? ` Please complete payment before ${formatDateTime(expireAt)}.` : ''}</p>
                        ${paymentUrl ? `<p style="margin-top:8px;">Use the button below to complete your payment.</p>` : ''}
                `,
                cta: paymentUrl ? { href: paymentUrl, label: 'Pay Now' } : null,
        });

        try {
                await transporter.sendMail({
                        from: EMAIL_FROM,
                        to,
                        subject: `Invoice for Order ${orderId}`,
                        html,
                        text: `Hi ${name},\n\nInvoice for order ${orderId}\nItem: ${itemName}\nPayment Method: ${paymentMethodLabel}\nPenalty: ${formatCurrency(penaltyValue)}\nTotal: ${formatCurrency(totalAmount)}\n${expireAt ? `Pay before: ${formatDateTime(expireAt)}\n` : ''}${paymentUrl ? `Payment link: ${paymentUrl}\n` : ''}`,
                    attachments: pdfBuffer ? [{
                        filename: invoiceFileName,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }] : [],
                });
        } catch (error) {
                console.error('Failed to send order invoice email:', error.message || error);
                throw error;
        }
};

const sendPaymentReceiptEmail = async ({ to, name, orderId, paymentMethod, amount, penaltyAmount, itemName, paidAt }) => {
        const totalAmount = Number(amount || 0) + Number(penaltyAmount || 0);
        const penaltyValue = Number(penaltyAmount || 0);
        const paymentMethodLabel = paymentMethod === 'QRIS' ? 'QRIS' : 'Cash';
    let pdfBuffer = null;

    try {
        pdfBuffer = await buildReceiptPdf({
            name,
            orderId,
            paymentMethod,
            amount,
            penaltyAmount,
            itemName,
            paidAt,
        });
    } catch (error) {
        console.error('Failed to generate receipt PDF:', error.message || error);
    }

        const safeName = escapeHtml(name);
        const safeOrderId = escapeHtml(orderId);
        const safeItemName = escapeHtml(itemName);

    const receiptFileName = `receipt_${toSafeFileName(orderId)}.pdf`;
        const html = buildEmailTemplate({
                title: 'Your Vocafit Payment Receipt',
                preheader: `Payment received for order ${orderId}.`,
                bodyHtml: `
                        <p>Hi ${safeName},</p>
                        <p>We received your payment. Here is your receipt:</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Order ID</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${safeOrderId}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Item</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${safeItemName}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Payment Method</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${paymentMethodLabel}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;">Penalty</td>
                                <td style="padding:8px 0;border-bottom:1px solid #eef1f6;text-align:right;">${formatCurrency(penaltyValue)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;font-weight:600;">Total Paid</td>
                                <td style="padding:8px 0;text-align:right;font-weight:600;">${formatCurrency(totalAmount)}</td>
                            </tr>
                        </table>
                        <p style="margin-top:4px;font-size:11px;color:#8892b0;">Amounts shown are exclusive of applicable taxes.</p>
                        <p style="margin-top:12px;">Paid on ${formatDateTime(paidAt || new Date())}.</p>
                `,
        });

        try {
                await transporter.sendMail({
                        from: EMAIL_FROM,
                        to,
                        subject: `Receipt for Order ${orderId}`,
                        html,
                        text: `Hi ${name},\n\nReceipt for order ${orderId}\nItem: ${itemName}\nPayment Method: ${paymentMethodLabel}\nPenalty: ${formatCurrency(penaltyValue)}\nTotal Paid: ${formatCurrency(totalAmount)}\nPaid on: ${formatDateTime(paidAt || new Date())}\n`,
                    attachments: pdfBuffer ? [{
                        filename: receiptFileName,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }] : [],
                });
        } catch (error) {
                console.error('Failed to send payment receipt email:', error.message || error);
                throw error;
        }
};

const createPdfBuffer = (renderFn) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    renderFn(doc)
        .then(() => doc.end())
        .catch((error) => {
            doc.end();
            reject(error);
        });
});

const renderPdfHeader = async (doc, title) => {
    const logoBuffer = await fetchLogoBuffer();
    if (logoBuffer) {
        doc.image(logoBuffer, doc.page.margins.left, 40, { fit: [120, 60] });
    }

    doc
        .fontSize(20)
        .fillColor('#060771')
        .text(title, 0, 50, { align: 'right' });

    doc
        .moveDown(0.5)
        .fontSize(10)
        .fillColor('#475569')
        .text('Vocafit, Surabaya, Indonesia', { align: 'right' });

    doc
        .moveDown(1.2)
        .strokeColor('#c7d2fe')
        .lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();

    doc.moveDown(1);
    return doc.y;
};

const renderLineItemHeader = (doc) => {
    const startX = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowY = doc.y;

    doc
        .fontSize(10)
        .fillColor('#5a658f')
        .text('Description', startX, rowY, { width: width * 0.6 })
        .text('Amount', startX + width * 0.6, rowY, { width: width * 0.4, align: 'right' });

    doc
        .moveDown(0.3)
        .strokeColor('#e0e6ff')
        .lineWidth(1)
        .moveTo(startX, doc.y)
        .lineTo(startX + width, doc.y)
        .stroke();

    doc.moveDown(0.4);
};

const renderLineItemRow = (doc, description, amount) => {
    const startX = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowY = doc.y;

    doc
        .fontSize(10)
        .fillColor('#0f172a')
        .text(description, startX, rowY, { width: width * 0.6 })
        .text(amount, startX + width * 0.6, rowY, { width: width * 0.4, align: 'right' });

    doc.moveDown(0.4);
};

const buildInvoicePdf = async ({
    name,
    orderId,
    paymentMethod,
    amount,
    penaltyAmount,
    itemName,
    expireAt,
    paymentUrl,
}) => createPdfBuffer(async (doc) => {
    const totalAmount = Number(amount || 0) + Number(penaltyAmount || 0);
    const headerY = await renderPdfHeader(doc, 'Invoice');
    const leftX = doc.page.margins.left;
    const rightX = doc.page.width - doc.page.margins.right - 220;
    const metaWidth = 220;

    doc.fontSize(12).fillColor('#060771').text('Bill To', leftX, headerY);
    doc.fontSize(10).fillColor('#0f172a').text(name || '-', leftX, doc.y + 2);

    doc.fontSize(10).fillColor('#475569').text('Order ID', rightX, headerY, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(orderId, rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#475569').text('Date', rightX, doc.y + 10, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(formatDateTime(new Date()), rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#475569').text('Payment Method', rightX, doc.y + 10, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(paymentMethod === 'QRIS' ? 'QRIS' : 'Cash', rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    if (expireAt) {
        doc.fontSize(10).fillColor('#475569').text('Pay Before', rightX, doc.y + 10, { width: metaWidth, align: 'right' });
        doc.fontSize(10).fillColor('#0f172a').text(formatDateTime(expireAt), rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    }

    doc.y = Math.max(doc.y + 10, headerY + 70);
    doc.moveDown(0.8);
    renderLineItemHeader(doc);
    renderLineItemRow(doc, itemName || 'Vocafit order', formatCurrency(amount));
    if (Number(penaltyAmount || 0) > 0) {
        renderLineItemRow(doc, 'Penalty', formatCurrency(penaltyAmount));
    }

    const summaryStartX = doc.page.margins.left;
    const summaryWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const summaryY = doc.y + 4;

    doc
        .fontSize(11)
        .fillColor('#0f172a')
        .text('Total', summaryStartX, summaryY, { width: summaryWidth * 0.6 })
        .text(formatCurrency(totalAmount), summaryStartX + summaryWidth * 0.6, summaryY, {
            width: summaryWidth * 0.4,
            align: 'right',
        });

    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('#8892b0').text('Amounts shown are exclusive of applicable taxes.');

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor('#475569').text('Payment Link', { continued: false });
    if (paymentUrl) {
        doc.fontSize(9).fillColor('#0D0E85').text(paymentUrl, { link: paymentUrl, underline: true });
    } else {
        doc.fontSize(9).fillColor('#0f172a').text('-');
    }

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor('#5a658f').text(`Support: ${SUPPORT_EMAIL}`);
});

const buildReceiptPdf = async ({
    name,
    orderId,
    paymentMethod,
    amount,
    penaltyAmount,
    itemName,
    paidAt,
}) => createPdfBuffer(async (doc) => {
    const totalAmount = Number(amount || 0) + Number(penaltyAmount || 0);
    const headerY = await renderPdfHeader(doc, 'Receipt');
    const leftX = doc.page.margins.left;
    const rightX = doc.page.width - doc.page.margins.right - 220;
    const metaWidth = 220;

    doc.fontSize(12).fillColor('#060771').text('Billed To', leftX, headerY);
    doc.fontSize(10).fillColor('#0f172a').text(name || '-', leftX, doc.y + 2);

    doc.fontSize(10).fillColor('#475569').text('Order ID', rightX, headerY, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(orderId, rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#475569').text('Paid On', rightX, doc.y + 10, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(formatDateTime(paidAt || new Date()), rightX, doc.y + 2, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#475569').text('Payment Method', rightX, doc.y + 10, { width: metaWidth, align: 'right' });
    doc.fontSize(10).fillColor('#0f172a').text(paymentMethod === 'QRIS' ? 'QRIS' : 'Cash', rightX, doc.y + 2, { width: metaWidth, align: 'right' });

    doc.y = Math.max(doc.y + 10, headerY + 70);
    doc.moveDown(0.8);
    renderLineItemHeader(doc);
    renderLineItemRow(doc, itemName || 'Vocafit order', formatCurrency(amount));
    if (Number(penaltyAmount || 0) > 0) {
        renderLineItemRow(doc, 'Penalty', formatCurrency(penaltyAmount));
    }

    const summaryStartX = doc.page.margins.left;
    const summaryWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const summaryY = doc.y + 4;

    doc
        .fontSize(11)
        .fillColor('#0f172a')
        .text('Total Paid', summaryStartX, summaryY, { width: summaryWidth * 0.6 })
        .text(formatCurrency(totalAmount), summaryStartX + summaryWidth * 0.6, summaryY, {
            width: summaryWidth * 0.4,
            align: 'right',
        });

    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('#8892b0').text('Amounts shown are exclusive of applicable taxes.');

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor('#5a658f').text(`Support: ${SUPPORT_EMAIL}`);
});

module.exports = {
        sendVerificationEmail,
        sendPasswordResetOtpEmail,
        sendOrderInvoiceEmail,
        sendPaymentReceiptEmail,
};