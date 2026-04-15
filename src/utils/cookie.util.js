const setTokens = (res, accessToken, refreshToken) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    };

    res.cookie('access_token', accessToken, {
        ...cookieOptions,
        maxAge: 3 * 60 * 60 * 1000 // 3 Hours
    });

    res.cookie('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 Week
    });
};

const clearTokens = (res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
};

module.exports = { setTokens, clearTokens };