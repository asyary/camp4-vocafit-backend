const setTokens = (res, accessToken, refreshToken) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
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
    const isProduction = process.env.NODE_ENV === 'production';
    const clearOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
    };

    res.clearCookie('access_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);
};

module.exports = { setTokens, clearTokens };
