const verifyTurnstile = async (req, res, next) => {
    const token = req.headers['x-turnstile-token'] || req.body?.turnstileToken;

    if (!token) {
        const err = new Error('Turnstile token is required');
        err.status = 400;
        return next(err);
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
        formData.append('response', token);

        const rawIp = req.ip || req.connection.remoteAddress;
        if (rawIp) {
            let cleanIp = rawIp.split(',')[0].trim();
            if (cleanIp.startsWith('::ffff:')) {
                cleanIp = cleanIp.replace('::ffff:', '');
            }
            formData.append('remoteip', cleanIp);
        }

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        const data = await response.json();

        if (!data.success) {
            const err = new Error('Turnstile verification failed');
            err.status = 403;
            err.data = { 'error_codes': data['error-codes'] || [] };
            return next(err);
        }

        next();
    } catch (error) {
        console.error('Turnstile verification error:', error);
        const err = new Error('Turnstile verification service unavailable');
        err.status = 503;
        return next(err);
    }
};

module.exports = { verifyTurnstile };
